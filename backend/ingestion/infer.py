"""INFER step: LLM pass 2 — narrative intelligence."""

import json
from pathlib import Path

import yaml
from pydantic import ValidationError
from google import genai
from google.genai import types

from .config import (
    get_project_root,
    get_script_dir,
    get_characters_dir,
    get_scenes_dir,
    get_world_dir,
    get_storyline_dir,
    get_project_dir,
    get_pipeline_dir,
    get_gemini_api_key,
)
from .schemas import (
    InferNarrativeOutput,
    InferCharacterOutput,
    InferPropsOutput,
    InferEvent,
    InferStructure,
    ActStructure,
    Theme,
    Subplot,
    ScenePacing,
)


def _load_parsed(project_root: Path) -> dict:
    path = get_script_dir(project_root) / "parsed.json"
    if not path.exists():
        raise FileNotFoundError(f"parsed.json not found. Run parse step first.")
    return json.loads(path.read_text(encoding="utf-8"))


def _load_extract_context(project_root: Path) -> dict:
    """Load characters, scenes, locations, props from EXTRACT output."""
    ctx = {"characters": [], "scenes": [], "locations": [], "props": []}

    chars_dir = get_characters_dir(project_root)
    for char_dir in sorted(chars_dir.iterdir()):
        if char_dir.is_dir():
            p = char_dir / "profile.yaml"
            if p.exists():
                try:
                    ctx["characters"].append(yaml.safe_load(p.read_text(encoding="utf-8")))
                except Exception:
                    pass

    scenes_dir = get_scenes_dir(project_root)
    for act_dir in sorted(scenes_dir.iterdir()):
        if act_dir.is_dir():
            for scene_dir in sorted(act_dir.iterdir()):
                if scene_dir.is_dir():
                    p = scene_dir / "scene.yaml"
                    if p.exists():
                        try:
                            ctx["scenes"].append(yaml.safe_load(p.read_text(encoding="utf-8")))
                        except Exception:
                            pass

    locs_dir = get_world_dir(project_root) / "locations"
    if locs_dir.exists():
        for loc_dir in sorted(locs_dir.iterdir()):
            if loc_dir.is_dir():
                p = loc_dir / "description.yaml"
                if p.exists():
                    try:
                        ctx["locations"].append(yaml.safe_load(p.read_text(encoding="utf-8")))
                    except Exception:
                        pass

    props_dir = get_world_dir(project_root) / "props"
    if props_dir.exists():
        for p in sorted(props_dir.glob("*.yaml")):
            try:
                ctx["props"].append(yaml.safe_load(p.read_text(encoding="utf-8")))
            except Exception:
                pass

    return ctx


def _load_inferrer_prompt(project_root: Path) -> str:
    path = get_pipeline_dir(project_root) / "prompts" / "inferrer_system.txt"
    if path.exists():
        return path.read_text(encoding="utf-8")
    return "You are a narrative analyst. Infer events, structure, pacing, character voice/knowledge/arc, prop lifecycles."


SCENES_PER_INFER_CHUNK = 20


def _condense_scene_for_infer(scene: dict) -> dict:
    """Lightweight scene for infer input."""
    chars = set()
    for el in scene.get("elements", []):
        if el.get("type") == "dialogue" and el.get("character"):
            chars.add(el["character"])
        elif el.get("type") == "action" and el.get("text"):
            t = (el.get("text") or "")[:300]
            if len((el.get("text") or "")) > 300:
                t += "..."
    return {
        "scene_number": scene.get("scene_number"),
        "heading": scene.get("heading", ""),
        "character_names": sorted(chars),
        "content": " ".join(
            (e.get("text") or "")[:200] for e in scene.get("elements", [])
        )[:500],
    }


def _chunk_narrative_input(parsed: dict, extract_ctx: dict) -> list[tuple[dict, dict]]:
    """Yield (parsed_chunk, extract_chunk) for narrative inference."""
    scenes = parsed.get("scenes", [])
    ext_scenes = sorted(
        [s for s in extract_ctx.get("scenes", []) if isinstance(s, dict)],
        key=lambda x: x.get("scene_order", 0),
    )
    if len(scenes) <= SCENES_PER_INFER_CHUNK:
        return [(parsed, extract_ctx)]

    chunks = []
    for i in range(0, len(scenes), SCENES_PER_INFER_CHUNK):
        sub_scenes = scenes[i : i + SCENES_PER_INFER_CHUNK]
        scene_numbers = {s.get("scene_number") for s in sub_scenes}
        condensed = [_condense_scene_for_infer(s) for s in sub_scenes]
        ext_sub = [s for s in ext_scenes if s.get("scene_order") in scene_numbers]
        char_ids = set()
        for s in ext_sub:
            char_ids.update(s.get("character_ids", []))
        parsed_chunk = {
            "title_page": parsed.get("title_page", {}),
            "characters": parsed.get("characters", []),
            "scenes": condensed,
        }
        ext_chunk = {
            "characters": [c for c in extract_ctx.get("characters", []) if c.get("id") in char_ids],
            "scenes": ext_sub,
            "locations": extract_ctx.get("locations", []),
            "props": extract_ctx.get("props", []),
        }
        chunks.append((parsed_chunk, ext_chunk))
    return chunks


