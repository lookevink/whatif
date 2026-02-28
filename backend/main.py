from pathlib import Path

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse

from ingestion.config import (
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


@app.get("/api/studio/projects/{project_name}/files/{file_path:path}")
def api_studio_file(project_name: str, file_path: str):
    """Serve a project file (yaml, json, md, etc.)."""
    try:
        resolved = _resolve_project_file(project_name, file_path)
    except HTTPException:
        raise
    if not resolved.exists() or not resolved.is_file():
        raise HTTPException(status_code=404, detail=f"File not found: {file_path}")
    content = resolved.read_text(encoding="utf-8")
    suffix = resolved.suffix.lower()
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