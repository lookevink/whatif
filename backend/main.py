import io
import json
import re
import subprocess
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml
from fastapi import Body, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse, StreamingResponse
from pydantic import BaseModel

from ingestion.config import (
    get_gemini_api_key,
    get_project_root,
    get_project_dir,
    get_script_dir,
    get_scenes_dir,
    get_characters_dir,
)

# Lazy-loaded google-genai SDK (installed in .venv but not in system Python)
_genai_mod = None
_genai_types_mod = None

def _get_genai():
    """Return (genai, genai_types) from google-genai SDK, installing lazily."""
    global _genai_mod, _genai_types_mod
    if _genai_mod is None:
        from google import genai as _g
        from google.genai import types as _t
        _genai_mod = _g
        _genai_types_mod = _t
    return _genai_mod, _genai_types_mod

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_EXTENSIONS = {".fountain", ".txt", ".spmd", ".pdf"}


@app.get("/")
def read_root():
    return {"Hello": "World"}


@app.get("/items/{item_id}")
def read_item(item_id: int, q: str | None = None):
    return {"item_id": item_id, "q": q}

# unused for now
@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    """Upload a screenplay document (fountain, txt, spmd, pdf). Saved to project script directory."""
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    project_root = get_project_root()
    script_dir = get_script_dir(project_root)
    script_dir.mkdir(parents=True, exist_ok=True)

    dest = script_dir / file.filename
    content = await file.read()
    dest.write_bytes(content)

    return {
        "filename": file.filename,
        "path": str(dest.relative_to(project_root)),
        "size": len(content),
    }


# --- Studio API (serve .studio/projects/<name>/ files to frontend) ---


def _resolve_project_file(project_name: str, file_path: str) -> Path:
    """Resolve a path within the project dir. Reject path traversal."""
    if ".." in file_path or file_path.startswith("/"):
        raise HTTPException(status_code=400, detail="Invalid path")
    project_root = get_project_root()
    project_dir = get_project_dir(project_root, project_name)
    resolved = (project_dir / file_path).resolve()
    if not resolved.is_relative_to(project_dir.resolve()):
        raise HTTPException(status_code=403, detail="Path outside project")
    return resolved


@app.get("/api/studio/projects/{project_name}/scenes")
def api_studio_scenes(project_name: str):
    """List all scenes with id and act (from filesystem structure)."""
    project_root = get_project_root()
    scenes_dir = get_scenes_dir(project_root, project_name)
    if not scenes_dir.exists():
        return []

    def _order(s: str) -> int:
        try:
            return int(s.replace("scene_", "").split("_")[0] or 0)
        except (ValueError, IndexError):
            return 0

    scenes = []
    for act_dir in sorted(scenes_dir.iterdir()):
        if act_dir.is_dir() and act_dir.name.startswith("act"):
            for scene_dir in act_dir.iterdir():
                if scene_dir.is_dir() and scene_dir.name.startswith("scene_"):
                    scenes.append({"id": scene_dir.name, "act": act_dir.name})
    return sorted(scenes, key=lambda s: _order(s["id"]))


@app.get("/api/studio/projects/{project_name}/git-tree")
def api_studio_git_tree(project_name: str):
    """Stub: return git tree data for the project (runs in project's .git)."""
    import subprocess
    project_root = get_project_root()
    project_dir = get_project_dir(project_root, project_name)
    git_dir = project_dir / ".git"
    if not git_dir.exists():
        return {"branches": [], "currentBranch": "main", "mainBranch": "main"}
    try:
        branches_raw = subprocess.run(
            ["git", "-C", str(project_dir), "branch", "-a"],
            capture_output=True, text=True, timeout=5,
        )
        branches = []
        for line in (branches_raw.stdout or "").strip().splitlines():
            name = line.lstrip("* ").strip().replace("remotes/origin/", "")
            if name and name not in ("HEAD",):
                branches.append({"name": name, "commits": []})
        return {
            "branches": branches or [{"name": "main", "commits": []}],
            "currentBranch": "main",
            "mainBranch": "main",
        }
    except Exception:
        return {"branches": [{"name": "main", "commits": []}], "currentBranch": "main", "mainBranch": "main"}


BINARY_EXTENSIONS = {".glb", ".gltf", ".bin", ".png", ".jpg", ".jpeg", ".webp", ".ktx2"}


@app.post("/api/studio/projects/{project_name}/scenes/{scene_id}/arrangement")
def api_studio_save_arrangement(
    project_name: str,
    scene_id: str,
    act: str = Query(..., description="Act folder (e.g. act1, act2)"),
    payload: dict = Body(...),
):
    """Save blocking and lighting from 3D viewer to scene YAML files."""
    project_root = get_project_root()
    scenes_dir = get_scenes_dir(project_root, project_name)
    scene_dir = scenes_dir / act / scene_id

    if not scene_dir.exists():
        raise HTTPException(status_code=404, detail=f"Scene not found: {act}/{scene_id}")

    blocking = payload.get("blocking")
    lighting = payload.get("lighting")

    written = []
    if blocking is not None:
        # Normalize for YAML: use key_positions and blocking (array) for compatibility
        out_blocking = {"space": blocking.get("space", {})}
        if "characterMovements" in blocking:
            out_blocking["blocking"] = blocking["characterMovements"]
        (scene_dir / "blocking.yaml").write_text(
            yaml.dump(out_blocking, default_flow_style=False, allow_unicode=True),
            encoding="utf-8",
        )
        written.append("blocking.yaml")

    if lighting is not None:
        (scene_dir / "lighting.yaml").write_text(
            yaml.dump(lighting, default_flow_style=False, allow_unicode=True),
            encoding="utf-8",
        )
        written.append("lighting.yaml")

    return {"status": "saved", "files": written}


