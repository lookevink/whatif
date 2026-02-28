"""REVIEW and COMMIT: human-in-the-loop and finalization."""

import json
import subprocess
from pathlib import Path

import yaml

from .config import (
    get_project_root,
    get_project_dir,
    get_decisions_dir,
    get_timelines_dir,
)

PROJECT_GITIGNORE = """# SQLite index — derived from YAML, never committed
index.db
index_version
cache/
"""


def _ensure_project_git(project_dir: Path) -> None:
    """Initialize project as git repo if not already. Adds .gitignore for index/cache."""
    git_dir = project_dir / ".git"
    if git_dir.exists() and (git_dir / "HEAD").exists():
        _ensure_project_gitignore(project_dir)
        return
    result = subprocess.run(
        ["git", "init"],
        cwd=project_dir,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"git init failed in {project_dir}: {result.stderr or result.stdout}"
        )
    _ensure_project_gitignore(project_dir)


def _ensure_project_gitignore(project_dir: Path) -> None:
    """Ensure project .gitignore exists and excludes index/cache."""
    gitignore = project_dir / ".gitignore"
    if not gitignore.exists():
        gitignore.write_text(PROJECT_GITIGNORE, encoding="utf-8")


def run_review(project_root: Path | None = None) -> str:
    """Print summary of ingested data. Returns summary text."""
    root = project_root or get_project_root()
    project_dir = get_project_dir(root)

    lines = ["=== Ingestion Summary ===", ""]

    parsed = project_dir / "script" / "parsed.json"
    if parsed.exists():
        data = json.loads(parsed.read_text(encoding="utf-8"))
        scenes = data.get("scenes", [])
        chars = data.get("characters", [])
        lines.append(f"Parsed: {len(scenes)} scenes, {len(chars)} characters")
        if data.get("title_page", {}).get("title"):
            lines.append(f"Title: {data['title_page']['title']}")
    else:
        lines.append("Parsed: (not run)")

    chars_dir = project_dir / "characters"
    char_count = len([d for d in chars_dir.iterdir() if d.is_dir()]) if chars_dir.exists() else 0
    lines.append(f"Characters: {char_count}")

    scenes_count = 0
    scenes_dir = project_dir / "scenes"
    if scenes_dir.exists():
        for act_dir in scenes_dir.iterdir():
            if act_dir.is_dir():
                scenes_count += len([d for d in act_dir.iterdir() if d.is_dir()])
    lines.append(f"Scenes: {scenes_count}")

    events_dir = project_dir / "storyline" / "events"
    evt_count = len(list(events_dir.glob("*.yaml"))) if events_dir.exists() else 0
    lines.append(f"Events: {evt_count}")

    lines.append("")
    lines.append("Review the generated YAML files. Edit as needed, then run:")
    lines.append("  whatif ingest --commit")
    lines.append("")
    return "\n".join(lines)


def run_commit(project_root: Path | None = None) -> None:
    """Create decision_000, main timeline, git commit + tag v0-ingested.
    Project dir (.studio/projects/default) is its own git repo."""
    root = project_root or get_project_root()
    project_dir = get_project_dir(root)
    decisions_dir = get_decisions_dir(root)
    timelines_dir = get_timelines_dir(root)

    decisions_dir.mkdir(parents=True, exist_ok=True)
    timelines_dir.mkdir(parents=True, exist_ok=True)

    decision_000 = {
        "id": "decision_000",
        "label": "script as written",
        "parent_id": None,
        "type": "base",
        "notes": "Initial ingestion from screenplay",
    }
    (decisions_dir / "decision_000.yaml").write_text(
        yaml.dump(decision_000, default_flow_style=False, allow_unicode=True),
        encoding="utf-8",
    )

    main_timeline = {
        "id": "main",
        "name": "Main",
        "is_canonical": True,
        "decisions": ["decision_000"],
    }
    (timelines_dir / "main.yaml").write_text(
        yaml.dump(main_timeline, default_flow_style=False, allow_unicode=True),
        encoding="utf-8",
    )

    _ensure_project_git(project_dir)

    try:
        subprocess.run(
            ["git", "add", "."],
            cwd=project_dir,
            check=True,
            capture_output=True,
        )
    except subprocess.CalledProcessError:
        pass

    try:
        subprocess.run(
            ["git", "commit", "-m", "v0-ingested: initial screenplay ingestion"],
            cwd=project_dir,
            check=True,
            capture_output=True,
        )
    except subprocess.CalledProcessError:
        pass

    try:
        subprocess.run(
            ["git", "tag", "v0-ingested"],
            cwd=project_dir,
            check=True,
            capture_output=True,
        )
    except subprocess.CalledProcessError:
        pass
