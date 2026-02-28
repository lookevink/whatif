"""EXTRACT step: LLM pass 1 — entity extraction."""

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
    get_pipeline_dir,
    get_gemini_api_key,
)
from .schemas import ExtractOutput, ExtractedCharacter, ExtractedScene, ExtractedLocation, ExtractedProp

SCENES_PER_CHUNK = 35


def _load_parsed(project_root: Path) -> dict:
    """Load parsed.json."""
    path = get_script_dir(project_root) / "parsed.json"
    if not path.exists():
        raise FileNotFoundError(f"parsed.json not found at {path}. Run parse step first.")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _load_extractor_prompt(project_root: Path) -> str:
    """Load the extractor system prompt."""
    path = get_pipeline_dir(project_root) / "prompts" / "extractor_system.txt"
    if path.exists():
        return path.read_text(encoding="utf-8")
    # Fallback embedded prompt
    return "You are a script analyst. Extract characters, scenes, locations, and props from the screenplay."


def _condense_scene(scene: dict, max_text_len: int = 400) -> dict:
    """Reduce scene to headings, character names, and truncated text for token efficiency."""
    chars = set()
    action_parts = []
    for el in scene.get("elements", []):
        if el.get("type") == "dialogue" and el.get("character"):
            chars.add(el["character"])
            t = (el.get("text") or "")[:max_text_len]
            if len((el.get("text") or "")) > max_text_len:
                t += "..."
            action_parts.append(f"[{el['character']}]: {t}")
        elif el.get("type") == "action" and el.get("text"):
            t = (el.get("text") or "")[:max_text_len]
            if len((el.get("text") or "")) > max_text_len:
                t += "..."
            action_parts.append(t)
    return {
        "scene_number": scene.get("scene_number"),
        "heading": scene.get("heading", ""),
        "character_names": sorted(chars),
        "content_summary": " ".join(action_parts)[:800],
    }


def _chunk_parsed(parsed: dict) -> list[dict]:
    """Split parsed into chunks of SCENES_PER_CHUNK scenes each."""
    scenes = parsed.get("scenes", [])
    if len(scenes) <= SCENES_PER_CHUNK:
        return [parsed] if scenes else []

    chunks = []
    for i in range(0, len(scenes), SCENES_PER_CHUNK):
        sub = scenes[i : i + SCENES_PER_CHUNK]
        condensed = [_condense_scene(s) for s in sub]
        chunk = {
            "title_page": parsed.get("title_page", {}),
            "characters": parsed.get("characters", []),
            "scenes": condensed,
        }
        chunks.append(chunk)
    return chunks


def _merge_extract_outputs(chunks: list[ExtractOutput], total_scenes: int) -> ExtractOutput:
    """Merge chunk outputs, deduping characters/locations/props."""
    chars_by_id: dict[str, ExtractedCharacter] = {}
    locs_by_id: dict[str, ExtractedLocation] = {}
    props_by_id: dict[str, ExtractedProp] = {}
    scenes: list[ExtractedScene] = []
    seen_scene_orders: set[int] = set()

    for out in chunks:
        for c in out.characters:
            if c.id not in chars_by_id or len(c.description) > len(chars_by_id[c.id].description):
                chars_by_id[c.id] = c
        for loc in out.locations:
            locs_by_id[loc.id] = loc
        for p in out.props:
            props_by_id[p.id] = p
        for s in out.scenes:
            if s.scene_order not in seen_scene_orders:
                seen_scene_orders.add(s.scene_order)
                scenes.append(s)

    # Assign acts by position if needed (some chunks may omit act)
    n = max(total_scenes, 1)
    new_scenes = []
    for s in scenes:
        act = s.act
        if not act or act == "unknown":
            idx = s.scene_order
            if idx <= n * 0.25:
                act = "act1"
            elif idx <= n * 0.75:
                act = "act2"
            else:
                act = "act3"
            s = s.model_copy(update={"act": act})
        new_scenes.append(s)

    new_scenes.sort(key=lambda x: x.scene_order)
    return ExtractOutput(
        characters=list(chars_by_id.values()),
        scenes=new_scenes,
        locations=list(locs_by_id.values()),
        props=list(props_by_id.values()),
    )


def _call_extract_llm(parsed: dict, system_prompt: str, max_output_tokens: int = 65536) -> ExtractOutput:
    """Call Gemini to extract entities."""
    api_key = get_gemini_api_key()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY environment variable is required for EXTRACT step.")

    client = genai.Client(vertexai=False, api_key=api_key)

    user_content = f"""Extract entities from this parsed screenplay. Return valid JSON matching the ExtractOutput schema.

Parsed screenplay:
```json
{json.dumps(parsed, indent=2)}
```

Return ONLY valid JSON with keys: characters, scenes, locations, props. No markdown, no explanation."""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=user_content,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="application/json",
            response_json_schema=ExtractOutput.model_json_schema(),
            temperature=0.2,
            max_output_tokens=max_output_tokens,
        ),
    )

    text = response.text
    if not text:
        raise RuntimeError("Empty response from Gemini.")

    # Strip markdown code blocks if present
    if text.startswith("```"):
        lines = text.strip().split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines)

    return ExtractOutput.model_validate_json(text)