@app.get("/api/studio/projects/{project_name}/files/{file_path:path}")
def api_studio_file(project_name: str, file_path: str):
    """Serve a project file (yaml, json, md, glb, etc.). Binary assets use FileResponse."""
    try:
        resolved = _resolve_project_file(project_name, file_path)
    except HTTPException:
        raise
    if not resolved.exists() or not resolved.is_file():
        raise HTTPException(status_code=404, detail=f"File not found: {file_path}")
    suffix = resolved.suffix.lower()
    if suffix in BINARY_EXTENSIONS:
        media_types = {".glb": "model/gltf-binary", ".gltf": "model/gltf+json"}
        return FileResponse(resolved, media_type=media_types.get(suffix))
    content = resolved.read_text(encoding="utf-8")
    if suffix in (".yaml", ".yml"):
        return PlainTextResponse(content, media_type="text/yaml")
    if suffix == ".json":
        return PlainTextResponse(content, media_type="application/json")
    return PlainTextResponse(content, media_type="text/plain")


# --- Ingestion API ---


@app.post("/ingest")
async def api_ingest(
    file: UploadFile | None = File(None),
    filename: str | None = Query(None, description="Script file in project (e.g. frankenstein-screenplay.pdf)"),
    parse_only: bool = Query(False),
    extract_only: bool = Query(False),
    infer_only: bool = Query(False),
    envision_only: bool = Query(False),
    skip_envision: bool = Query(False),
    review: bool = Query(False),
    commit: bool = Query(False),
):
    """
    Run the ingestion pipeline. Provide either `file` (upload) or `filename` (already in script dir).
    """
    project_root = get_project_root()
    script_dir = get_script_dir(project_root)

    script_path = None
    if file:
        suffix = Path(file.filename or "").suffix.lower()
        if suffix not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"Unsupported format: {suffix}")
        script_dir.mkdir(parents=True, exist_ok=True)
        dest = script_dir / file.filename
        dest.write_bytes(await file.read())
        script_path = dest
    elif filename:
        candidate = script_dir / filename
        if not candidate.exists():
            raise HTTPException(status_code=404, detail=f"Script not found: {filename}")
        script_path = candidate
    else:
        needs_script = parse_only or not (extract_only or infer_only or envision_only)
        if needs_script:
            raise HTTPException(
                status_code=400,
                detail="Provide `file` or `filename` for parse or full pipeline",
            )

    from ingestion.parse import run_parse
    from ingestion.extract import run_extract
    from ingestion.infer import run_infer
    from ingestion.envision import run_envision
    from ingestion.index import reindex

    steps_done = []

    if parse_only:
        if script_path is None:
            raise HTTPException(status_code=400, detail="Script required for parse")
        run_parse(project_root, script_path)
        return {"steps": ["parse"], "status": "complete"}

    if extract_only:
        run_extract(project_root)
        return {"steps": ["extract"], "status": "complete"}

    if infer_only:
        run_infer(project_root)
        return {"steps": ["infer"], "status": "complete"}

    if envision_only:
        run_envision(project_root)
        return {"steps": ["envision"], "status": "complete"}

    # Full pipeline
    if script_path is None:
        raise HTTPException(status_code=400, detail="Script required for full pipeline")
    run_parse(project_root, script_path)
    steps_done.append("parse")
    run_extract(project_root)
    steps_done.append("extract")
    run_infer(project_root)
    steps_done.append("infer")
    if not skip_envision:
        run_envision(project_root)
        steps_done.append("envision")
    reindex(project_root)
    steps_done.append("index")

    result = {"steps": steps_done, "status": "complete"}

    if review:
        from ingestion.commit import run_review
        result["review"] = run_review(project_root)

    if commit:
        from ingestion.commit import run_commit
        run_commit(project_root)
        result["commit"] = "decision_000, main timeline, v0-ingested"

    return result


@app.post("/index")
def api_index():
    """Rebuild the SQLite index from YAML files."""
    from ingestion.index import reindex
    project_root = get_project_root()
    reindex(project_root)
    return {"status": "index rebuilt"}


@app.get("/review")
def api_review():
    """Return a summary of ingested data."""
    from ingestion.commit import run_review
    project_root = get_project_root()
    return {"summary": run_review(project_root)}


@app.post("/commit")
def api_commit():
    """Create decision_000, main timeline, git commit and tag v0-ingested."""
    from ingestion.commit import run_commit
    project_root = get_project_root()
    run_commit(project_root)
    return {"status": "commit complete", "created": ["decision_000", "main timeline", "v0-ingested"]}


# --- What-If Scene Branching API ---


class WhatIfSceneRequest(BaseModel):
    scene_id: str
    act: str
    what_if_text: str
    current_branch: str | None = None  # auto-detect from .studio project repo
    project_name: str | None = "default"


def _load_scene_yaml(scene_id: str, act: str, project_name: str) -> dict[str, Any]:
    """Load a scene.yaml using ingestion.config paths."""
    project_root = get_project_root()
    scenes_dir = get_scenes_dir(project_root, project_name)
    scene_path = scenes_dir / act / scene_id / "scene.yaml"
    if not scene_path.exists():
        raise HTTPException(status_code=404, detail=f"Scene not found: {act}/{scene_id}")
    return yaml.safe_load(scene_path.read_text(encoding="utf-8"))


