"""PARSE step: deterministic script parsing. No LLM."""

import json
import shutil
import re
from pathlib import Path

from jouvence.parser import JouvenceParser
from jouvence.document import (
    TYPE_ACTION,
    TYPE_CENTEREDACTION,
    TYPE_CHARACTER,
    TYPE_DIALOG,
    TYPE_PARENTHETICAL,
    TYPE_TRANSITION,
    TYPE_SECTION,
    TYPE_SYNOPSIS,
)

from .config import get_script_dir
from .schemas import ParsedScript, ParsedScene, SceneElement, TitlePage


def _parse_title_values(title_values: dict) -> TitlePage:
    """Convert Jouvence title_values to our TitlePage model."""
    key_map = {
        "title": "title",
        "author": "author",
        "credit": "credit",
        "source": "source",
        "date": "draft_date",
        "contact": "contact",
    }
    data = {k: str(v) for k, v in title_values.items() if v}
    return TitlePage(
        title=data.get("title", ""),
        author=data.get("author", ""),
        credit=data.get("credit", ""),
        source=data.get("source", ""),
        draft_date=data.get("date", ""),
        contact=data.get("contact", ""),
        extra={k: str(v) for k, v in data.items() if k not in key_map},
    )


def _element_type_to_str(el_type: int) -> str:
    """Map Jouvence element type to our string type."""
    mapping = {
        TYPE_ACTION: "action",
        TYPE_CENTEREDACTION: "centered_action",
        TYPE_CHARACTER: "character",
        TYPE_DIALOG: "dialogue",
        TYPE_PARENTHETICAL: "parenthetical",
        TYPE_TRANSITION: "transition",
        TYPE_SECTION: "section",
        TYPE_SYNOPSIS: "synopsis",
    }
    return mapping.get(el_type, "action")


def _convert_jouvence_to_parsed(jouvence_doc) -> ParsedScript:
    """Convert a Jouvence document to our ParsedScript schema."""
    # Parse title page from first scene if it has no header and looks like title content
    title_page = _parse_title_values(getattr(jouvence_doc, "title_values", {}) or {})

    # If title_values is empty, try to extract from first scene's action (Jouvence sometimes puts it there)
    scenes = []
    character_set = set()
    scene_num = 0

    for jouvence_scene in jouvence_doc.scenes:
        header = jouvence_scene.header

        # Skip "scenes" that are really title page content (no proper scene heading)
        if header is None and jouvence_scene.paragraphs:
            first = jouvence_scene.paragraphs[0]
            if first.type == TYPE_ACTION and first.text:
                # Check if it looks like title page (Title:, Author:, etc.)
                if re.search(r"^(Title|Author|Credit|Source|Date|Contact):", first.text, re.I | re.M):
                    for line in first.text.strip().split("\n"):
                        if ":" in line:
                            key, _, val = line.partition(":")
                            key = key.strip().lower()
                            val = val.strip()
                            if key == "title":
                                title_page.title = val
                            elif key == "author":
                                title_page.author = val
                            elif key == "credit":
                                title_page.credit = val
                            elif key == "source":
                                title_page.source = val
                            elif key == "date":
                                title_page.draft_date = val
                            elif key == "contact":
                                title_page.contact = val
                            else:
                                title_page.extra[key] = val
            continue

        # Skip scenes with no header (orphaned content)
        if header is None:
            continue

        elements = []
        current_character = None
        current_parenthetical = None

        for p in jouvence_scene.paragraphs:
            if p.type == TYPE_CHARACTER:
                current_character = (p.text or "").strip()
                current_parenthetical = None
                character_set.add(current_character)
            elif p.type == TYPE_DIALOG:
                elements.append(
                    SceneElement(
                        type="dialogue",
                        text=(p.text or "").strip(),
                        character=current_character,
                        parenthetical=current_parenthetical,
                    )
                )
                current_parenthetical = None
            elif p.type == TYPE_PARENTHETICAL:
                current_parenthetical = (p.text or "").strip()
            elif p.type == TYPE_ACTION:
                elements.append(SceneElement(type="action", text=(p.text or "").strip()))
            elif p.type == TYPE_CENTEREDACTION:
                elements.append(
                    SceneElement(type="centered_action", text=(p.text or "").strip())
                )
            elif p.type == TYPE_TRANSITION:
                elements.append(
                    SceneElement(type="transition", text=(p.text or "").strip())
                )
            elif p.type == TYPE_SECTION:
                elements.append(
                    SceneElement(type="section", text=(p.text or "").strip())
                )
            elif p.type == TYPE_SYNOPSIS:
                elements.append(
                    SceneElement(type="synopsis", text=(p.text or "").strip())
                )

        scene_num += 1
        scenes.append(
            ParsedScene(
                scene_number=scene_num,
                heading=header,
                elements=elements,
            )
        )

    return ParsedScript(
        title_page=title_page,
        scenes=scenes,
        characters=sorted(character_set),
    )


def _extract_text_from_pdf(pdf_path: Path) -> str:
    """Extract plain text from a PDF file using PyMuPDF."""
    import fitz  # PyMuPDF
    text_parts = []
    with fitz.open(str(pdf_path)) as doc:
        for page in doc:
            text_parts.append(page.get_text("text"))
    return "\n".join(text_parts)


# Scene heading pattern: INT., EXT., I/E., INT/EXT. etc. (Fountain spec)
_SCENE_HEADING_RE = re.compile(
    r"^\s*(INT\.?|EXT\.?|I\/E\.?|INT\/EXT\.?)\s+",
    re.IGNORECASE,
)


def _normalize_pdf_text_for_fountain(text: str) -> str:
    """
    PDF extraction often yields single newlines; Jouvence requires blank lines
    both BEFORE and AFTER scene headings to recognize them.
    """
    lines = text.split("\n")
    out = []
    for i, line in enumerate(lines):
        stripped = line.strip()
        if _SCENE_HEADING_RE.match(stripped):
            if out and out[-1].strip() != "":
                out.append("")
        out.append(line)
        if _SCENE_HEADING_RE.match(stripped):
            if i + 1 < len(lines) and lines[i + 1].strip() != "":
                out.append("")
    return "\n".join(out)


def run_parse(project_root: Path, script_path: Path) -> None:
    """Parse raw script to parsed.json. Copies input to script/original.<ext>."""
    script_dir = get_script_dir(project_root)
    script_dir.mkdir(parents=True, exist_ok=True)

    suffix = script_path.suffix.lower()
    dest = script_dir / f"original{suffix}"
    shutil.copy2(script_path, dest)

    # Parse
    parser = JouvenceParser()
    if suffix == ".pdf":
        text = _extract_text_from_pdf(script_path)
        text = _normalize_pdf_text_for_fountain(text)
        doc = parser.parseString(text)
    elif suffix in (".fountain", ".txt", ".spmd"):
        doc = parser.parse(str(script_path))
    else:
        doc = parser.parse(str(script_path))

    parsed = _convert_jouvence_to_parsed(doc)

    # Write parsed.json
    output_path = script_dir / "parsed.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(parsed.model_dump(), f, indent=2, ensure_ascii=False)
