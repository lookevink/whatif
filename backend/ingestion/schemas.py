"""Pydantic schemas for the ingestion pipeline."""

from pydantic import BaseModel, Field, field_validator
from typing import Any


def _coerce_list_to_dict(v: Any) -> dict:
    """Coerce empty list to dict when LLM returns [] instead of {}."""
    if isinstance(v, list):
        return {}
    return v


# --- Extract output (Phase 2) ---


class ExtractedCharacter(BaseModel):
    """Character extracted from screenplay."""

    id: str
    name: str
    description: str = ""


class ExtractedScene(BaseModel):
    """Scene extracted from screenplay."""

    id: str
    act: str  # act1, act2, act3
    scene_order: int
    heading: str
    location_id: str
    character_ids: list[str] = Field(default_factory=list)
    summary: str = ""


class ExtractedLocation(BaseModel):
    """Location extracted from screenplay."""

    id: str
    name: str
    type: str = "interior"  # interior, exterior, both
    description: str = ""


class ExtractedProp(BaseModel):
    """Prop extracted from screenplay."""

    id: str
    name: str
    type: str = "plot_device"  # plot_device, set_dressing, functional, symbolic


class ExtractOutput(BaseModel):
    """Complete output from EXTRACT step."""

    characters: list[ExtractedCharacter] = Field(default_factory=list)
    scenes: list[ExtractedScene] = Field(default_factory=list)
    locations: list[ExtractedLocation] = Field(default_factory=list)
    props: list[ExtractedProp] = Field(default_factory=list)


# --- Parsed JSON (Phase 1) ---


class TitlePage(BaseModel):
    """Title page metadata from the screenplay."""

    title: str = ""
    author: str = ""
    credit: str = ""
    source: str = ""
    draft_date: str = ""
    contact: str = ""
    extra: dict[str, str] = Field(default_factory=dict)


class DialogueBlock(BaseModel):
    """A block of dialogue: character cue + optional parenthetical + line."""

    character: str
    parenthetical: str | None = None
    text: str


class SceneElement(BaseModel):
    """A single element within a scene (action, dialogue, transition)."""

    type: str  # "action" | "dialogue" | "transition" | "centered_action" | "synopsis" | "section"
    text: str | None = None
    character: str | None = None
    parenthetical: str | None = None


class ParsedScene(BaseModel):
    """A scene from the parsed screenplay."""

    scene_number: int
    heading: str  # e.g. "INT. APARTMENT - DAY"
    elements: list[SceneElement] = Field(default_factory=list)


class ParsedScript(BaseModel):
    """Complete parsed screenplay output."""

    title_page: TitlePage = Field(default_factory=TitlePage)
    scenes: list[ParsedScene] = Field(default_factory=list)
    characters: list[str] = Field(default_factory=list)  # unique character names from dialogue


# --- Infer output (Phase 3) ---


class WorldStateChange(BaseModel):
    key: str
    value: str


class EmotionalState(BaseModel):
    mood: str = ""
    tension: str = ""


class EmotionalShift(BaseModel):
    before: EmotionalState = Field(default_factory=EmotionalState)
    after: EmotionalState = Field(default_factory=EmotionalState)


class InferEvent(BaseModel):
    id: str
    label: str
    scene_id: str
    story_order: int
    beat: str = ""
    type: str = "action"  # action | revelation | decision | confrontation | transition
    timestamp_story: str = ""
    characters_present: list[str] = Field(default_factory=list)
    characters_aware_after: list[str] = Field(default_factory=list)
    characters_unaware: list[str] = Field(default_factory=list)
    world_state_changes: list[WorldStateChange] = Field(default_factory=list)
    emotional_shifts: dict[str, EmotionalShift] = Field(default_factory=dict)
    triggers: list[str] = Field(default_factory=list)
    enables: list[str] = Field(default_factory=list)

    @field_validator("emotional_shifts", mode="before")
    @classmethod
    def emotional_shifts_must_be_dict(cls, v: Any) -> Any:
        return _coerce_list_to_dict(v)


class ActStructure(BaseModel):
    label: str = ""
    scenes: list[str] = Field(default_factory=list)
    events: list[str] = Field(default_factory=list)
    arc_phase: str = ""
    tension_curve: list[float] = Field(default_factory=list)


class Theme(BaseModel):
    id: str
    label: str
    key_events: list[str] = Field(default_factory=list)


class Subplot(BaseModel):
    id: str
    label: str
    events: list[str] = Field(default_factory=list)
    intersects_main: str = ""


class ScenePacing(BaseModel):
    pace: str = "medium"
    rhythm: str = "contemplative"
    duration_target: str = "3min"


class InferStructure(BaseModel):
    acts: dict[str, ActStructure] = Field(default_factory=dict)
    themes: list[Theme] = Field(default_factory=list)
    subplots: list[Subplot] = Field(default_factory=list)

    @field_validator("acts", mode="before")
    @classmethod
    def acts_must_be_dict(cls, v: Any) -> Any:
        return _coerce_list_to_dict(v)


class InferNarrativeOutput(BaseModel):
    """Events, structure, pacing from INFER step."""

    events: list[InferEvent] = Field(default_factory=list)
    structure: InferStructure = Field(default_factory=InferStructure)
    pacing: dict[str, ScenePacing] = Field(default_factory=dict)

    @field_validator("pacing", mode="before")
    @classmethod
    def pacing_must_be_dict(cls, v: Any) -> Any:
        return _coerce_list_to_dict(v)