def _load_scene_dialogue(scene_id: str, act: str, project_name: str) -> list[dict]:
    """Load dialogue.json for a scene if it exists."""
    project_root = get_project_root()
    scenes_dir = get_scenes_dir(project_root, project_name)
    dialogue_path = scenes_dir / act / scene_id / "dialogue.json"
    if not dialogue_path.exists():
        return []
    try:
        return json.loads(dialogue_path.read_text(encoding="utf-8"))
    except Exception:
        return []


def _generate_branch_name(scene_id: str, what_if_text: str) -> str:
    """Generate a descriptive git branch name from the what-if text."""
    cleaned = re.sub(r"[^\w\s]", "", what_if_text.lower())
    words = cleaned.split()[:6]
    stop_words = {"what", "if", "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "is"}
    words = [w for w in words if w not in stop_words][:3]
    timestamp = datetime.now().strftime("%y%m%d_%H%M")
    branch_base = "-".join(words) if words else "scenario"
    return f"whatif/{scene_id}/{branch_base}_{timestamp}"


def _apply_whatif_modifications(scene_yaml: dict, what_if_text: str) -> dict:
    """Apply rule-based modifications when AI is not available."""
    modified = json.loads(json.dumps(scene_yaml))
    original_summary = modified.get("summary", "")
    modified["summary"] = f"{original_summary} [WHAT-IF: {what_if_text}]"
    what_if_lower = what_if_text.lower()

    # Character additions
    if "enters" in what_if_lower or "arrives" in what_if_lower:
        words = what_if_text.split()
        for i, word in enumerate(words):
            if word.lower() in ("enters", "arrives") and i > 0:
                potential = words[i - 1].lower().strip(",.")
                if potential not in modified.get("character_ids", []):
                    modified.setdefault("character_ids", []).append(potential)
                break

    # Dialogue from quotes
    quote_match = re.search(r'"([^"]*)"', what_if_text)
    if quote_match:
        dialogue_text = quote_match.group(1)
        before_quote = what_if_text[: quote_match.start()].lower()
        speaker = "unknown"
        for char_id in modified.get("character_ids", []):
            if char_id.lower() in before_quote:
                speaker = char_id
                break
        modified.setdefault("dialogue", []).append(
            {"character": speaker, "line": dialogue_text}
        )

    # Actions
    action_words = ["moves", "walks", "runs", "leaves", "exits", "fights", "embraces"]
    for action_word in action_words:
        if action_word in what_if_lower:
            modified.setdefault("actions", []).append(
                {"description": what_if_text, "type": action_word}
            )
            break

    # Camera
    camera_words = ["close-up", "wide shot", "zoom", "pan", "tracking shot"]
    for camera_word in camera_words:
        if camera_word in what_if_lower:
            modified.setdefault("camera", {})["shot_type"] = camera_word
            break

    return modified


async def _ai_modify_scene(scene_yaml: dict, what_if_text: str) -> dict:
    """Use Gemini AI to modify scene YAML, with fallback to rule-based."""
    gemini_key = get_gemini_api_key()
    if not gemini_key:
        return _apply_whatif_modifications(scene_yaml, what_if_text)

    try:
        _genai, _types = _get_genai()
        client = _genai.Client(vertexai=False, api_key=gemini_key)

        prompt = f"""Given this scene YAML:
{yaml.dump(scene_yaml, default_flow_style=False)}

Apply this "what if" scenario: {what_if_text}

Modify the scene YAML to reflect this change. You can modify:
- summary: Update the scene summary
- character_ids: Add or remove characters
- location_id: Change location if needed
- heading: Update the scene heading
- Add dialogue array with character lines
- Add actions array with character actions
- Add camera object with shot information

Return ONLY valid YAML with your modifications."""

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=_types.GenerateContentConfig(temperature=0.7, max_output_tokens=1000),
        )
        text = response.text.strip()
        if text.startswith("```yaml"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]

        modified = yaml.safe_load(text)
        modified.setdefault("id", scene_yaml["id"])
        modified.setdefault("act", scene_yaml["act"])
        return modified

    except Exception as e:
        print(f"AI modification failed, using fallback: {e}")
        return _apply_whatif_modifications(scene_yaml, what_if_text)


def _generate_story_blocks(modified_yaml: dict) -> list[dict]:
    """Generate screenplay-style story blocks from modified YAML."""
    blocks: list[dict] = []

    blocks.append({"type": "heading", "content": modified_yaml.get("heading", "SCENE")})

    if "summary" in modified_yaml:
        blocks.append({"type": "narrative", "content": modified_yaml["summary"]})

    if modified_yaml.get("character_ids"):
        characters = ", ".join(
            c.replace("_", " ").title() for c in modified_yaml["character_ids"]
        )
        blocks.append({"type": "action", "content": f"Present: {characters}"})

    for d in modified_yaml.get("dialogue", []):
        character = d.get("character", "UNKNOWN").replace("_", " ").upper()
        blocks.append({"type": "dialogue", "character": character, "content": d.get("line", "")})
        if "delivery" in d:
            blocks.append({"type": "parenthetical", "content": f"({d['delivery']})"})

    for a in modified_yaml.get("actions", []):
        blocks.append({"type": "action", "content": a.get("description", a.get("type", "Action"))})

    camera = modified_yaml.get("camera", {})
    if "shot_type" in camera:
        blocks.append({"type": "camera", "content": f"[{camera['shot_type'].upper()}]"})

    if not blocks:
        blocks.append({"type": "transition", "content": "CUT TO:"})

    return blocks


