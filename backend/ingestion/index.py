"""INDEX: build SQLite from YAML. Per-branch cache for timeline switching."""

import hashlib
import os
import shutil
import subprocess
from pathlib import Path

import yaml

from .config import (
    get_project_root,
    get_project_dir,
    get_project_name,
    get_studio_dir,
    get_studio_cache_dir,
    get_characters_dir,
    get_scenes_dir,
    get_world_dir,
    get_storyline_dir,
    get_decisions_dir,
    get_timelines_dir,
)

INDEX_DB_NAME = "index.db"
INDEX_VERSION_NAME = "index_version"


def _collect_yaml_paths(project_dir: Path) -> list[Path]:
    """Collect all YAML files under project_dir for hashing."""
    paths = []
    for ext in ("*.yaml", "*.yml"):
        paths.extend(sorted(project_dir.rglob(ext)))
    return paths


def compute_yaml_hash(project_root: Path, project_name: str | None = None) -> str:
    """Deterministic hash of all YAML files in the project. Used for staleness check."""
    project_dir = get_project_dir(project_root, project_name)
    paths = _collect_yaml_paths(project_dir)
    h = hashlib.sha256()
    for p in sorted(paths, key=lambda x: str(x)):
        rel = p.relative_to(project_dir)
        h.update(rel.as_posix().encode())
        h.update(b"\0")
        h.update(p.read_bytes())
        h.update(b"\0")
    return h.hexdigest()


def _read_index_version(db_path: Path) -> str | None:
    """Read stored hash from a cached index.db (stored in separate version file)."""
    version_path = db_path.parent / (db_path.stem + ".version")
    if version_path.exists():
        return version_path.read_text(encoding="utf-8").strip()
    return None


def _write_index_version(db_path: Path, hash_value: str) -> None:
    version_path = db_path.parent / (db_path.stem + ".version")
    version_path.write_text(hash_value, encoding="utf-8")


def _create_schema(conn) -> None:
    sql = """
    CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        scene_id TEXT NOT NULL,
        story_order INTEGER NOT NULL,
        beat TEXT,
        type TEXT,
        timestamp_story TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_events_scene ON events(scene_id);
    CREATE INDEX IF NOT EXISTS idx_events_order ON events(story_order);

    CREATE TABLE IF NOT EXISTS event_awareness (
        event_id TEXT NOT NULL,
        character_id TEXT NOT NULL,
        aware INTEGER NOT NULL,
        source TEXT,
        confidence TEXT,
        PRIMARY KEY (event_id, character_id)
    );
    CREATE INDEX IF NOT EXISTS idx_awareness_character ON event_awareness(character_id, aware);

    CREATE TABLE IF NOT EXISTS world_state_changes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        event_story_order INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_state_key ON world_state_changes(key);
    CREATE INDEX IF NOT EXISTS idx_state_order ON world_state_changes(event_story_order);

    CREATE TABLE IF NOT EXISTS emotional_states (
        character_id TEXT NOT NULL,
        scene_id TEXT NOT NULL,
        mood TEXT,
        tension TEXT,
        confidence REAL,
        openness REAL,
        PRIMARY KEY (character_id, scene_id)
    );

    CREATE TABLE IF NOT EXISTS beliefs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        character_id TEXT NOT NULL,
        belief TEXT NOT NULL,
        ground_truth TEXT,
        held_from_event TEXT,
        held_until_event TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_beliefs_character ON beliefs(character_id);

    CREATE TABLE IF NOT EXISTS knowledge (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        character_id TEXT NOT NULL,
        fact_key TEXT NOT NULL,
        learned_at_event TEXT NOT NULL,
        source TEXT,
        confidence TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_knowledge_character ON knowledge(character_id);
    CREATE INDEX IF NOT EXISTS idx_knowledge_fact ON knowledge(fact_key);

    CREATE TABLE IF NOT EXISTS scenes (
        id TEXT PRIMARY KEY,
        act TEXT NOT NULL,
        scene_order INTEGER NOT NULL,
        location_id TEXT,
        time_of_day TEXT,
        interior_exterior TEXT,
        pace TEXT,
        rhythm TEXT,
        beat TEXT,
        duration_target TEXT
    );

    CREATE TABLE IF NOT EXISTS scene_characters (
        scene_id TEXT NOT NULL,
        character_id TEXT NOT NULL,
        PRIMARY KEY (scene_id, character_id)
    );

    CREATE TABLE IF NOT EXISTS prop_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prop_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        action TEXT,
        location TEXT,
        character_id TEXT
    );

    CREATE TABLE IF NOT EXISTS decisions (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        parent_id TEXT,
        type TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        notes TEXT
    );

    CREATE TABLE IF NOT EXISTS timelines (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        is_canonical INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS timeline_decisions (
        timeline_id TEXT NOT NULL,
        decision_id TEXT NOT NULL,
        order_index INTEGER NOT NULL,
        PRIMARY KEY (timeline_id, decision_id)
    );

    CREATE TABLE IF NOT EXISTS renders (
        id TEXT PRIMARY KEY,
        scene_id TEXT NOT NULL,
        timeline_id TEXT,
        model TEXT,
        status TEXT,
        input_path TEXT,
        output_path TEXT,
        director_notes TEXT,
        approved INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """
    for stmt in sql.split(";"):
        stmt = stmt.strip()
        if stmt:
            conn.execute(stmt)