def _merge_narrative_chunks(chunks: list[InferNarrativeOutput], total_scenes: int) -> InferNarrativeOutput:
    """Merge chunk outputs into one InferNarrativeOutput."""
    events: list[InferEvent] = []
    seen_evt_ids: set[str] = set()
    acts_merged: dict[str, ActStructure] = {}
    all_themes: list[Theme] = []
    theme_ids: set[str] = set()
    all_subplots: list[Subplot] = []
    subplot_ids: set[str] = set()
    pacing_merged: dict[str, ScenePacing] = {}

    for out in chunks:
        for e in out.events:
            if e.id not in seen_evt_ids:
                seen_evt_ids.add(e.id)
                events.append(e)
        for k, v in (out.structure.acts or {}).items():
            if k not in acts_merged:
                acts_merged[k] = v
            else:
                existing = acts_merged[k]
                acts_merged[k] = ActStructure(
                    label=v.label or existing.label,
                    scenes=list(dict.fromkeys(existing.scenes + v.scenes)),
                    events=list(dict.fromkeys(existing.events + v.events)),
                    arc_phase=v.arc_phase or existing.arc_phase,
                    tension_curve=existing.tension_curve or v.tension_curve,
                )
        for t in out.structure.themes or []:
            if t.id not in theme_ids:
                theme_ids.add(t.id)
                all_themes.append(t)
        for s in out.structure.subplots or []:
            if s.id not in subplot_ids:
                subplot_ids.add(s.id)
                all_subplots.append(s)
        for k, v in (out.pacing or {}).items():
            pacing_merged[k] = v

    events.sort(key=lambda x: x.story_order)
    return InferNarrativeOutput(
        events=events,
        structure=InferStructure(acts=acts_merged, themes=all_themes, subplots=all_subplots),
        pacing=pacing_merged,
    )


def _call_infer_narrative(
    parsed: dict,
    extract_ctx: dict,
    system_prompt: str,
    max_output_tokens: int = 65536,
) -> InferNarrativeOutput:
    api_key = get_gemini_api_key()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY required. Set in backend/.env or environment.")

    client = genai.Client(vertexai=False, api_key=api_key)
    parsed_str = json.dumps(parsed, indent=2)
    ext_str = json.dumps(extract_ctx, indent=2)
    if len(parsed_str) > 20000:
        parsed_str = parsed_str[:20000] + "\n... (truncated)"
    if len(ext_str) > 12000:
        ext_str = ext_str[:12000] + "\n... (truncated)"

    user_content = f"""Infer narrative structure from this screenplay. Return valid JSON.

Parsed:
{parsed_str}

Extract context:
{ext_str}

Return InferNarrativeOutput: events (list), structure (acts, themes, subplots), pacing (per scene_id).
Use scene ids and character ids from extract context. If extract is empty, infer minimal structure from parsed."""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=user_content,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="application/json",
            response_json_schema=InferNarrativeOutput.model_json_schema(),
            temperature=0.2,
            max_output_tokens=max_output_tokens,
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
    return InferNarrativeOutput.model_validate_json(text)