def _generate_storyboard(
    scene_id: str,
    modified_yaml: dict,
    story_blocks: list[dict],
    dialogue: list[dict],
) -> list[dict]:
    """Generate storyboard panels from the modified scene and story blocks.

    Returns a list of panels matching the frontend StoryboardPanel interface:
    { index, shotType, description, dialogue?, cameraAngle?, lighting?, prompt? }
    """
    panels: list[dict] = []

    # Determine characters and location for prompts
    characters = ", ".join(
        c.replace("_", " ").title() for c in modified_yaml.get("character_ids", [])
    ) or "characters"
    heading = modified_yaml.get("heading", "")
    location = modified_yaml.get("location_id", "").replace("_", " ").title() or "location"

    # Determine lighting mood
    lighting_mood = "dramatic"
    if "night" in heading.lower():
        lighting_mood = "low-key night"
    elif "day" in heading.lower():
        lighting_mood = "natural daylight"
    elif "ext." in heading.lower():
        lighting_mood = "exterior natural"

    # Panel 1: Establishing shot
    panels.append({
        "index": 0,
        "shotType": "establishing",
        "description": f"Establishing shot: {heading}",
        "cameraAngle": "wide",
        "lighting": lighting_mood,
        "prompt": f"Wide establishing shot of {location}, {lighting_mood} lighting, cinematic film still",
    })

    # Panel from narrative summary
    summary = modified_yaml.get("summary", "")
    if summary:
        panels.append({
            "index": 1,
            "shotType": "wide",
            "description": summary,
            "cameraAngle": "wide",
            "lighting": lighting_mood,
            "prompt": f"Wide shot of {characters} in {location}, {summary[:80]}, cinematic",
        })

    # Panels from dialogue - group into 2-line chunks
    dialogue_lines = []
    for d in modified_yaml.get("dialogue", []):
        char = d.get("character", "UNKNOWN").replace("_", " ").upper()
        dialogue_lines.append(f"{char}: {d.get('line', '')}")
    # Also include loaded dialogue.json
    for d in dialogue:
        char = d.get("character", "UNKNOWN")
        text = d.get("text", d.get("line", ""))
        if text:
            dialogue_lines.append(f"{char}: {text[:100]}")

    chunk_size = 2
    shot_cycle = ["medium", "close_up", "over_shoulder", "medium_close_up"]
    for i in range(0, len(dialogue_lines), chunk_size):
        chunk = dialogue_lines[i : i + chunk_size]
        shot_type = shot_cycle[(i // chunk_size) % len(shot_cycle)]
        panel_index = len(panels)
        panels.append({
            "index": panel_index,
            "shotType": shot_type,
            "description": f"Dialogue exchange in {location}",
            "dialogue": chunk,
            "cameraAngle": shot_type,
            "lighting": lighting_mood,
            "prompt": f"{shot_type} shot of {characters} in conversation, {lighting_mood}, cinematic",
        })

    # Panels from actions
    for a in modified_yaml.get("actions", []):
        panel_index = len(panels)
        desc = a.get("description", a.get("type", "Action"))
        panels.append({
            "index": panel_index,
            "shotType": "medium",
            "description": desc,
            "cameraAngle": "tracking",
            "lighting": lighting_mood,
            "prompt": f"Medium tracking shot, {desc[:80]}, {lighting_mood}, cinematic",
        })

    # Camera-specific panels
    camera = modified_yaml.get("camera", {})
    if "shot_type" in camera:
        panel_index = len(panels)
        panels.append({
            "index": panel_index,
            "shotType": camera["shot_type"],
            "description": f"Camera direction: {camera['shot_type']}",
            "cameraAngle": camera["shot_type"],
            "lighting": lighting_mood,
            "prompt": f"{camera['shot_type']} shot of {characters}, {lighting_mood}, cinematic",
        })

    # Ensure at least 4 panels
    defaults = ["wide", "medium", "close_up", "wide"]
    while len(panels) < 4:
        idx = len(panels)
        st = defaults[idx % len(defaults)]
        panels.append({
            "index": idx,
            "shotType": st,
            "description": f"Scene coverage - {st.replace('_', ' ')} shot",
            "cameraAngle": st,
            "lighting": lighting_mood,
            "prompt": f"{st} shot of {characters} in {location}, {lighting_mood}, cinematic",
        })

    # Re-index
    for i, p in enumerate(panels):
        p["index"] = i

    return panels


def _save_storyboard(
    scene_id: str,
    act: str,
    project_name: str,
    panels: list[dict],
    what_if_text: str,
) -> str:
    """Save storyboard.yaml to the scene directory."""
    project_root = get_project_root()
    scenes_dir = get_scenes_dir(project_root, project_name)
    scene_dir = scenes_dir / act / scene_id
    scene_dir.mkdir(parents=True, exist_ok=True)

    storyboard_data = {
        "scene_id": scene_id,
        "act": act,
        "what_if": what_if_text,
        "generated": datetime.now().isoformat(),
        "panel_count": len(panels),
        "panels": panels,
    }
    storyboard_path = scene_dir / "storyboard.yaml"
    storyboard_path.write_text(
        yaml.dump(storyboard_data, default_flow_style=False, allow_unicode=True, sort_keys=False),
        encoding="utf-8",
    )
    return str(storyboard_path)


def _resolve_base_branch(project_dir: Path, requested: str | None) -> str:
    """Return a valid base branch ref in the .studio project repo.

    If the caller's requested branch exists, use it.  Otherwise fall back
    to the repo's current HEAD branch (typically ``master``).
    """
    git = ["git", "-C", str(project_dir)]
    if requested:
        # Check whether the requested ref actually exists
        check = subprocess.run(
            [*git, "rev-parse", "--verify", requested],
            capture_output=True, timeout=5,
        )
        if check.returncode == 0:
            return requested

    # Fall back to whatever HEAD points to
    detect = subprocess.run(
        [*git, "rev-parse", "--abbrev-ref", "HEAD"],
        capture_output=True, text=True, timeout=5,
    )
    return detect.stdout.strip() or "master"


def _create_git_branch(branch_name: str, base_branch: str, project_dir: Path) -> bool:
    """Create a new git branch in the .studio project repo.

    Uses `git branch <name> <base>` to create the branch at the base ref
    without switching, then checks out the new branch.  This avoids failures
    when the working tree is dirty.
    """
    git = ["git", "-C", str(project_dir)]
    try:
        # Create branch pointing at the base branch (no checkout yet)
        subprocess.run(
            [*git, "branch", branch_name, base_branch],
            check=True, capture_output=True, timeout=10,
        )
    except subprocess.CalledProcessError:
        # Branch may already exist — verify it does before continuing
        check = subprocess.run(
            [*git, "rev-parse", "--verify", branch_name],
            capture_output=True, timeout=5,
        )
        if check.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to create branch {branch_name} from {base_branch}",
            )

    # Checkout the new branch
    try:
        subprocess.run(
            [*git, "checkout", branch_name],
            check=True, capture_output=True, timeout=10,
        )
        return True
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"Failed to checkout branch: {e}")


