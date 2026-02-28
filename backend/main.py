import json
import re
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml
from fastapi import Body, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse
from pydantic import BaseModel

from ingestion.config import (
    get_gemini_api_key,
    get_project_root,
    get_project_dir,
    get_script_dir,
    get_scenes_dir,
)

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
    current_branch: str | None = "main"
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
        import google.generativeai as genai

        genai.configure(api_key=gemini_key)
        model = genai.GenerativeModel("gemini-2.5-flash")

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

        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(temperature=0.7, max_output_tokens=1000),
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


def _create_git_branch(branch_name: str, base_branch: str, project_root: Path) -> bool:
    """Create a new git branch in the project repo."""
    try:
        current = subprocess.run(
            ["git", "-C", str(project_root), "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True, text=True, timeout=5,
        ).stdout.strip()

        if current != base_branch:
            subprocess.run(
                ["git", "-C", str(project_root), "checkout", base_branch],
                check=True, capture_output=True, timeout=10,
            )

        subprocess.run(
            ["git", "-C", str(project_root), "checkout", "-b", branch_name],
            check=True, capture_output=True, timeout=10,
        )
        return True
    except subprocess.CalledProcessError:
        try:
            subprocess.run(
                ["git", "-C", str(project_root), "checkout", branch_name],
                check=True, capture_output=True, timeout=10,
            )
            return True
        except subprocess.CalledProcessError as e:
            raise HTTPException(status_code=500, detail=f"Failed to create branch: {e}")


def _commit_whatif_changes(
    branch_name: str,
    what_if_text: str,
    modified_files: list[str],
    project_root: Path,
) -> str | None:
    """Commit what-if changes to the current branch."""
    try:
        for file_path in modified_files:
            subprocess.run(
                ["git", "-C", str(project_root), "add", file_path],
                check=True, capture_output=True, timeout=5,
            )
        commit_msg = f"What-If: {what_if_text}\n\nBranch: {branch_name}\nGenerated by What-If Scene API"
        subprocess.run(
            ["git", "-C", str(project_root), "commit", "-m", commit_msg],
            check=True, capture_output=True, timeout=10,
        )
        result = subprocess.run(
            ["git", "-C", str(project_root), "rev-parse", "HEAD"],
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


@app.post("/api/studio/whatif/scene/create")
async def api_whatif_scene_create(request: WhatIfSceneRequest):
    """Create a what-if branch with AI-modified scene YAML, storyboard, and git commit."""
    project_name = request.project_name or "default"
    project_root = get_project_root()

    # Load current scene
    scene_yaml = _load_scene_yaml(request.scene_id, request.act, project_name)
    dialogue = _load_scene_dialogue(request.scene_id, request.act, project_name)

    # Generate branch name and create git branch
    branch_name = _generate_branch_name(request.scene_id, request.what_if_text)
    _create_git_branch(branch_name, request.current_branch or "main", project_root)

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

    # Commit all changes
    committed_files = [str(scene_path), storyboard_path]
    commit_hash = _commit_whatif_changes(
        branch_name, request.what_if_text, committed_files, project_root,
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
def api_whatif_scene_branches(scene_id: str):
    """Get all what-if branches for a specific scene."""
    project_root = get_project_root()
    try:
        result = subprocess.run(
            ["git", "-C", str(project_root), "branch", "-a"],
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