class CharacterVoice(BaseModel):
    sentence_length: str = "medium"
    vocabulary_level: str = "plain"
    verbal_tics: list[str] = Field(default_factory=list)
    avoids: list[str] = Field(default_factory=list)
    dialect: str = "neutral"
    subtext_style: str = ""
    example_lines: list[str] = Field(default_factory=list)


class RelationshipEvolution(BaseModel):
    at_event: str = ""
    state: dict[str, Any] = Field(default_factory=dict)
    note: str = ""


class CharacterRelationship(BaseModel):
    type: str = ""
    evolution: list[RelationshipEvolution] = Field(default_factory=list)


class KnownFact(BaseModel):
    fact: str
    learned_at: str = ""
    source: str = ""
    confidence: str = "certain"
    emotional_impact: str = ""


class UnknownFact(BaseModel):
    fact: str
    reason: str = ""


class Belief(BaseModel):
    belief: str
    held_from: str = ""
    held_until: str | None = None
    ground_truth: str = ""


class SecretHeld(BaseModel):
    fact: str
    known_since: str = ""
    hidden_from: list[str] = Field(default_factory=list)
    reason: str = ""


class CharacterKnowledge(BaseModel):
    knows: list[KnownFact] = Field(default_factory=list)
    does_not_know: list[UnknownFact] = Field(default_factory=list)
    beliefs: list[Belief] = Field(default_factory=list)
    secrets_held: list[SecretHeld] = Field(default_factory=list)


class CharacterArc(BaseModel):
    type: str = "flat"
    from_state: str = ""
    to_state: str = ""
    turning_point: str = ""


class InferCharacterData(BaseModel):
    character_id: str
    voice: CharacterVoice = Field(default_factory=CharacterVoice)
    relationships: dict[str, CharacterRelationship] = Field(default_factory=dict)
    knowledge: CharacterKnowledge = Field(default_factory=CharacterKnowledge)
    arc: CharacterArc = Field(default_factory=CharacterArc)


class PropLifecycleEvent(BaseModel):
    event: str
    action: str = ""
    location: str = ""
    character: str = ""
    visibility: str = ""


class InferPropData(BaseModel):
    prop_id: str
    lifecycle: list[PropLifecycleEvent] = Field(default_factory=list)
    symbolic_weight: str = "low"
    represents: str = ""


class InferCharacterOutput(BaseModel):
    characters: list[InferCharacterData] = Field(default_factory=list)


class InferPropsOutput(BaseModel):
    props: list[InferPropData] = Field(default_factory=list)
    world_rules: list[str] = Field(default_factory=list)
    knowledge_rules: dict[str, Any] = Field(default_factory=dict)


# --- Envision output (Phase 4) ---


class EnvisionShot(BaseModel):
    id: str = ""
    type: str = "medium"
    subject: str = ""
    lens: str = "50mm"
    movement: str = "static"
    duration: str = "5s"
    framing_notes: str = ""
    purpose: str = ""
    insert: bool = False


class EnvisionCamera(BaseModel):
    shots: list[EnvisionShot] = Field(default_factory=list)
    shot_sequence: list[str] = Field(default_factory=list)


class EnvisionLighting(BaseModel):
    key_light: dict[str, Any] = Field(default_factory=dict)
    fill_light: dict[str, Any] = Field(default_factory=dict)
    accent: dict[str, Any] = Field(default_factory=dict)
    mood: str = ""
    contrast_ratio: str = "4:1"


class EnvisionBlocking(BaseModel):
    space: dict[str, Any] = Field(default_factory=dict)
    blocking: list[dict[str, Any]] = Field(default_factory=list)
    spatial_relationships: list[str] = Field(default_factory=list)


class EnvisionSceneProduction(BaseModel):
    scene_id: str
    camera: EnvisionCamera = Field(default_factory=EnvisionCamera)
    lighting: EnvisionLighting = Field(default_factory=EnvisionLighting)
    blocking: EnvisionBlocking = Field(default_factory=EnvisionBlocking)
    audio: dict[str, Any] = Field(default_factory=dict)


class EnvisionGlobalStyle(BaseModel):
    reference_films: list[str] = Field(default_factory=list)
    color_palette: dict[str, Any] = Field(default_factory=dict)
    grade: dict[str, Any] = Field(default_factory=dict)
    aspect_ratio: str = "2.39:1"
    era_accuracy: dict[str, Any] = Field(default_factory=dict)


class EnvisionCharacterVisual(BaseModel):
    character_id: str
    appearance: dict[str, Any] = Field(default_factory=dict)
    wardrobe: dict[str, Any] = Field(default_factory=dict)


class EnvisionLocationVisual(BaseModel):
    location_id: str
    skybox_prompt: str = ""
    set_dressing: dict[str, Any] = Field(default_factory=dict)
    color_notes: str = ""


class EnvisionAudioCatalog(BaseModel):
    ambient_beds: dict[str, Any] = Field(default_factory=dict)
    sound_effects: dict[str, Any] = Field(default_factory=dict)
    music_cues: dict[str, Any] = Field(default_factory=dict)