def _commit_whatif_changes(
    branch_name: str,
    what_if_text: str,
    modified_files: list[str],
    project_dir: Path,
) -> str | None:
    """Commit what-if changes to the .studio project repo."""
    try:
        for file_path in modified_files:
            # Convert absolute paths to relative paths within the project dir
            abs_path = Path(file_path).resolve()
            try:
                rel_path = str(abs_path.relative_to(project_dir.resolve()))
            except ValueError:
                rel_path = file_path
            subprocess.run(
                ["git", "-C", str(project_dir), "add", rel_path],
                check=True, capture_output=True, timeout=5,
            )
        commit_msg = f"What-If: {what_if_text}\n\nBranch: {branch_name}\nGenerated by What-If Scene API"
        subprocess.run(
            ["git", "-C", str(project_dir), "commit", "-m", commit_msg],
            check=True, capture_output=True, timeout=10,
        )
        result = subprocess.run(
            ["git", "-C", str(project_dir), "rev-parse", "HEAD"],
            capture_output=True, text=True, check=True, timeout=5,
        )
        return result.stdout.strip()[:8]
    except subprocess.CalledProcessError as e:
        print(f"Commit failed: {e}")
        return None


def _analyze_changes(original: dict, modified: dict) -> dict[str, list[str]]:
    """Analyze differences between original and modified YAML."""
    changes: dict[str, list[str]] = {"added": [], "modified": [], "removed": []}
    for key, value in modified.items():
        if key not in original:
            changes["added"].append(f"{key}: {str(value)[:50]}...")
        elif original[key] != value:
            changes["modified"].append(f"{key}: {str(original[key])[:30]}... -> {str(value)[:30]}...")
    for key in original:
        if key not in modified:
            changes["removed"].append(key)
    return changes


# --- Storyboard Image Generation & Veo Export ---


class StoryboardGenerateRequest(BaseModel):
    scene_id: str
    act: str
    project_name: str | None = "default"
    style: str | None = "cinematic"
    panel_count: int | None = 6


def _load_character_profile(char_id: str, project_name: str) -> dict:
    """Load character profile.yaml for prompt enrichment."""
    project_root = get_project_root()
    chars_dir = get_characters_dir(project_root, project_name)
    profile_path = chars_dir / char_id / "profile.yaml"
    if profile_path.exists():
        return yaml.safe_load(profile_path.read_text(encoding="utf-8")) or {}
    return {"id": char_id, "name": char_id.replace("_", " ").title()}


def _find_character_pngs(char_id: str, project_name: str) -> list[Path]:
    """Find PNG reference images in character assets directory."""
    project_root = get_project_root()
    chars_dir = get_characters_dir(project_root, project_name)
    assets_dir = chars_dir / char_id / "assets"
    pngs: list[Path] = []
    if assets_dir.exists():
        pngs.extend(assets_dir.glob("*.png"))
    # Also check visual.yaml for referenceImages / reference_images
    visual_path = assets_dir / "visual.yaml" if assets_dir.exists() else None
    if visual_path and visual_path.exists():
        visual = yaml.safe_load(visual_path.read_text(encoding="utf-8")) or {}
        project_dir = get_project_dir(project_root, project_name)
        for ref in visual.get("referenceImages", []) + visual.get("reference_images", []):
            p = project_dir / ref
            if p.exists():
                pngs.append(p)
    return pngs


def _load_location_description(location_id: str, project_name: str) -> dict:
    """Load location description.yaml for prompt enrichment."""
    project_root = get_project_root()
    project_dir = get_project_dir(project_root, project_name)
    desc_path = project_dir / "world" / "locations" / location_id / "description.yaml"
    if desc_path.exists():
        return yaml.safe_load(desc_path.read_text(encoding="utf-8")) or {}
    return {"id": location_id, "name": location_id.replace("_", " ").title()}


def _load_scene_directions(scene_id: str, act: str, project_name: str) -> str:
    """Load directions.md for a scene."""
    project_root = get_project_root()
    scenes_dir = get_scenes_dir(project_root, project_name)
    path = scenes_dir / act / scene_id / "directions.md"
    if path.exists():
        return path.read_text(encoding="utf-8")
    return ""


def _load_storyboard_yaml(scene_id: str, act: str, project_name: str) -> dict:
    """Load existing storyboard.yaml for a scene."""
    project_root = get_project_root()
    scenes_dir = get_scenes_dir(project_root, project_name)
    path = scenes_dir / act / scene_id / "storyboard.yaml"
    if path.exists():
        return yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return {}