def _call_infer_narrative_with_retry(
    parsed: dict,
    extract_ctx: dict,
    system_prompt: str,
    max_output_tokens: int = 65536,
    min_scenes_to_split: int = 5,
) -> InferNarrativeOutput:
    """Call narrative inference with retry on truncated JSON."""
    try:
        return _call_infer_narrative(parsed, extract_ctx, system_prompt, max_output_tokens)
    except ValidationError as e:
        err_str = str(e).lower()
        is_truncation = "json_invalid" in err_str or "eof" in err_str or "unexpected end" in err_str
        scenes = parsed.get("scenes", [])
        if not is_truncation or len(scenes) < min_scenes_to_split:
            raise

        # Retry with smaller chunks: split this input in half
        mid = len(scenes) // 2
        ext_scenes = extract_ctx.get("scenes", [])
        scene_numbers_lo = {s.get("scene_number") for s in scenes[:mid]}
        scene_numbers_hi = {s.get("scene_number") for s in scenes[mid:]}
        ext_lo = [s for s in ext_scenes if isinstance(s, dict) and s.get("scene_order") in scene_numbers_lo]
        ext_hi = [s for s in ext_scenes if isinstance(s, dict) and s.get("scene_order") in scene_numbers_hi]
        char_ids_lo = set()
        for s in ext_lo:
            char_ids_lo.update(s.get("character_ids", []))
        char_ids_hi = set()
        for s in ext_hi:
            char_ids_hi.update(s.get("character_ids", []))

        parsed_lo = {
            "title_page": parsed.get("title_page", {}),
            "characters": parsed.get("characters", []),
            "scenes": scenes[:mid],
        }
        parsed_hi = {
            "title_page": parsed.get("title_page", {}),
            "characters": parsed.get("characters", []),
            "scenes": scenes[mid:],
        }
        ext_lo_dict = {
            "characters": [c for c in extract_ctx.get("characters", []) if c.get("id") in char_ids_lo],
            "scenes": ext_lo,
            "locations": extract_ctx.get("locations", []),
            "props": extract_ctx.get("props", []),
        }
        ext_hi_dict = {
            "characters": [c for c in extract_ctx.get("characters", []) if c.get("id") in char_ids_hi],
            "scenes": ext_hi,
            "locations": extract_ctx.get("locations", []),
            "props": extract_ctx.get("props", []),
        }

        out_lo = _call_infer_narrative(parsed_lo, ext_lo_dict, system_prompt, max_output_tokens)
        out_hi = _call_infer_narrative(parsed_hi, ext_hi_dict, system_prompt, max_output_tokens)
        return _merge_narrative_chunks([out_lo, out_hi], len(scenes))


def _call_infer_characters(
    parsed: dict, extract_ctx: dict, events: list, system_prompt: str
) -> InferCharacterOutput:
    api_key = get_gemini_api_key()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY required.")

    client = genai.Client(vertexai=False, api_key=api_key)
    events_summary = [{"id": e.id, "label": e.label, "characters_present": e.characters_present} for e in events]
    user_content = f"""Infer per-character voice, relationships, knowledge, arc.

Parsed (abridged):
{json.dumps({"scenes": parsed.get("scenes", [])[:5], "characters": parsed.get("characters", [])}, indent=2)[:6000]}

Extract characters:
{json.dumps(extract_ctx.get("characters", []), indent=2)}

Events:
{json.dumps(events_summary[:20], indent=2)}

Return InferCharacterOutput with characters array. Each has character_id, voice, relationships, knowledge, arc."""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=user_content,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="application/json",
            response_json_schema=InferCharacterOutput.model_json_schema(),
            temperature=0.2,
            max_output_tokens=16384,
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
    return InferCharacterOutput.model_validate_json(text)


def _call_infer_props(extract_ctx: dict, events: list, system_prompt: str) -> InferPropsOutput:
    api_key = get_gemini_api_key()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY required.")

    client = genai.Client(vertexai=False, api_key=api_key)
    events_summary = [{"id": e.id, "label": e.label} for e in events]
    user_content = f"""Infer prop lifecycles and world rules.

Props: {json.dumps(extract_ctx.get("props", []), indent=2)}
Events: {json.dumps(events_summary[:30], indent=2)}

Return InferPropsOutput: props (with lifecycle), world_rules (list of strings), knowledge_rules (dict)."""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=user_content,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="application/json",
            response_json_schema=InferPropsOutput.model_json_schema(),
            temperature=0.2,
            max_output_tokens=16384,
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
    return InferPropsOutput.model_validate_json(text)


