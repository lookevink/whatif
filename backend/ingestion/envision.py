"""ENVISION step: LLM pass 3 — production design."""

import json
from pathlib import Path

import yaml
from google import genai
from google.genai import types

from .config import (
    get_project_root,
    get_script_dir,
    get_characters_dir,
    get_scenes_dir,
    get_world_dir,
    get_assets_dir,
    get_pipeline_dir,
    get_storyline_dir,
    get_gemini_api_key,
)
from .schemas import (
    EnvisionGlobalStyle,
    EnvisionSceneProduction,
    EnvisionCharacterVisual,
    EnvisionLocationVisual,
    EnvisionAudioCatalog,
)


def _load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def _load_yaml(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        return yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except Exception:
        return {}


def _load_context(project_root: Path) -> dict:
    parsed = _load_json(get_script_dir(project_root) / "parsed.json")
    structure = _load_yaml(get_storyline_dir(project_root) / "structure.yaml")
    pacing = _load_yaml(get_storyline_dir(project_root) / "pacing.yaml")

    scenes = []
    scenes_dir = get_scenes_dir(project_root)
    for act_dir in sorted(scenes_dir.iterdir()) if scenes_dir.exists() else []:
        if act_dir.is_dir():
            for scene_dir in sorted(act_dir.iterdir()):
                if scene_dir.is_dir():
                    s = _load_yaml(scene_dir / "scene.yaml")
                    if s:
                        s["_path"] = str(scene_dir)
                        scenes.append(s)

    characters = []
    chars_dir = get_characters_dir(project_root)
    for char_dir in sorted(chars_dir.iterdir()) if chars_dir.exists() else []:
        if char_dir.is_dir():
            p = _load_yaml(char_dir / "profile.yaml")
            if p:
                p["_id"] = char_dir.name
                characters.append(p)

    locations = []
    locs_dir = get_world_dir(project_root) / "locations"
    for loc_dir in sorted(locs_dir.iterdir()) if locs_dir.exists() else []:
        if loc_dir.is_dir():
            d = _load_yaml(loc_dir / "description.yaml")
            if d:
                d["_id"] = loc_dir.name
                locations.append(d)

    return {
        "parsed": parsed,
        "structure": structure,
        "pacing": pacing,
        "scenes": scenes,
        "characters": characters,
        "locations": locations,
    }


def _load_prompt(project_root: Path) -> str:
    p = get_pipeline_dir(project_root) / "prompts" / "envision_system.txt"
    return p.read_text(encoding="utf-8") if p.exists() else "You are a cinematographer. Design production."


def _call_llm(content: str, system: str, schema: type) -> any:
    api_key = get_gemini_api_key()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY required.")
    client = genai.Client(vertexai=False, api_key=api_key)
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=content,
        config=types.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json",
            temperature=0.4,
        ),
    )
    text = response.text or ""
    if text.startswith("```"):
        lines = text.strip().split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines)
    return schema.model_validate_json(text)