def _build_panel_image_prompt(
    panel: dict,
    scene_yaml: dict,
    character_profiles: dict[str, dict],
    location_desc: dict,
    directions: str,
    style: str,
) -> str:
    """Build a rich prompt for a single storyboard panel image."""
    parts = []

    style_map = {
        "cinematic": "Cinematic film still, 35mm film grain, dramatic lighting, widescreen 16:9",
        "sketch": "Pencil sketch storyboard, loose lines, grayscale, professional storyboard artist",
        "comic": "Comic book panel, bold ink lines, dynamic composition, graphic novel style",
        "realistic": "Photorealistic, high detail, natural lighting, cinematic composition",
    }
    parts.append(style_map.get(style, style_map["cinematic"]))

    shot_type = panel.get("shotType", "medium")
    parts.append(f"{shot_type.replace('_', ' ')} shot")

    loc_name = location_desc.get("name", scene_yaml.get("location_id", "location"))
    loc_description = location_desc.get("description", "")
    parts.append(f"Setting: {loc_name}")
    if loc_description:
        parts.append(loc_description[:120])

    for cid in scene_yaml.get("character_ids", []):
        profile = character_profiles.get(cid, {})
        name = profile.get("name", cid.replace("_", " ").title())
        desc = profile.get("description", "")
        if desc:
            parts.append(f"{name}: {desc[:100]}")
        else:
            parts.append(f"Character: {name}")

    if panel.get("description"):
        parts.append(panel["description"])

    if panel.get("dialogue"):
        parts.append(f"Dialogue moment: {'; '.join(panel['dialogue'][:2])[:150]}")

    if panel.get("lighting"):
        parts.append(f"Lighting: {panel['lighting']}")

    heading = scene_yaml.get("heading", "")
    if heading:
        parts.append(f"Scene: {heading}")

    if directions:
        parts.append(f"Context: {directions[:200]}")

    parts.append("19th century Gothic horror, period-accurate costume and setting")

    return ". ".join(parts)


async def _generate_panel_image(
    prompt: str,
    output_path: Path,
    character_png_paths: list[Path],
) -> bool:
    """Generate a storyboard panel image using Gemini.

    Uses the google-genai SDK (same as envision.py).
    Strategy 1: gemini-2.0-flash-exp with image output.
    Strategy 2: imagen-3.0-generate-002 fallback.
    Returns True if image was generated, False otherwise.
    """
    api_key = get_gemini_api_key()
    if not api_key:
        print("No Gemini API key found, skipping image generation")
        return False

    _genai, _types = _get_genai()
    client = _genai.Client(vertexai=False, api_key=api_key)

    # ── Strategy 1: gemini-2.0-flash-exp with image output ──
    try:
        contents: list = []
        for png_path in character_png_paths[:3]:
            if png_path.exists():
                contents.append(
                    _types.Part.from_bytes(
                        data=png_path.read_bytes(),
                        mime_type="image/png",
                    )
                )
        contents.append(prompt)

        response = client.models.generate_content(
            model="gemini-2.0-flash-exp",
            contents=contents,
            config=_types.GenerateContentConfig(
                response_modalities=["IMAGE", "TEXT"],
                temperature=0.8,
            ),
        )

        for part in response.candidates[0].content.parts:
            if part.inline_data and part.inline_data.mime_type.startswith("image/"):
                output_path.parent.mkdir(parents=True, exist_ok=True)
                output_path.write_bytes(part.inline_data.data)
                return True

    except Exception as e:
        print(f"Gemini image gen failed for {output_path.name}: {e}")

    # ── Strategy 2: Imagen 3 ──
    try:
        response = client.models.generate_images(
            model="imagen-3.0-generate-002",
            prompt=prompt[:480],
            config=_types.GenerateImagesConfig(
                number_of_images=1,
                aspect_ratio="16:9",
            ),
        )
        if response.generated_images:
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_bytes(response.generated_images[0].image.image_bytes)
            return True
    except Exception as e2:
        print(f"Imagen fallback also failed: {e2}")

    return False


def _estimate_panel_duration(panel: dict) -> int:
    """Estimate video duration in seconds for a panel."""
    base = {
        "establishing": 4, "wide": 5, "medium": 4, "close_up": 3,
        "extreme_close_up": 2, "over_shoulder": 4, "medium_close_up": 3,
    }
    duration = base.get(panel.get("shotType", "medium"), 4)
    if panel.get("dialogue"):
        duration += len(panel["dialogue"]) * 2
    return duration