def _write_infer_output(
    project_root: Path,
    narrative: InferNarrativeOutput,
    characters: InferCharacterOutput,
    props_out: InferPropsOutput,
) -> None:
    storyline_dir = get_storyline_dir(project_root)
    storyline_dir.mkdir(parents=True, exist_ok=True)
    events_dir = storyline_dir / "events"
    events_dir.mkdir(parents=True, exist_ok=True)

    for evt in narrative.events:
        evt_data = {
            "id": evt.id,
            "label": evt.label,
            "scene": evt.scene_id,
            "story_order": evt.story_order,
            "beat": evt.beat,
            "type": evt.type,
            "timestamp_story": evt.timestamp_story,
            "characters_present": evt.characters_present,
            "characters_aware_after": evt.characters_aware_after,
            "characters_unaware": evt.characters_unaware,
            "world_state_changes": [{"key": c.key, "value": c.value} for c in evt.world_state_changes],
            "emotional_shifts": {
                k: {
                    "before": v.before.model_dump(),
                    "after": v.after.model_dump(),
                }
                for k, v in evt.emotional_shifts.items()
            },
            "triggers": evt.triggers,
            "enables": evt.enables,
        }
        (events_dir / f"{evt.id}.yaml").write_text(
            yaml.dump(evt_data, default_flow_style=False, allow_unicode=True),
            encoding="utf-8",
        )

    structure_data = {
        "acts": {
            k: {
                "label": v.label,
                "scenes": v.scenes,
                "events": v.events,
                "arc_phase": v.arc_phase,
                "tension_curve": v.tension_curve,
            }
            for k, v in narrative.structure.acts.items()
        },
        "themes": [{"id": t.id, "label": t.label, "key_events": t.key_events} for t in narrative.structure.themes],
        "subplots": [
            {"id": s.id, "label": s.label, "events": s.events, "intersects_main": s.intersects_main}
            for s in narrative.structure.subplots
        ],
    }
    (storyline_dir / "structure.yaml").write_text(
        yaml.dump(structure_data, default_flow_style=False, allow_unicode=True),
        encoding="utf-8",
    )

    pacing_data = {"scenes": {k: v.model_dump() for k, v in narrative.pacing.items()}}
    (storyline_dir / "pacing.yaml").write_text(
        yaml.dump(pacing_data, default_flow_style=False, allow_unicode=True),
        encoding="utf-8",
    )

    chars_dir = get_characters_dir(project_root)
    for char in characters.characters:
        char_dir = chars_dir / char.character_id
        char_dir.mkdir(parents=True, exist_ok=True)
        (char_dir / "voice.yaml").write_text(
            yaml.dump({"speech_patterns": char.voice.model_dump()}, default_flow_style=False, allow_unicode=True),
            encoding="utf-8",
        )
        (char_dir / "relationships.yaml").write_text(
            yaml.dump(
                {"relationships": {k: {"type": v.type, "evolution": v.evolution} for k, v in char.relationships.items()}},
                default_flow_style=False,
                allow_unicode=True,
            ),
            encoding="utf-8",
        )
        (char_dir / "knowledge.yaml").write_text(
            yaml.dump(
                {
                    "knows": [f.model_dump() for f in char.knowledge.knows],
                    "does_not_know": [f.model_dump() for f in char.knowledge.does_not_know],
                    "beliefs": [b.model_dump() for b in char.knowledge.beliefs],
                    "secrets_held": [s.model_dump() for s in char.knowledge.secrets_held],
                },
                default_flow_style=False,
                allow_unicode=True,
            ),
            encoding="utf-8",
        )
        (char_dir / "arc.yaml").write_text(
            yaml.dump(
                {"type": char.arc.type, "from": char.arc.from_state, "to": char.arc.to_state, "turning_point": char.arc.turning_point},
                default_flow_style=False,
                allow_unicode=True,
            ),
            encoding="utf-8",
        )

    props_dir = get_world_dir(project_root) / "props"
    props_dir.mkdir(parents=True, exist_ok=True)
    for p in props_out.props:
        prop_path = props_dir / f"{p.prop_id}.yaml"
        existing = {}
        if prop_path.exists():
            try:
                existing = yaml.safe_load(prop_path.read_text(encoding="utf-8")) or {}
            except Exception:
                pass
        existing["lifecycle"] = [
            {"event": e.event, "action": e.action, "location": e.location, "character": e.character, "visibility": e.visibility}
            for e in p.lifecycle
        ]
        existing["symbolic_weight"] = p.symbolic_weight
        existing["represents"] = p.represents
        prop_path.write_text(
            yaml.dump(existing, default_flow_style=False, allow_unicode=True),
            encoding="utf-8",
        )

    (get_world_dir(project_root) / "rules.yaml").write_text(
        yaml.dump({"rules": props_out.world_rules}, default_flow_style=False, allow_unicode=True),
        encoding="utf-8",
    )

    project_dir = get_project_dir(project_root)
    (project_dir / "knowledge_rules.yaml").write_text(
        yaml.dump(props_out.knowledge_rules, default_flow_style=False, allow_unicode=True),
        encoding="utf-8",
    )


def run_infer(project_root: Path | None = None) -> None:
    """Infer events, structure, knowledge, relationships."""
    root = project_root or get_project_root()
    parsed = _load_parsed(root)
    extract_ctx = _load_extract_context(root)
    prompt = _load_inferrer_prompt(root)
    scenes = parsed.get("scenes", [])
    total_scenes = len(scenes)

    if total_scenes > SCENES_PER_INFER_CHUNK:
        chunks = _chunk_narrative_input(parsed, extract_ctx)
        outputs = []
        for parsed_chunk, ext_chunk in chunks:
            out = _call_infer_narrative_with_retry(
                parsed_chunk, ext_chunk, prompt, max_output_tokens=65536
            )
            outputs.append(out)
        narrative = _merge_narrative_chunks(outputs, total_scenes)
    else:
        narrative = _call_infer_narrative_with_retry(parsed, extract_ctx, prompt)

    characters = _call_infer_characters(parsed, extract_ctx, narrative.events, prompt)
    props_out = _call_infer_props(extract_ctx, narrative.events, prompt)

    _write_infer_output(root, narrative, characters, props_out)