def _load_yaml(path: Path) -> dict | list:
    if not path.exists():
        return {}
    try:
        return yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except Exception:
        return {}


def _populate_index(conn, project_root: Path) -> None:
    project_dir = get_project_dir(project_root)

    # Clear tables
    for t in [
        "event_awareness", "world_state_changes", "emotional_states", "beliefs", "knowledge",
        "scene_characters", "prop_events", "timeline_decisions", "events", "scenes",
        "decisions", "timelines", "renders",
    ]:
        try:
            conn.execute(f"DELETE FROM {t}")
        except Exception:
            pass

    # Events
    events_dir = get_storyline_dir(project_root) / "events"
    if events_dir.exists():
        for f in sorted(events_dir.glob("*.yaml")):
            d = _load_yaml(f)
            if isinstance(d, dict) and d.get("id"):
                conn.execute(
                    "INSERT OR REPLACE INTO events (id, label, scene_id, story_order, beat, type, timestamp_story) VALUES (?,?,?,?,?,?,?)",
                    (
                        d.get("id", ""),
                        d.get("label", ""),
                        d.get("scene", d.get("scene_id", "")),
                        d.get("story_order", 0),
                        d.get("beat", ""),
                        d.get("type", ""),
                        d.get("timestamp_story", ""),
                    ),
                )
                for c in d.get("characters_aware_after", []):
                    conn.execute(
                        "INSERT OR REPLACE INTO event_awareness (event_id, character_id, aware, source, confidence) VALUES (?,?,1,?,?)",
                        (d["id"], c, "direct_observation", "certain"),
                    )
                for c in d.get("characters_unaware", []):
                    conn.execute(
                        "INSERT OR REPLACE INTO event_awareness (event_id, character_id, aware, source, confidence) VALUES (?,?,0,?,?)",
                        (d["id"], c, "", ""),
                    )
                for wsc in d.get("world_state_changes", []):
                    if isinstance(wsc, dict):
                        conn.execute(
                            "INSERT INTO world_state_changes (event_id, key, value, event_story_order) VALUES (?,?,?,?)",
                            (d["id"], wsc.get("key", ""), str(wsc.get("value", "")), d.get("story_order", 0)),
                        )
                for char, shift in (d.get("emotional_shifts") or {}).items():
                    if isinstance(shift, dict):
                        after = shift.get("after") or {}
                        conn.execute(
                            "INSERT OR REPLACE INTO emotional_states (character_id, scene_id, mood, tension, confidence, openness) VALUES (?,?,?,?,?,?)",
                            (char, d.get("scene", d.get("scene_id", "")), after.get("mood", ""), after.get("tension", ""), 0.5, 0.5),
                        )

    # Knowledge, beliefs
    chars_dir = get_characters_dir(project_root)
    if chars_dir.exists():
        for char_dir in chars_dir.iterdir():
            if char_dir.is_dir():
                k = _load_yaml(char_dir / "knowledge.yaml")
                if isinstance(k, dict):
                    for item in k.get("knows", []):
                        if isinstance(item, dict):
                            conn.execute(
                                "INSERT INTO knowledge (character_id, fact_key, learned_at_event, source, confidence) VALUES (?,?,?,?,?)",
                                (char_dir.name, item.get("fact", ""), item.get("learned_at", ""), item.get("source", ""), item.get("confidence", "")),
                            )
                    for item in k.get("beliefs", []):
                        if isinstance(item, dict):
                            conn.execute(
                                "INSERT INTO beliefs (character_id, belief, ground_truth, held_from_event, held_until_event) VALUES (?,?,?,?,?)",
                                (char_dir.name, item.get("belief", ""), item.get("ground_truth", ""), item.get("held_from", ""), item.get("held_until")),
                            )

    # Scenes
    scenes_dir = get_scenes_dir(project_root)
    if scenes_dir.exists():
        for act_dir in scenes_dir.iterdir():
            if act_dir.is_dir():
                for scene_dir in act_dir.iterdir():
                    if scene_dir.is_dir():
                        s = _load_yaml(scene_dir / "scene.yaml")
                        pac = _load_yaml(get_storyline_dir(project_root) / "pacing.yaml")
                        pac_scenes = pac.get("scenes", {}) if isinstance(pac, dict) else {}
                        pc = pac_scenes.get(s.get("id", ""), {}) if isinstance(s, dict) else {}
                        if isinstance(s, dict) and s.get("id"):
                            conn.execute(
                                "INSERT OR REPLACE INTO scenes (id, act, scene_order, location_id, time_of_day, interior_exterior, pace, rhythm, beat, duration_target) VALUES (?,?,?,?,?,?,?,?,?,?)",
                                (
                                    s.get("id", ""),
                                    s.get("act", ""),
                                    s.get("scene_order", 0),
                                    s.get("location_id", ""),
                                    "",
                                    "",
                                    pc.get("pace", ""),
                                    pc.get("rhythm", ""),
                                    "",
                                    pc.get("duration_target", ""),
                                ),
                            )
                            for c in s.get("character_ids", []):
                                conn.execute(
                                    "INSERT OR REPLACE INTO scene_characters (scene_id, character_id) VALUES (?,?)",
                                    (s["id"], c),
                                )

    # Prop events
    props_dir = get_world_dir(project_root) / "props"
    if props_dir.exists():
        for f in props_dir.glob("*.yaml"):
            d = _load_yaml(f)
            if isinstance(d, dict):
                prop_id = d.get("id", f.stem)
                for lc in d.get("lifecycle", []):
                    if isinstance(lc, dict):
                        conn.execute(
                            "INSERT INTO prop_events (prop_id, event_id, action, location, character_id) VALUES (?,?,?,?,?)",
                            (prop_id, lc.get("event", ""), lc.get("action", ""), lc.get("location", ""), lc.get("character", "")),
                        )

    # Decisions, timelines
    decisions_dir = get_decisions_dir(project_root)
    if decisions_dir.exists():
        for f in decisions_dir.glob("*.yaml"):
            d = _load_yaml(f)
            if isinstance(d, dict) and d.get("id"):
                conn.execute(
                    "INSERT OR REPLACE INTO decisions (id, label, parent_id, type, notes) VALUES (?,?,?,?,?)",
                    (d.get("id", ""), d.get("label", ""), d.get("parent_id", ""), d.get("type", ""), d.get("notes", "")),
                )

    timelines_dir = get_timelines_dir(project_root)
    if timelines_dir.exists():
        for f in timelines_dir.glob("*.yaml"):
            d = _load_yaml(f)
            if isinstance(d, dict) and d.get("id"):
                conn.execute(
                    "INSERT OR REPLACE INTO timelines (id, name, is_canonical) VALUES (?,?,?)",
                    (d.get("id", ""), d.get("name", ""), 1 if d.get("is_canonical") else 0),
                )
                for i, dec_id in enumerate(d.get("decisions", [])):
                    conn.execute(
                        "INSERT OR REPLACE INTO timeline_decisions (timeline_id, decision_id, order_index) VALUES (?,?,?)",
                        (d["id"], dec_id, i),
                    )

    conn.commit()