def _generate_veo_prompt_md(
    scene_yaml: dict,
    panels: list[dict],
    dialogue: list[dict],
    directions: str,
    character_profiles: dict[str, dict],
    location_desc: dict,
) -> str:
    """Generate veo_prompt.md with per-panel video generation prompts."""
    lines = [
        "# Veo Video Generation Prompts",
        "",
        f"## Scene: {scene_yaml.get('heading', scene_yaml.get('id', 'Unknown'))}",
        f"**Location:** {location_desc.get('name', scene_yaml.get('location_id', 'Unknown'))}",
        f"**Characters:** {', '.join(c.replace('_', ' ').title() for c in scene_yaml.get('character_ids', []))}",
        f"**Summary:** {scene_yaml.get('summary', '')}",
        "",
        "---",
        "",
    ]

    movement_map = {
        "establishing": "slow dolly in",
        "wide": "static or slow pan",
        "medium": "slight push in",
        "close_up": "static, locked off",
        "extreme_close_up": "static",
        "over_shoulder": "subtle drift",
        "medium_close_up": "slow push in",
    }

    for panel in panels:
        idx = panel.get("index", 0)
        shot = panel.get("shotType", "medium")
        movement = movement_map.get(shot, "static")
        duration = _estimate_panel_duration(panel)

        lines.append(f"### Panel {idx + 1}: {shot.replace('_', ' ').title()}")
        lines.append("")
        lines.append(f"**Shot Type:** {shot}")
        lines.append(f"**Camera Angle:** {panel.get('cameraAngle', 'standard')}")
        lines.append(f"**Lighting:** {panel.get('lighting', 'natural')}")
        lines.append(f"**Camera Movement:** {movement}")
        lines.append(f"**Duration:** {duration}s")
        lines.append("")
        lines.append(f"**Description:** {panel.get('description', '')}")
        lines.append("")

        if panel.get("dialogue"):
            lines.append("**Dialogue:**")
            for d in panel["dialogue"]:
                lines.append(f"> {d}")
            lines.append("")

        char_names = [
            character_profiles.get(c, {}).get("name", c.replace("_", " ").title())
            for c in scene_yaml.get("character_ids", [])
        ]
        lines.append(f"**Characters in frame:** {', '.join(char_names)}")
        lines.append("")
        lines.append("**Style:** 19th century Gothic horror, period costume, cinematic film grain")
        lines.append("")

        veo_prompt = ". ".join([
            panel.get("prompt", panel.get("description", "")),
            f"Camera: {movement}",
            f"Duration: {duration}s",
            "19th century Gothic horror, cinematic quality",
        ])
        lines.append(f"**Veo Prompt:** `{veo_prompt}`")
        lines.append("")
        lines.append("---")
        lines.append("")

    return "\n".join(lines)


@app.post("/api/studio/projects/{project_name}/storyboard/generate")
async def api_generate_storyboard_images(
    project_name: str,
    request: StoryboardGenerateRequest,
):
    """Generate storyboard panel images using Gemini/Imagen and save to scene directory."""
    project_root = get_project_root()
    scenes_dir = get_scenes_dir(project_root, project_name)
    scene_dir = scenes_dir / request.act / request.scene_id

    if not scene_dir.exists():
        raise HTTPException(status_code=404, detail=f"Scene not found: {request.act}/{request.scene_id}")

    # Load scene data
    scene_yaml = _load_scene_yaml(request.scene_id, request.act, project_name)
    dialogue = _load_scene_dialogue(request.scene_id, request.act, project_name)
    directions = _load_scene_directions(request.scene_id, request.act, project_name)

    # Load existing storyboard or generate panels
    storyboard = _load_storyboard_yaml(request.scene_id, request.act, project_name)
    if storyboard.get("panels"):
        panels = storyboard["panels"]
    else:
        story_blocks = _generate_story_blocks(scene_yaml)
        panels = _generate_storyboard(request.scene_id, scene_yaml, story_blocks, dialogue)

    panel_count = request.panel_count or 6
    panels = panels[:panel_count]

    # Load character profiles and detect PNGs
    char_ids = scene_yaml.get("character_ids", [])
    character_profiles = {cid: _load_character_profile(cid, project_name) for cid in char_ids}
    character_pngs: list[Path] = []
    for cid in char_ids:
        character_pngs.extend(_find_character_pngs(cid, project_name))

    # Load location
    location_id = scene_yaml.get("location_id", "")
    location_desc = _load_location_description(location_id, project_name)

    # Generate images per panel
    storyboard_img_dir = scene_dir / "storyboard"
    storyboard_img_dir.mkdir(parents=True, exist_ok=True)

    generated_count = 0
    for panel in panels:
        idx = panel.get("index", panels.index(panel))
        output_path = storyboard_img_dir / f"panel_{idx:03d}.png"

        prompt = _build_panel_image_prompt(
            panel, scene_yaml, character_profiles, location_desc,
            directions, request.style or "cinematic",
        )

        success = await _generate_panel_image(prompt, output_path, character_pngs)

        if success:
            rel_path = f"scenes/{request.act}/{request.scene_id}/storyboard/panel_{idx:03d}.png"
            panel["imageUrl"] = f"/api/studio/projects/{project_name}/files/{rel_path}"
            generated_count += 1
        else:
            panel["imageUrl"] = None

    # Update storyboard.yaml
    storyboard_data = {
        "scene_id": request.scene_id,
        "act": request.act,
        "style": request.style or "cinematic",
        "generated": datetime.now().isoformat(),
        "panel_count": len(panels),
        "panels": panels,
    }
    (scene_dir / "storyboard.yaml").write_text(
        yaml.dump(storyboard_data, default_flow_style=False, allow_unicode=True, sort_keys=False),
        encoding="utf-8",
    )

    return {
        "success": True,
        "scene_id": request.scene_id,
        "generated_count": generated_count,
        "total_panels": len(panels),
        "panels": panels,
    }


