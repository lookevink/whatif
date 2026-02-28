"""CLI for the whatif ingestion pipeline."""

import typer
from pathlib import Path

from .config import get_project_root

app = typer.Typer(
    name="whatif",
    help="AI Film Studio — ingest scripts, manage timelines, explore what-ifs",
)


@app.command()
def ingest(
    script_path: Path | None = typer.Argument(
        None,
        help="Path to the raw script (fountain, txt). Required for parse or full pipeline.",
        exists=True,
        path_type=Path,
        resolve_path=True,
    ),
    parse_only: bool = typer.Option(
        False,
        "--parse-only",
        help="Only run the PARSE step",
    ),
    extract_only: bool = typer.Option(
        False,
        "--extract-only",
        help="Only run the EXTRACT step (reads parsed.json)",
    ),
    infer_only: bool = typer.Option(
        False,
        "--infer-only",
        help="Only run the INFER step",
    ),
    envision_only: bool = typer.Option(
        False,
        "--envision-only",
        help="Only run the ENVISION step",
    ),
    skip_envision: bool = typer.Option(
        False,
        "--skip-envision",
        help="Run full pipeline but skip ENVISION step",
    ),
    review: bool = typer.Option(
        False,
        "--review",
        help="Print summary of ingested data after pipeline",
    ),
    commit: bool = typer.Option(
        False,
        "--commit",
        help="Create decision_000, main timeline, git commit and tag v0-ingested",
    ),
):
    """Ingest a screenplay into the studio. Parses, extracts, infers narrative, and optionally envisions production design."""
    project_root = get_project_root()
    typer.echo(f"Project root: {project_root}")

    needs_script = parse_only or (
        not extract_only and not infer_only and not envision_only
    )
    if needs_script and script_path is None:
        typer.echo("Error: script_path is required for parse or full pipeline.", err=True)
        raise typer.Exit(1)
    if script_path is not None:
        typer.echo(f"Script: {script_path}")

    if parse_only:
        from .parse import run_parse
        run_parse(project_root, script_path)
        typer.echo("PARSE complete.")
        raise typer.Exit(0)

    if extract_only:
        from .extract import run_extract
        run_extract(project_root)
        typer.echo("EXTRACT complete.")
        raise typer.Exit(0)

    if infer_only:
        from .infer import run_infer
        run_infer(project_root)
        typer.echo("INFER complete.")
        raise typer.Exit(0)

    if envision_only:
        from .envision import run_envision
        run_envision(project_root)
        typer.echo("ENVISION complete.")
        raise typer.Exit(0)

    # Full pipeline
    from .parse import run_parse
    from .extract import run_extract
    from .infer import run_infer
    from .envision import run_envision
    from .index import reindex

    if script_path is None:
        typer.echo("Error: script_path is required for full pipeline.", err=True)
        raise typer.Exit(1)

    run_parse(project_root, script_path)
    run_extract(project_root)
    run_infer(project_root)
    if not skip_envision:
        run_envision(project_root)
    reindex(project_root)

    if review or commit:
        from .commit import run_review, run_commit
        typer.echo(run_review(project_root))
        if commit:
            run_commit(project_root)
            typer.echo("COMMIT complete: decision_000, main timeline, v0-ingested.")

    typer.echo("Ingestion complete.")


@app.command()
def index(
    project_root: Path | None = typer.Option(
        None,
        "--project-root",
        "-C",
        help="Project root directory",
        path_type=Path,
    ),
):
    """Rebuild the SQLite index from YAML files."""
    root = get_project_root(project_root)
    from .index import reindex
    reindex(root)
    typer.echo("Index rebuilt.")


@app.command()
def project_status(
    project_root: Path | None = typer.Option(
        None,
        "--project-root",
        "-C",
        help="Project root directory",
        path_type=Path,
    ),
):
    """Show project path and whether it has an active git repo."""
    from .config import get_project_dir, get_project_name
    root = get_project_root(project_root)
    project_dir = get_project_dir(root)
    project_name = get_project_name(root)
    typer.echo(f"Project: {project_name}")
    typer.echo(f"Path: {project_dir}")
    git_dir = project_dir / ".git"
    if git_dir.exists() and (git_dir / "HEAD").exists():
        import subprocess
        branch_result = subprocess.run(
            ["git", "branch", "--show-current"],
            cwd=project_dir,
            capture_output=True,
            text=True,
        )
        branch = (branch_result.stdout or "").strip() or "(detached)"
        typer.echo(f"Git: active (branch: {branch})")
        status_result = subprocess.run(
            ["git", "status", "--short"],
            cwd=project_dir,
            capture_output=True,
            text=True,
        )
        if status_result.stdout.strip():
            typer.echo("")
            typer.echo(status_result.stdout.strip())
    else:
        typer.echo("Git: not initialized (run `whatif ingest --commit` to init)")


@app.command()
def review(
    project_root: Path | None = typer.Option(
        None,
        "--project-root",
        "-C",
        help="Project root directory",
        path_type=Path,
    ),
):
    """Print summary of ingested data."""
    root = get_project_root(project_root)
    from .commit import run_review
    typer.echo(run_review(root))


@app.command()
def commit(
    project_root: Path | None = typer.Option(
        None,
        "--project-root",
        "-C",
        help="Project root directory",
        path_type=Path,
    ),
):
    """Create decision_000, main timeline, git commit and tag v0-ingested."""
    root = get_project_root(project_root)
    from .commit import run_commit
    run_commit(root)
    typer.echo("COMMIT complete: decision_000, main timeline, v0-ingested.")


timeline_group = typer.Typer(help="Manage timelines (branches)")
app.add_typer(timeline_group, name="timeline")


@timeline_group.command("switch")
def timeline_switch(
    name: str = typer.Argument(..., help="Timeline/branch name to switch to"),
    project_root: Path | None = typer.Option(
        None,
        "--project-root",
        "-C",
        help="Project root directory",
        path_type=Path,
    ),
):
    """Switch to a timeline (git checkout + index cache logic)."""
    root = get_project_root(project_root)
    from .index import switch_timeline
    switch_timeline(root, name)
    typer.echo(f"Switched to timeline: {name}")


if __name__ == "__main__":
    app()