def reindex(project_root: Path | None = None) -> None:
    """Rebuild SQLite index from YAML files."""
    import sqlite3

    root = project_root or get_project_root()
    project_name = get_project_name(root)
    project_dir = get_project_dir(root)

    current_hash = compute_yaml_hash(root, project_name)
    studio_dir = get_studio_dir(root)
    index_path = studio_dir / INDEX_DB_NAME
    version_path = studio_dir / INDEX_VERSION_NAME

    studio_dir.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(str(index_path))
    try:
        _create_schema(conn)
        _populate_index(conn, root)
    finally:
        conn.close()

    version_path.write_text(current_hash, encoding="utf-8")


def ensure_index_fresh(project_root: Path) -> bool:
    """If YAML hash != stored version, reindex. Returns True if index was rebuilt."""
    current = compute_yaml_hash(project_root)
    stored = None
    version_path = get_studio_dir(project_root) / INDEX_VERSION_NAME
    if version_path.exists():
        stored = version_path.read_text(encoding="utf-8").strip()
    if stored != current:
        reindex(project_root)
        return True
    return False


def switch_timeline(project_root: Path, timeline_name: str) -> None:
    """Switch timeline: git checkout + index cache logic."""
    root = project_root or get_project_root()
    try:
        subprocess.run(
            ["git", "checkout", timeline_name],
            cwd=root,
            check=True,
            capture_output=True,
        )
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"git checkout failed: {e.stderr.decode() if e.stderr else e}") from e

    current_hash = compute_yaml_hash(root)
    cache_dir = get_studio_cache_dir(root)
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_path = cache_dir / f"{timeline_name}.index.db"
    studio_dir = get_studio_dir(root)
    index_path = studio_dir / INDEX_DB_NAME

    if cache_path.exists():
        stored = _read_index_version(cache_path)
        if stored == current_hash:
            if index_path.exists():
                index_path.unlink()
            shutil.copy2(cache_path, index_path)
            (studio_dir / INDEX_VERSION_NAME).write_text(current_hash, encoding="utf-8")
            return

    reindex(root)
    if index_path.exists():
        shutil.copy2(index_path, cache_path)
        _write_index_version(cache_path, current_hash)