@app.get("/api/studio/projects/{project_name}/storyboard/export")
async def api_export_storyboard_zip(
    project_name: str,
    scene_id: str = Query(...),
    act: str = Query(...),
):
    """Export scene storyboard as a zip file ready for Veo video generation."""
    project_root = get_project_root()
    scenes_dir = get_scenes_dir(project_root, project_name)
    scene_dir = scenes_dir / act / scene_id

    if not scene_dir.exists():
        raise HTTPException(status_code=404, detail=f"Scene not found: {act}/{scene_id}")

    # Load scene data
    scene_yaml = _load_scene_yaml(scene_id, act, project_name)
    dialogue = _load_scene_dialogue(scene_id, act, project_name)
    directions = _load_scene_directions(scene_id, act, project_name)
    storyboard = _load_storyboard_yaml(scene_id, act, project_name)
    panels = storyboard.get("panels", [])

    # Load character/location data for Veo prompt
    char_ids = scene_yaml.get("character_ids", [])
    character_profiles = {cid: _load_character_profile(cid, project_name) for cid in char_ids}
    location_id = scene_yaml.get("location_id", "")
    location_desc = _load_location_description(location_id, project_name)

    # Build zip
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        # Scene files
        for fname in ("scene.yaml", "storyboard.yaml", "directions.md", "dialogue.json"):
            fpath = scene_dir / fname
            if fpath.exists():
                zf.write(fpath, fname)

        # Panel PNGs
        storyboard_img_dir = scene_dir / "storyboard"
        if storyboard_img_dir.exists():
            for png_file in sorted(storyboard_img_dir.glob("panel_*.png")):
                zf.write(png_file, f"panels/{png_file.name}")

        # Character reference PNGs
        chars_dir = get_characters_dir(project_root, project_name)
        for cid in char_ids:
            assets_dir = chars_dir / cid / "assets"
            if assets_dir.exists():
                for png_file in assets_dir.glob("*.png"):
                    zf.write(png_file, f"characters/{cid}/{png_file.name}")

        # Veo prompt
        veo_md = _generate_veo_prompt_md(
            scene_yaml, panels, dialogue, directions,
            character_profiles, location_desc,
        )
        zf.writestr("veo_prompt.md", veo_md)

    buffer.seek(0)
    filename = f"storyboard_{scene_id}_{act}.zip"
    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.post("/api/studio/whatif/scene/create")
async def api_whatif_scene_create(request: WhatIfSceneRequest):
    """Create a what-if branch with AI-modified scene YAML, storyboard, and git commit."""
    project_name = request.project_name or "default"
    project_root = get_project_root()
    project_dir = get_project_dir(project_root, project_name)

    # Load current scene
    scene_yaml = _load_scene_yaml(request.scene_id, request.act, project_name)
    dialogue = _load_scene_dialogue(request.scene_id, request.act, project_name)

    # Generate branch name and create git branch in .studio project repo
    branch_name = _generate_branch_name(request.scene_id, request.what_if_text)
    base_branch = _resolve_base_branch(project_dir, request.current_branch)
    _create_git_branch(branch_name, base_branch, project_dir)

    # Modify scene with AI (or fallback)
    modified_yaml = await _ai_modify_scene(scene_yaml, request.what_if_text)

    # Save modified scene.yaml
    scenes_dir = get_scenes_dir(project_root, project_name)
    scene_dir = scenes_dir / request.act / request.scene_id
    scene_dir.mkdir(parents=True, exist_ok=True)
    scene_path = scene_dir / "scene.yaml"
    scene_path.write_text(
        yaml.dump(modified_yaml, default_flow_style=False, sort_keys=False, allow_unicode=True),
        encoding="utf-8",
    )

    # Generate story blocks and storyboard
    story_blocks = _generate_story_blocks(modified_yaml)
    storyboard_panels = _generate_storyboard(
        request.scene_id, modified_yaml, story_blocks, dialogue,
    )
    storyboard_path = _save_storyboard(
        request.scene_id, request.act, project_name,
        storyboard_panels, request.what_if_text,
    )

    # Commit all changes to .studio project repo
    committed_files = [str(scene_path), storyboard_path]
    commit_hash = _commit_whatif_changes(
        branch_name, request.what_if_text, committed_files, project_dir,
    )

    return {
        "success": True,
        "branch_name": branch_name,
        "scene_id": request.scene_id,
        "modified_yaml": modified_yaml,
        "story_blocks": story_blocks,
        "storyboard": storyboard_panels,
        "commit_hash": commit_hash,
        "message": f"Created what-if branch: {branch_name}",
    }


@app.post("/api/studio/whatif/scene/preview")
async def api_whatif_scene_preview(request: WhatIfSceneRequest):
    """Preview what-if changes and storyboard without creating a branch."""
    project_name = request.project_name or "default"

    scene_yaml = _load_scene_yaml(request.scene_id, request.act, project_name)
    dialogue = _load_scene_dialogue(request.scene_id, request.act, project_name)
    modified_yaml = await _ai_modify_scene(scene_yaml, request.what_if_text)
    story_blocks = _generate_story_blocks(modified_yaml)
    storyboard_panels = _generate_storyboard(
        request.scene_id, modified_yaml, story_blocks, dialogue,
    )

    return {
        "original_yaml": scene_yaml,
        "modified_yaml": modified_yaml,
        "story_blocks": story_blocks,
        "storyboard": storyboard_panels,
        "changes_summary": _analyze_changes(scene_yaml, modified_yaml),
    }


@app.get("/api/studio/whatif/scene/{scene_id}/branches")
def api_whatif_scene_branches(scene_id: str, project_name: str = Query("default")):
    """Get all what-if branches for a specific scene."""
    project_root = get_project_root()
    project_dir = get_project_dir(project_root, project_name)
    try:
        result = subprocess.run(
            ["git", "-C", str(project_dir), "branch", "-a"],
            capture_output=True, text=True, timeout=5,
        )
        branches = []
        for line in (result.stdout or "").splitlines():
            line = line.strip().lstrip("* ").strip()
            if f"whatif/{scene_id}/" in line:
                name = line.split("/")[-1] if "remotes/" in line else line
                branches.append({"name": name, "full_name": line})
        return {"scene_id": scene_id, "branches": branches}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))