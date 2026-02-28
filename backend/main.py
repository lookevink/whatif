from pathlib import Path

from fastapi import FastAPI, File, HTTPException, Query, UploadFile

from ingestion.config import get_project_root, get_script_dir

app = FastAPI()

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