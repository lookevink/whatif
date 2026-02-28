"""Configuration for the ingestion pipeline."""

import os
from pathlib import Path

# Load .env from backend/ so GEMINI_API_KEY etc. are available.
# override=True ensures .env wins over shell env (e.g. stale GEMINI_API_KEY).
_env_path = Path(__file__).resolve().parent.parent / ".env"
if _env_path.exists():
    from dotenv import load_dotenv
    load_dotenv(_env_path, override=True)


def get_project_root(override: Path | None = None) -> Path:
    """Return the workspace root. Checks WHATIF_PROJECT_ROOT env first."""
    if override is not None:
        return override.resolve()
    env_root = os.environ.get("WHATIF_PROJECT_ROOT")
    if env_root:
        return Path(env_root).resolve()
    # Default: assume we're in backend/ingestion/ and go up to workspace root
    return Path(__file__).resolve().parent.parent.parent


def get_project_name(project_root: Path) -> str:
    """Return the current project name/slug. From project.yaml or env, default 'default'."""
    name = os.environ.get("WHATIF_PROJECT")
    if name:
        return name
    project_file = project_root / "project.yaml"
    if project_file.exists():
        try:
            import yaml
            data = yaml.safe_load(project_file.read_text(encoding="utf-8"))
            if data and isinstance(data.get("name"), str):
                return data["name"]
        except Exception:
            pass
    return "default"


def get_project_dir(project_root: Path, project_name: str | None = None) -> Path:
    """Return .studio/projects/<project_name>/ — all project data lives here."""
    if project_name is None:
        project_name = get_project_name(project_root)
    return project_root / ".studio" / "projects" / project_name


def get_script_dir(project_root: Path, project_name: str | None = None) -> Path:
    """Return the script directory within the project."""
    return get_project_dir(project_root, project_name) / "script"


def get_characters_dir(project_root: Path, project_name: str | None = None) -> Path:
    """Return the characters directory."""
    return get_project_dir(project_root, project_name) / "characters"


def get_scenes_dir(project_root: Path, project_name: str | None = None) -> Path:
    """Return the scenes directory."""
    return get_project_dir(project_root, project_name) / "scenes"


def get_world_dir(project_root: Path, project_name: str | None = None) -> Path:
    """Return the world directory."""
    return get_project_dir(project_root, project_name) / "world"


def get_studio_dir(project_root: Path) -> Path:
    """Return the .studio directory (engine internals)."""
    return project_root / ".studio"


def get_studio_cache_dir(project_root: Path) -> Path:
    """Return the .studio/cache directory for per-branch index cache (legacy; prefer project cache)."""
    return project_root / ".studio" / "cache"


def get_project_index_path(project_root: Path, project_name: str | None = None) -> Path:
    """Return project_dir/index.db — index lives inside the project."""
    return get_project_dir(project_root, project_name) / "index.db"


def get_project_cache_dir(project_root: Path, project_name: str | None = None) -> Path:
    """Return project_dir/cache/ — per-branch index cache inside the project."""
    return get_project_dir(project_root, project_name) / "cache"


def get_pipeline_dir(project_root: Path, project_name: str | None = None) -> Path:
    """Return the pipeline directory."""
    return get_project_dir(project_root, project_name) / "pipeline"


def get_assets_dir(project_root: Path, project_name: str | None = None) -> Path:
    """Return the assets directory."""
    return get_project_dir(project_root, project_name) / "assets"


def get_storyline_dir(project_root: Path, project_name: str | None = None) -> Path:
    """Return the storyline directory."""
    return get_project_dir(project_root, project_name) / "storyline"


def get_decisions_dir(project_root: Path, project_name: str | None = None) -> Path:
    """Return the decisions directory."""
    return get_project_dir(project_root, project_name) / "decisions"


def get_timelines_dir(project_root: Path, project_name: str | None = None) -> Path:
    """Return the timelines directory."""
    return get_project_dir(project_root, project_name) / "timelines"


def get_gemini_api_key() -> str | None:
    """Return GEMINI_API_KEY from environment."""
    return os.environ.get("GEMINI_API_KEY")