def _write_envision_output(
    project_root: Path,
    style: EnvisionGlobalStyle,
    scene_productions: list[EnvisionSceneProduction],
    char_visuals: list[EnvisionCharacterVisual],
    loc_visuals: list[EnvisionLocationVisual],
    audio_catalog: EnvisionAudioCatalog,
) -> None:
    (get_assets_dir(project_root) / "style").mkdir(parents=True, exist_ok=True)
    style_data = {
        "visual_style": {
            "reference_films": style.reference_films,
            "color_palette": style.color_palette,
            "grade": style.grade,
            "aspect_ratio": style.aspect_ratio,
            "era_accuracy": style.era_accuracy,
        }
    }
    (get_assets_dir(project_root) / "style" / "global.yaml").write_text(
        yaml.dump(style_data, default_flow_style=False, allow_unicode=True),
        encoding="utf-8",
    )

    for sp in scene_productions:
        scenes_dir = get_scenes_dir(project_root)
        for act_dir in sorted(scenes_dir.iterdir()) if scenes_dir.exists() else []:
            if act_dir.is_dir():
                scene_dir = act_dir / sp.scene_id
                if scene_dir.exists():
                    cam = {
                        "shots": [s.model_dump() for s in sp.camera.shots],
                        "shot_sequence": sp.camera.shot_sequence,
                    }
                    (scene_dir / "camera.yaml").write_text(
                        yaml.dump(cam, default_flow_style=False, allow_unicode=True),
                        encoding="utf-8",
                    )
                    (scene_dir / "lighting.yaml").write_text(
                        yaml.dump(sp.lighting.model_dump(), default_flow_style=False, allow_unicode=True),
                        encoding="utf-8",
                    )
                    (scene_dir / "blocking.yaml").write_text(
                        yaml.dump(sp.blocking.model_dump(), default_flow_style=False, allow_unicode=True),
                        encoding="utf-8",
                    )
                    (scene_dir / "audio.yaml").write_text(
                        yaml.dump(sp.audio, default_flow_style=False, allow_unicode=True),
                        encoding="utf-8",
                    )
                    break

    for cv in char_visuals:
        char_dir = get_characters_dir(project_root) / cv.character_id
        if char_dir.exists():
            (char_dir / "assets").mkdir(parents=True, exist_ok=True)
            vis = {"appearance": cv.appearance, "wardrobe": cv.wardrobe, "reference_images": [], "consistency_anchor": None}
            (char_dir / "assets" / "visual.yaml").write_text(
                yaml.dump(vis, default_flow_style=False, allow_unicode=True),
                encoding="utf-8",
            )

    for lv in loc_visuals:
        loc_dir = get_world_dir(project_root) / "locations" / lv.location_id
        if loc_dir.exists():
            (loc_dir / "assets").mkdir(parents=True, exist_ok=True)
            vis = {
                "skybox": {"generation_prompt": lv.skybox_prompt, "generated": None, "approved": False},
                "set_dressing": lv.set_dressing,
                "color_notes": lv.color_notes,
            }
            (loc_dir / "assets" / "visual.yaml").write_text(
                yaml.dump(vis, default_flow_style=False, allow_unicode=True),
                encoding="utf-8",
            )

    (get_assets_dir(project_root) / "audio").mkdir(parents=True, exist_ok=True)
    (get_assets_dir(project_root) / "audio" / "catalog.yaml").write_text(
        yaml.dump(audio_catalog.model_dump(), default_flow_style=False, allow_unicode=True),
        encoding="utf-8",
    )

    pipeline_config = {
        "models": {
            "storyboard": {"provider": "flux"},
            "video": {"provider": "runway"},
            "actor_llm": {"provider": "google", "model": "gemini-2.5-flash"},
            "dp_llm": {"provider": "google", "model": "gemini-2.5-flash"},
        },
        "generation_queue": {"max_concurrent": 3},
    }
    (get_pipeline_dir(project_root) / "config.yaml").write_text(
        yaml.dump(pipeline_config, default_flow_style=False, allow_unicode=True),
        encoding="utf-8",
    )


def run_envision(project_root: Path | None = None) -> None:
    """Generate camera, lighting, blocking, audio, style, asset catalogs."""
    root = project_root or get_project_root()
    ctx = _load_context(root)
    prompt = _load_prompt(root)

    content = f"""Design production for this screenplay. Return JSON.

Context:
{json.dumps({k: v for k, v in ctx.items() if k != "parsed" or len(str(v)) < 15000}, indent=2)[:20000]}

Return EnvisionGlobalStyle: reference_films, color_palette, grade, aspect_ratio, era_accuracy."""

    style = _call_llm(content, prompt, EnvisionGlobalStyle)

    scene_ids = [s.get("id", "") for s in ctx["scenes"] if s.get("id")]
    scene_productions = []
    for sid in scene_ids[:10]:  # Limit for token
        c = f"""Scene {sid}. Design camera, lighting, blocking, audio. Return EnvisionSceneProduction with scene_id="{sid}"."""
        sp = _call_llm(c, prompt, EnvisionSceneProduction)
        sp.scene_id = sid
        scene_productions.append(sp)

    char_ids = [c.get("id", c.get("_id", "")) for c in ctx["characters"] if c.get("id") or c.get("_id")]
    char_visuals = []
    for cid in char_ids:
        cv = EnvisionCharacterVisual(character_id=cid)
        try:
            cv = _call_llm(
                f"Character {cid}. Return EnvisionCharacterVisual with character_id, appearance, wardrobe.",
                prompt,
                EnvisionCharacterVisual,
            )
        except Exception:
            pass
        char_visuals.append(cv)

    loc_ids = [l.get("id", l.get("_id", "")) for l in ctx["locations"] if l.get("id") or l.get("_id")]
    loc_visuals = []
    for lid in loc_ids:
        lv = EnvisionLocationVisual(location_id=lid)
        try:
            lv = _call_llm(
                f"Location {lid}. Return EnvisionLocationVisual with skybox_prompt, set_dressing, color_notes.",
                prompt,
                EnvisionLocationVisual,
            )
        except Exception:
            pass
        loc_visuals.append(lv)

    audio_catalog = _call_llm(
        "Return EnvisionAudioCatalog: ambient_beds, sound_effects, music_cues.",
        prompt,
        EnvisionAudioCatalog,
    )

    _write_envision_output(root, style, scene_productions, char_visuals, loc_visuals, audio_catalog)