def _write_extract_output(project_root: Path, output: ExtractOutput) -> None:
    """Write all EXTRACT output files."""
    # Characters
    chars_dir = get_characters_dir(project_root)
    for c in output.characters:
        char_dir = chars_dir / c.id
        char_dir.mkdir(parents=True, exist_ok=True)
        profile = {
            "id": c.id,
            "name": c.name,
            "description": c.description,
        }
        (char_dir / "profile.yaml").write_text(
            yaml.dump(profile, default_flow_style=False, allow_unicode=True),
            encoding="utf-8",
        )

    # Locations
    locs_dir = get_world_dir(project_root) / "locations"
    for loc in output.locations:
        loc_dir = locs_dir / loc.id
        loc_dir.mkdir(parents=True, exist_ok=True)
        desc = {
            "id": loc.id,
            "name": loc.name,
            "type": loc.type,
            "description": loc.description,
        }
        (loc_dir / "description.yaml").write_text(
            yaml.dump(desc, default_flow_style=False, allow_unicode=True),
            encoding="utf-8",
        )

    # Props
    props_dir = get_world_dir(project_root) / "props"
    for p in output.props:
        prop_data = {"id": p.id, "name": p.name, "type": p.type}
        (props_dir / f"{p.id}.yaml").write_text(
            yaml.dump(prop_data, default_flow_style=False, allow_unicode=True),
            encoding="utf-8",
        )

    # Scenes: need dialogue and directions from parsed
    parsed = _load_parsed(project_root)
    scenes_data = parsed.get("scenes", [])
    scenes_dir = get_scenes_dir(project_root)

    for ext_scene in output.scenes:
        act_dir = scenes_dir / ext_scene.act
        scene_dir = act_dir / ext_scene.id
        scene_dir.mkdir(parents=True, exist_ok=True)

        # Find matching parsed scene by order
        parsed_scene = None
        for ps in scenes_data:
            if ps.get("scene_number") == ext_scene.scene_order:
                parsed_scene = ps
                break

        # scene.yaml
        scene_yaml = {
            "id": ext_scene.id,
            "act": ext_scene.act,
            "scene_order": ext_scene.scene_order,
            "heading": ext_scene.heading,
            "location_id": ext_scene.location_id,
            "character_ids": ext_scene.character_ids,
            "summary": ext_scene.summary,
        }
        (scene_dir / "scene.yaml").write_text(
            yaml.dump(scene_yaml, default_flow_style=False, allow_unicode=True),
            encoding="utf-8",
        )

        # dialogue.json
        dialogue = []
        directions_parts = []
        if parsed_scene:
            for el in parsed_scene.get("elements", []):
                if el.get("type") == "dialogue":
                    dialogue.append(
                        {
                            "character": el.get("character", ""),
                            "parenthetical": el.get("parenthetical"),
                            "text": el.get("text", ""),
                        }
                    )
                elif el.get("type") == "action" and el.get("text"):
                    directions_parts.append(el["text"])
        (scene_dir / "dialogue.json").write_text(
            json.dumps(dialogue, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

        # directions.md
        (scene_dir / "directions.md").write_text(
            "\n\n".join(directions_parts) if directions_parts else "",
            encoding="utf-8",
        )

    # world/timeline.yaml (skeleton)
    chronology = [
        {"scene_id": s.id, "scene_order": s.scene_order}
        for s in sorted(output.scenes, key=lambda x: x.scene_order)
    ]
    timeline = {"story_span": {"start": "", "end": "", "duration": ""}, "chronology": chronology}
    (get_world_dir(project_root) / "timeline.yaml").write_text(
        yaml.dump(timeline, default_flow_style=False, allow_unicode=True),
        encoding="utf-8",
    )


def run_extract(project_root: Path | None = None) -> None:
    """Extract characters, scenes, locations, props from parsed.json."""
    root = project_root or get_project_root()
    parsed = _load_parsed(root)
    prompt = _load_extractor_prompt(root)
    scenes = parsed.get("scenes", [])
    total = len(scenes)

    if total > SCENES_PER_CHUNK:
        chunks = _chunk_parsed(parsed)
        outputs = []
        for chunk in chunks:
            out = _call_extract_llm(chunk, prompt, max_output_tokens=16384)
            outputs.append(out)
        output = _merge_extract_outputs(outputs, total)
    else:
        output = _call_extract_llm(parsed, prompt)
    _write_extract_output(root, output)
