# AI Film Studio — Complete State Machine Spec

## State Domains

The studio manages **six interconnected state domains**. Every scene in the project is a function of these six domains evaluated at a specific point in the storyline.

```
┌─────────────────────────────────────────────────────────┐
│                    DIRECTOR (Human)                      │
│              asks what-ifs, asserts intent                │
└──────────┬──────────────────────────────┬───────────────┘
           │                              │
           ▼                              ▼
┌─────────────────┐            ┌─────────────────────┐
│  1. NARRATIVE    │◄──────────►│  2. WORLD           │
│  events, arcs,   │            │  characters, props,  │
│  beats, tension  │            │  locations, time     │
└────────┬────────┘            └──────────┬──────────┘
         │                                │
         │    ┌───────────────────────┐   │
         └───►│  3. KNOWLEDGE         │◄──┘
              │  per-character fog    │
              │  of war               │
              └───────────┬───────────┘
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
┌─────────────────┐      ┌─────────────────────┐
│  4. PRODUCTION   │      │  5. ASSETS           │
│  camera, light,  │      │  visuals, audio,     │
│  blocking, audio │      │  skyboxes, wardrobe  │
└────────┬────────┘      └──────────┬──────────┘
         │                          │
         └──────────┬───────────────┘
                    ▼
         ┌─────────────────┐
         │  6. PIPELINE     │
         │  renders, takes, │
         │  exports, queue  │
         └─────────────────┘
```

---

## Domain 1: Narrative

The story structure. What happens, in what order, and why it matters.

### Events (covered previously)
```yaml
# .studio/storyline/events/evt_007.yaml
id: evt_007
label: "Marcus discovers the letter"
scene: scene_005
story_order: 7            # global ordering
beat: midpoint_reversal   # story structure tag
type: revelation          # action | revelation | decision | confrontation | transition
timestamp_story: "1987-03-15T22:00:00"
characters_present: [marcus]
characters_aware_after: [marcus]
characters_unaware: [jane, detective_cole]
world_state_changes:
  - key: marcus.knows_about_affair
    value: true
  - key: marcus.trust_in_jane
    value: -80
  - key: the_letter.possession
    value: marcus
emotional_shifts:
  marcus:
    before: { mood: hopeful, tension: low }
    after: { mood: betrayed, tension: critical }
triggers: [evt_003]       # causal chain — this event depends on these
enables: [evt_009, evt_010]  # this event unlocks these future possibilities
```

### Story Structure
```yaml
# .studio/storyline/structure.yaml
acts:
  act1:
    label: "Setup"
    scenes: [scene_001, scene_002, scene_003, scene_004]
    events: [evt_001, evt_002, evt_003, evt_004]
    arc_phase: setup
    tension_curve: [0.1, 0.2, 0.3, 0.4]

  act2:
    label: "Confrontation"
    scenes: [scene_005, scene_006, scene_007, scene_008, scene_009]
    events: [evt_005, evt_006, evt_007, evt_008, evt_009]
    arc_phase: confrontation
    tension_curve: [0.5, 0.6, 0.8, 0.9, 0.7]

  act3:
    label: "Resolution"
    scenes: [scene_010, scene_011, scene_012]
    events: [evt_010, evt_011, evt_012]
    arc_phase: resolution
    tension_curve: [0.8, 0.95, 0.3]

themes:
  - id: trust_betrayal
    label: "Trust and Betrayal"
    key_events: [evt_003, evt_007, evt_011]
  - id: truth_cost
    label: "The Cost of Truth"
    key_events: [evt_009, evt_012]

subplots:
  - id: cole_investigation
    label: "Cole's Investigation"
    events: [evt_004, evt_006, evt_010]
    intersects_main: evt_010
```

### Pacing
```yaml
# .studio/storyline/pacing.yaml
scenes:
  scene_001:
    pace: slow
    rhythm: contemplative    # contemplative | building | frenetic | release
    duration_target: "3min"
  scene_005:
    pace: medium_to_fast
    rhythm: building
    duration_target: "5min"
  scene_009:
    pace: frenetic
    rhythm: frenetic
    duration_target: "2min"
```

---

## Domain 2: World State

The ground truth of the story universe at any point in time. This is the "god view" that no single character has access to.

### Characters
```yaml
# characters/marcus/profile.yaml
id: marcus
name: "Marcus Webb"
age: 34
occupation: "High school teacher"
personality:
  traits: [methodical, conflict_avoidant, observant, loyal]
  mbti_hint: ISTJ       # optional, helps LLM voice consistency
  flaws: [too_trusting, bottles_emotions, passive]
  strengths: [patience, attention_to_detail, moral_compass]
backstory: |
  Moved to the city six months ago after a career change.
  Left behind a stable life in a small town. Hasn't fully unpacked —
  literally or emotionally.
arc:
  type: transformation    # transformation | fall | rise | flat | disillusionment
  from: "Passive acceptance"
  to: "Decisive action"
  turning_point: evt_007
```

```yaml
# characters/marcus/voice.yaml
speech_patterns:
  sentence_length: short
  vocabulary_level: educated_but_plain
  verbal_tics: ["Look,", "The thing is,"]
  avoids: [questions, emotional language, profanity]
  dialect: neutral_american
  subtext_style: "Says less than he means. Pauses carry weight."
  example_lines:
    - "She said she'd be here."
    - "I found something. On the table."
    - "You don't get to decide what I can handle."
```

```yaml
# characters/marcus/relationships.yaml
relationships:
  jane:
    type: romantic_partner
    evolution:
      - at_event: evt_001
        state: { trust: 90, intimacy: 70, power_balance: equal }
      - at_event: evt_007
        state: { trust: 5, intimacy: 70, power_balance: shifted_to_marcus }
        note: "He knows something she doesn't know he knows"
      - at_event: evt_011
        state: { trust: 0, intimacy: 20, power_balance: equal }

  detective_cole:
    type: stranger_to_adversary
    evolution:
      - at_event: evt_010
        state: { trust: 0, threat_level: high }
        note: "First meeting. Cole suspects Marcus."
```

### Locations
```yaml
# world/locations/marcus_apartment/description.yaml
id: marcus_apartment
name: "Marcus's Apartment"
type: interior
address_story: "4th floor, building on Elm Street"
geography: urban
era: 1987

physical:
  size: small_one_bedroom
  layout: |
    Front door opens to combined living/kitchen.
    Bedroom to the left. Bathroom off the hallway.
    Single window facing the street.
  key_features:
    - "Unpacked boxes (act 1), cleared out (act 2)"
    - "Worn hardwood floors"
    - "Single lamp by the couch"

atmosphere:
  default_lighting: dim_warm
  default_sound: ["street_noise_distant", "radiator_hum"]
  mood: isolated

# how this location changes over the story
evolution:
  - at_event: evt_001
    state: "Sparse. Boxes everywhere. Feels temporary."
  - at_event: evt_005
    state: "Settled in. Photos on wall. Feels like home."
  - at_event: evt_009
    state: "Ransacked. Drawers open. Marcus packed a bag."
```

### Props / Objects
```yaml
# world/props/the_letter.yaml
id: the_letter
name: "The Letter"
type: plot_device          # plot_device | set_dressing | functional | symbolic
physical:
  description: "Handwritten on cream stationery. Folded twice."
  size: small
  notable_details: "Lipstick smudge on the envelope"

lifecycle:
  - event: evt_003
    action: planted
    location: marcus_apartment.kitchen_table
    character: jane
    visibility: hidden_in_plain_sight

  - event: evt_007
    action: discovered
    location: marcus_apartment.kitchen_table
    character: marcus
    visibility: in_hand

  - event: evt_008
    action: presented_as_evidence
    location: downtown_cafe
    characters: [marcus, jane]
    visibility: on_table_between_them

  - event: evt_011
    action: given_to_police
    location: police_station
    character: marcus
    visibility: evidence_bag

symbolic_weight: high
represents: "proof of betrayal, but also jane's desperation"
```

### Timeline / Chronology
```yaml
# world/timeline.yaml
story_span:
  start: "1987-02-01"
  end: "1987-04-15"
  duration: "~10 weeks"

chronology:
  - date: "1987-02-01"
    events: [evt_001]
    note: "Marcus moves in"
  - date: "1987-02-14"
    events: [evt_002, evt_003]
    note: "Valentine's day. Jane plants the letter while Marcus is at work."
  - date: "1987-03-15"
    events: [evt_005, evt_006, evt_007]
    note: "The day everything changes"

time_gaps:
  - between: [evt_004, evt_005]
    duration: "3 weeks"
    implied_events: "Marcus and Jane settle into routine. Cole begins investigation offscreen."
```

---

## Domain 3: Knowledge (Fog of War)

Per-character view of the world. This is the critical layer that sits between world state and actor agents.

```yaml
# characters/marcus/knowledge.yaml
# auto-generated from events, manually overridable

knows:
  - fact: jane.is_having_affair
    learned_at: evt_007
    source: direct_observation
    confidence: certain
    emotional_impact: devastating

  - fact: apartment.feels_like_home
    learned_at: evt_005
    source: lived_experience
    confidence: certain

  - fact: jane.has_secret
    learned_at: evt_002
    source: inferred          # noticed she was evasive
    confidence: suspicion     # certain | partial | suspicion | rumor
    emotional_impact: mild_unease

does_not_know:
  - fact: jane.planted_the_letter
    reason: not_present
  - fact: cole.suspects_marcus
    reason: not_yet_encountered
  - fact: cole.has_surveillance_photos
    reason: not_yet_encountered

beliefs:                       # things character thinks are true but aren't
  - belief: "Jane is faithful"
    held_from: evt_001
    held_until: evt_007        # shattered by discovery
  - belief: "The letter was left accidentally"
    held_from: evt_007
    held_until: null           # still believes this
    ground_truth: "Jane planted it deliberately"

secrets_held:                  # things this character knows that others don't
  - fact: found_the_letter
    known_since: evt_007
    hidden_from: [jane]
    reason: "Wants to observe her behavior before confronting"
```

### Knowledge Propagation Rules
```yaml
# .studio/knowledge_rules.yaml
# How knowledge spreads between characters

propagation:
  direct_observation:
    confidence: certain
    condition: "character is in characters_present for the event"

  told_by:
    confidence: partial
    condition: "explicit dialogue where character A tells character B"
    note: "Can be a lie — check if teller's ground truth matches"

  overheard:
    confidence: partial
    condition: "character is in same location but not in characters_present"

  inferred:
    confidence: suspicion
    condition: "LLM determines character would reasonably deduce this"
    requires_director_approval: true

  rumor:
    confidence: rumor
    condition: "secondhand information, source unknown to character"

  physical_evidence:
    confidence: certain
    condition: "character interacts with prop that reveals information"
```

---

## Domain 4: Production

How the story gets filmed. This is the DP, lighting, blocking, and sound layer.

### Camera
```yaml
# scenes/act2/scene_005/camera.yaml
shots:
  - id: shot_001
    type: establishing        # establishing | wide | medium | close_up | extreme_close_up | over_shoulder | pov | aerial | dutch_angle | tracking | dolly | steadicam | handheld
    subject: marcus_apartment
    lens: 35mm
    movement: static
    duration: "3s"
    framing_notes: "See the whole room. Boxes gone. It feels lived-in now."
    purpose: "Show passage of time since act 1"

  - id: shot_002
    type: medium
    subject: marcus
    lens: 50mm
    movement: slow_push       # static | pan_left | pan_right | tilt_up | tilt_down | slow_push | pull_back | tracking | handheld_drift | crane_up | crane_down | orbit
    framing_notes: "Marcus enters, puts keys down. Camera slowly pushes in as he notices something."
    duration: "8s"
    purpose: "Build tension before discovery"

  - id: shot_003
    type: extreme_close_up
    subject: the_letter
    lens: 85mm
    movement: static
    framing_notes: "Letter on table. Cream paper. The lipstick smudge visible."
    duration: "2s"
    purpose: "The audience sees it before Marcus picks it up"
    insert: true              # this is a cutaway/insert shot

  - id: shot_004
    type: close_up
    subject: marcus.face
    lens: 85mm
    movement: static
    framing_notes: "His expression as he reads. No dialogue. Just his face changing."
    duration: "12s"
    purpose: "The entire scene pivots on this reaction"
    performance_note: "Micro-expressions. Not dramatic. The shock is quiet."

shot_sequence: [shot_001, shot_002, shot_003, shot_004]

scene_coverage:
  style: deliberate           # deliberate | coverage_heavy | single_take | documentary | impressionistic
  avg_shot_length: "6s"
  cut_rhythm: slow_to_medium
```

### Lighting
```yaml
# scenes/act2/scene_005/lighting.yaml
lighting_setup:
  key_light:
    source: practical_lamp     # practical_lamp | window | overhead | candle | screen_glow | none
    direction: camera_left
    intensity: low
    color_temp: 2700K          # warm tungsten
    quality: soft

  fill_light:
    source: window_ambient
    direction: camera_right
    intensity: very_low
    color_temp: 4500K          # cooler moonlight
    quality: diffused

  accent:
    source: none
    note: "No accent. Keep it naturalistic."

  practical_lights_in_scene:
    - "Table lamp (on)"
    - "Kitchen light (off)"

  mood: intimate_to_tense
  contrast_ratio: "4:1"        # higher = more dramatic shadows
  
  evolution_within_scene:
    - at: shot_001
      note: "Warm, inviting. This apartment feels like home."
    - at: shot_004
      note: "Same light, but now it feels isolating. Nothing changes physically — the context changes."
```

### Blocking
```yaml
# scenes/act2/scene_005/blocking.yaml
# character positions and movements within the scene

space:
  reference: world/locations/marcus_apartment
  entry_points: [front_door]
  key_positions:
    door: { x: 0, y: 0 }
    kitchen_counter: { x: 3, y: 1 }
    table_with_letter: { x: 5, y: 2 }
    couch: { x: 4, y: 4 }
    window: { x: 6, y: 0 }

blocking:
  - character: marcus
    movements:
      - at: shot_001
        position: entering_door
        action: "Opens door, walks in"
        body_language: relaxed
        
      - at: shot_002
        position: kitchen_counter
        action: "Drops keys, starts to move toward couch"
        body_language: casual
        pivot: "Freezes mid-step when he notices the letter"
        body_language_after: rigid

      - at: shot_004
        position: table_with_letter
        action: "Standing, reading the letter"
        body_language: "Still. Only his eyes move. One hand grips the table edge."

spatial_relationships:
  - note: "Marcus's path from door to couch naturally passes the table. The discovery is incidental, not sought."
  - note: "He reads the letter standing — doesn't sit down. The body language says he might bolt."
```

### Audio / Sound Design
```yaml
# scenes/act2/scene_005/audio.yaml
dialogue:
  - character: marcus
    line: "She said she'd be here."
    delivery: muttered_to_self
    at: shot_002

  - character: marcus
    line: null                  # no dialogue during letter reading
    at: shot_004
    note: "Silence is the performance"

ambient:
  base: 
    - "street_noise_distant"
    - "radiator_hum"
    - "clock_ticking"          # new — emphasizes silence during reading
  
  evolution:
    - at: shot_001
      add: ["keys_on_counter"]
    - at: shot_004
      reduce: ["street_noise"]  # sound narrows as marcus focuses
      add: ["heartbeat_subtle"]  # optional — subjective sound

music:
  - at: shot_001
    cue: null                   # no music. let the scene breathe.
  - at: shot_003
    cue: "tension_drone_low"
    style: "Single sustained note. Barely perceptible."
    instrument: cello
  - at: shot_004
    cue: "tension_drone_swell"
    style: "Same note, slowly rising. Cuts abruptly when scene ends."

sound_effects:
  - at: shot_002
    sfx: "paper_unfold"
    note: "The letter being picked up. Make it crisp — it's the loudest thing in the scene."
```

---

## Domain 5: Assets

Everything that needs to be generated or referenced for rendering.

### Visual Style
```yaml
# assets/style/global.yaml
visual_style:
  reference_films: ["Se7en", "Zodiac", "A Simple Plan"]
  color_palette:
    primary: ["#2C1810", "#4A3728", "#6B5B4F"]    # warm browns, desaturated
    accent: ["#8B0000"]                              # deep red — used sparingly (the letter, lipstick)
    shadows: "#0D0D0D"
    highlights: "#D4C5A9"
  
  grade:
    saturation: -20%
    contrast: +15%
    grain: light
    tone: warm_shadows_cool_highlights
  
  aspect_ratio: "2.39:1"      # anamorphic widescreen
  
  era_accuracy:
    period: 1987
    notes: "No modern appliances. Rotary phone. CRT television. Analog clock."
```

### Character Visuals
```yaml
# characters/marcus/assets/visual.yaml
appearance:
  age_apparent: mid_30s
  build: average_lean
  height: "5'11"
  hair: "Dark brown, slightly unkempt"
  eyes: "Brown"
  skin_tone: "Medium"
  distinguishing: "Slight circles under eyes. Clean-shaven but looks tired."

wardrobe:
  default: "Button-down shirt (sleeves rolled), dark slacks, no tie"
  
  per_scene:
    scene_001:
      outfit: "Moving day — t-shirt, jeans, dusty"
      condition: disheveled
    scene_005:
      outfit: "End of work day — loosened button-down, slacks"
      condition: slightly_tired
    scene_009:
      outfit: "Same clothes as scene_008 — hasn't changed. Wrinkled."
      condition: deteriorated
      note: "Visual storytelling — he hasn't slept"

reference_images: []           # populated by generation or upload
consistency_anchor: null       # reference image hash for model consistency
```

### Location Visuals
```yaml
# world/locations/marcus_apartment/assets/visual.yaml
skybox:
  generation_prompt: |
    Interior of a small 1980s apartment. Single warm lamp. 
    Hardwood floors. Minimal furniture. Evening light through window.
    Slightly melancholy atmosphere. Photorealistic.
  generated: null              # path to generated skybox once created
  approved: false

set_dressing:
  permanent:
    - "Worn leather couch"
    - "Small kitchen table, two chairs"
    - "Bookshelf (half empty)"
    - "Rotary phone on wall"
    - "Analog clock"
  
  evolving:
    - item: "Moving boxes"
      present_in: [scene_001, scene_002, scene_003]
      absent_from: [scene_005, scene_009]
    
    - item: "Framed photos on wall"
      absent_from: [scene_001, scene_002, scene_003]
      present_in: [scene_005, scene_008]
      note: "Photos of Marcus and Jane. In scene_009 one is face-down."

color_notes: "Warm but muted. The apartment should feel safe in act 1 and suffocating in act 2 — same space, different context."
```

### Audio Assets
```yaml
# assets/audio/catalog.yaml
ambient_beds:
  street_noise_distant:
    description: "Muffled city traffic, occasional horn"
    mood: urban_isolation
  radiator_hum:
    description: "Low mechanical drone"
    mood: domestic_quiet

sound_effects:
  paper_unfold:
    description: "Crisp paper being unfolded"
    usage: [scene_005]
  keys_on_counter:
    description: "Keys dropped on hard surface"
    usage: [scene_001, scene_005]

music_cues:
  tension_drone_low:
    description: "Single cello note, sustained, barely audible"
    starts: scene_005.shot_003
    style: diegetic_ambiguous   # audience unsure if character hears it
  tension_drone_swell:
    description: "Same note, slowly increasing"
    starts: scene_005.shot_004
    ends: scene_005.end
```

---

## Domain 6: Pipeline

Generation queue, renders, and output management.

```yaml
# pipeline/config.yaml
models:
  storyboard:
    provider: "flux"           # or stable_diffusion, midjourney_api
    style_lora: null
    default_params:
      steps: 30
      cfg_scale: 7
      aspect_ratio: "2.39:1"
  
  video:
    provider: "runway"         # or pika, kling
    default_params:
      duration: 4s
      motion_amount: medium
  
  skybox:
    provider: "blockade_labs"
    default_params:
      style: photorealistic
  
  actor_llm:
    provider: "anthropic"
    model: "claude-sonnet-4-5-20250929"
    default_params:
      max_tokens: 1024
      temperature: 0.8         # higher for creative performance
  
  dp_llm:
    provider: "anthropic"
    model: "claude-sonnet-4-5-20250929"
    default_params:
      temperature: 0.4         # lower for technical precision

generation_queue:
  max_concurrent: 3
  priority_order: [storyboard, skybox, audio, video]  # storyboards first, cheapest to iterate
```

```yaml
# pipeline/renders/scene_005_take_001.yaml
id: take_001
scene: scene_005
timeline: main
generated_at: "2026-02-28T15:30:00Z"
model: runway
params:
  duration: 8s
  motion: medium
  seed: 42
input_storyboard: scenes/act2/scene_005/storyboard/frame_001.png
output: scenes/act2/scene_005/renders/take_001.mp4
status: complete               # queued | generating | complete | failed | approved | rejected
director_notes: "Good framing but marcus moves too fast. Slow the entrance."
approved: false
```

---

## Complete Directory Structure

```
project-root/
├── .git/
├── .gitignore                         # index.db, renders cache, node_modules
├── .gitattributes                     # git-lfs tracking for images, video, audio
│
├── project.yaml                       # title, logline, genre, metadata
│
├── script/
│   ├── original.fountain              # raw uploaded script
│   └── parsed.json                    # structured parse output
│
├── characters/
│   ├── marcus/
│   │   ├── profile.yaml               # personality, backstory, arc
│   │   ├── voice.yaml                 # speech patterns, LLM persona prompt
│   │   ├── relationships.yaml         # evolving relationships with others
│   │   ├── knowledge.yaml             # fog of war — what he knows/doesn't
│   │   └── assets/
│   │       ├── visual.yaml            # appearance, wardrobe per scene
│   │       ├── reference/             # uploaded or generated reference images
│   │       └── consistency_anchor.png # locked reference for generation consistency
│   │
│   ├── jane/
│   │   └── ... (same structure)
│   └── detective_cole/
│       └── ...
│
├── scenes/
│   ├── act1/
│   │   ├── scene_001/
│   │   │   ├── scene.yaml             # location, time, characters, tone, beat
│   │   │   ├── dialogue.json          # structured dialogue with speaker tags
│   │   │   ├── directions.md          # action lines, stage directions
│   │   │   ├── camera.yaml            # shot list, lens, movement, framing
│   │   │   ├── lighting.yaml          # key/fill/accent, mood, color temp
│   │   │   ├── blocking.yaml          # character positions and movement
│   │   │   ├── audio.yaml             # dialogue delivery, ambient, music, sfx
│   │   │   ├── storyboard/
│   │   │   │   ├── frame_001.png
│   │   │   │   ├── frame_002.png
│   │   │   │   └── frame_003.png
│   │   │   └── renders/
│   │   │       ├── take_001.mp4
│   │   │       └── take_002.mp4
│   │   └── scene_002/
│   │       └── ...
│   ├── act2/
│   │   └── ...
│   └── act3/
│       └── ...
│
├── world/
│   ├── locations/
│   │   ├── marcus_apartment/
│   │   │   ├── description.yaml       # physical, atmosphere, evolution
│   │   │   └── assets/
│   │   │       ├── visual.yaml        # skybox prompts, set dressing, color
│   │   │       ├── skybox.png         # generated environment
│   │   │       └── reference/         # mood board images
│   │   └── downtown_cafe/
│   │       └── ...
│   ├── props/
│   │   ├── the_letter.yaml            # lifecycle, symbolic weight
│   │   └── surveillance_photos.yaml
│   ├── timeline.yaml                  # in-world chronology
│   └── rules.yaml                     # world-building constraints and logic
│
├── assets/
│   ├── style/
│   │   └── global.yaml                # color palette, grade, aspect ratio, era
│   ├── audio/
│   │   ├── catalog.yaml               # ambient beds, sfx, music cues
│   │   └── generated/                 # AI-generated audio files
│   └── props/
│       └── the_letter/
│           └── reference.png
│
├── .studio/                           # engine internals (git-tracked except index.db)
│   ├── storyline/
│   │   ├── structure.yaml             # acts, beats, themes, subplots
│   │   ├── pacing.yaml                # per-scene pace, rhythm, duration targets
│   │   ├── events/
│   │   │   ├── evt_001.yaml
│   │   │   ├── evt_002.yaml
│   │   │   └── ...
│   │   └── world_state/
│   │       ├── initial.yaml           # world state at story start
│   │       └── snapshots/
│   │           ├── after_evt_001.yaml
│   │           └── ...
│   │
│   ├── knowledge_rules.yaml           # how knowledge propagates between characters
│   │
│   ├── decisions/
│   │   ├── decision_000.yaml          # base: "script as written"
│   │   ├── decision_001.yaml
│   │   └── ...
│   │
│   ├── timelines/
│   │   ├── main.yaml                  # canonical timeline
│   │   └── noir-sympathetic.yaml      # alternate exploration
│   │
│   ├── index.db                       # SQLite query cache (GITIGNORED)
│   └── index_version                  # hash to detect when reindex needed
│
└── pipeline/
    ├── config.yaml                    # model endpoints, generation settings
    ├── prompts/
    │   ├── actor_system.txt           # base actor agent prompt template
    │   ├── dp_system.txt              # DP agent prompt template
    │   ├── extractor_system.txt       # ingestion extraction prompt
    │   └── inferrer_system.txt        # ingestion inference prompt
    └── renders/
        ├── scene_005_take_001.yaml    # render metadata, status, notes
        └── ...
```

---

## SQLite Index Schema

```sql
-- .studio/index.db (gitignored, rebuilt from YAML)

-- Core events
CREATE TABLE events (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    scene_id TEXT NOT NULL,
    story_order INTEGER NOT NULL,
    beat TEXT,                          -- midpoint_reversal, climax, etc
    type TEXT,                          -- action, revelation, decision, confrontation
    timestamp_story TEXT,               -- in-world datetime
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_events_scene ON events(scene_id);
CREATE INDEX idx_events_order ON events(story_order);

-- Who knows what after each event
CREATE TABLE event_awareness (
    event_id TEXT NOT NULL,
    character_id TEXT NOT NULL,
    aware BOOLEAN NOT NULL,
    source TEXT,                        -- direct_observation, told_by, inferred, overheard
    confidence TEXT,                    -- certain, partial, suspicion, rumor
    PRIMARY KEY (event_id, character_id),
    FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE INDEX idx_awareness_character ON event_awareness(character_id, aware);

-- World state changes per event
CREATE TABLE world_state_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL,
    key TEXT NOT NULL,                  -- e.g. "marcus.trust_in_jane"
    value TEXT NOT NULL,
    event_story_order INTEGER NOT NULL,
    FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE INDEX idx_state_key ON world_state_changes(key);
CREATE INDEX idx_state_order ON world_state_changes(event_story_order);

-- Character emotional states (computed per scene)
CREATE TABLE emotional_states (
    character_id TEXT NOT NULL,
    scene_id TEXT NOT NULL,
    mood TEXT,
    tension TEXT,                       -- low, medium, high, critical
    confidence REAL,                    -- 0-1
    openness REAL,                      -- 0-1, willingness to share
    PRIMARY KEY (character_id, scene_id)
);

-- Character beliefs (may diverge from ground truth)
CREATE TABLE beliefs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id TEXT NOT NULL,
    belief TEXT NOT NULL,
    ground_truth TEXT,                  -- what's actually true (null if belief is accurate)
    held_from_event TEXT,
    held_until_event TEXT,              -- null if still held
    FOREIGN KEY (held_from_event) REFERENCES events(id)
);

CREATE INDEX idx_beliefs_character ON beliefs(character_id);

-- Character knowledge (facts known)
CREATE TABLE knowledge (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id TEXT NOT NULL,
    fact_key TEXT NOT NULL,             -- e.g. "jane.is_having_affair"
    learned_at_event TEXT NOT NULL,
    source TEXT,
    confidence TEXT,
    FOREIGN KEY (learned_at_event) REFERENCES events(id)
);

CREATE INDEX idx_knowledge_character ON knowledge(character_id);
CREATE INDEX idx_knowledge_fact ON knowledge(fact_key);

-- Scenes
CREATE TABLE scenes (
    id TEXT PRIMARY KEY,
    act TEXT NOT NULL,
    scene_order INTEGER NOT NULL,
    location_id TEXT,
    time_of_day TEXT,
    interior_exterior TEXT,
    pace TEXT,
    rhythm TEXT,
    beat TEXT,
    duration_target TEXT
);

-- Characters in scenes
CREATE TABLE scene_characters (
    scene_id TEXT NOT NULL,
    character_id TEXT NOT NULL,
    PRIMARY KEY (scene_id, character_id)
);

-- Props lifecycle
CREATE TABLE prop_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prop_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    action TEXT,                        -- planted, discovered, destroyed, transferred
    location TEXT,
    character_id TEXT,
    FOREIGN KEY (event_id) REFERENCES events(id)
);

-- Decisions (for timeline branching)
CREATE TABLE decisions (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    parent_id TEXT,
    type TEXT,                          -- character, scene, world, production
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (parent_id) REFERENCES decisions(id)
);

-- Timelines (compositions of decisions)
CREATE TABLE timelines (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    is_canonical BOOLEAN DEFAULT FALSE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE timeline_decisions (
    timeline_id TEXT NOT NULL,
    decision_id TEXT NOT NULL,
    order_index INTEGER NOT NULL,
    PRIMARY KEY (timeline_id, decision_id),
    FOREIGN KEY (timeline_id) REFERENCES timelines(id),
    FOREIGN KEY (decision_id) REFERENCES decisions(id)
);

-- Render tracking
CREATE TABLE renders (
    id TEXT PRIMARY KEY,
    scene_id TEXT NOT NULL,
    timeline_id TEXT,
    model TEXT,
    status TEXT,                        -- queued, generating, complete, failed, approved, rejected
    input_path TEXT,
    output_path TEXT,
    director_notes TEXT,
    approved BOOLEAN DEFAULT FALSE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

---

## Read/Write Patterns by Agent

### Actor Agent (e.g., Marcus in scene_005)

| Operation | Source | What |
|-----------|--------|------|
| **READ** | SQLite | All events where `character_id='marcus' AND aware=true AND story_order <= 7` |
| **READ** | SQLite | Emotional state at current scene |
| **READ** | SQLite | Beliefs (including false ones) |
| **READ** | SQLite | Knowledge entries for this character |
| **READ** | YAML | `characters/marcus/voice.yaml` (speech patterns) |
| **READ** | YAML | `characters/marcus/relationships.yaml` (as marcus perceives them) |
| **READ** | YAML | Current scene's `scene.yaml`, `blocking.yaml` |
| **NEVER READS** | — | Other characters' knowledge, ground truth that contradicts beliefs, future events |
| **WRITES** | YAML → reindex | New dialogue, actions, emotional reactions (during improvisation) |

### DP Agent (Cinematography)

| Operation | Source | What |
|-----------|--------|------|
| **READ** | YAML | Scene's `scene.yaml` (mood, tone, beat) |
| **READ** | YAML | `blocking.yaml` (where characters are) |
| **READ** | YAML | `assets/style/global.yaml` (visual language) |
| **READ** | YAML | Location's `description.yaml` and `visual.yaml` |
| **READ** | YAML | `pacing.yaml` (rhythm, duration targets) |
| **READ** | YAML | `audio.yaml` (sound informs camera — quiet moments get tighter shots) |
| **READ** | SQLite | Emotional states of characters in scene (informs shot intimacy) |
| **READ** | SQLite | Event type (revelation → close-up, confrontation → wider coverage) |
| **WRITES** | YAML | `camera.yaml`, `lighting.yaml` |

### Storyboard Agent

| Operation | Source | What |
|-----------|--------|------|
| **READ** | YAML | `camera.yaml` (shot list, framing) |
| **READ** | YAML | `lighting.yaml` (mood, color) |
| **READ** | YAML | `blocking.yaml` (positions) |
| **READ** | YAML | Character `visual.yaml` (appearance) |
| **READ** | YAML | Location `visual.yaml` (environment) |
| **READ** | YAML | `assets/style/global.yaml` (color palette, grade) |
| **WRITES** | Files | `storyboard/frame_NNN.png` |

### Sound Designer Agent

| Operation | Source | What |
|-----------|--------|------|
| **READ** | YAML | Scene's `audio.yaml` |
| **READ** | YAML | Location `description.yaml` (ambient sources) |
| **READ** | YAML | `pacing.yaml` (rhythm) |
| **READ** | SQLite | Emotional states (tension level drives sound intensity) |
| **READ** | SQLite | Event type (revelation might trigger a music cue) |
| **WRITES** | YAML | Updated `audio.yaml`, `assets/audio/catalog.yaml` |
| **WRITES** | Files | Generated audio in `assets/audio/generated/` |

### Director (Human via CLI/UI)

| Operation | Source | What |
|-----------|--------|------|
| **READ** | Everything | God view — sees ground truth, all character states, all timelines |
| **WRITES** | YAML | Corrections, overrides, new decisions, approved/rejected renders |
| **TRIGGERS** | System | "What if..." explorations, improvisation sessions, generation queue |

---

## Ingestion Pipeline (Revised)

```
┌──────────────────────────────────────────────────────────────────┐
│  1. PARSE                                                         │
│  Input:  raw script (fountain/pdf/txt)                           │
│  Output: parsed.json (structured screenplay elements)            │
│  Method: deterministic parser (fountain lib or custom)           │
│  Writes: script/original.fountain, script/parsed.json            │
└──────────────────────────────┬───────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  2. EXTRACT (LLM pass 1)                                         │
│  Input:  parsed.json                                             │
│  Output: entities — characters, scenes, locations, props         │
│  Method: LLM with structured output                              │
│  Writes: characters/*/profile.yaml (skeleton)                    │
│          scenes/*/scene.yaml (skeleton)                          │
│          scenes/*/dialogue.json                                  │
│          scenes/*/directions.md                                  │
│          world/locations/*/description.yaml (skeleton)           │
│          world/props/*.yaml (skeleton)                           │
│          world/timeline.yaml (skeleton)                          │
└──────────────────────────────┬───────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  3. INFER (LLM pass 2 — the heavy lift)                          │
│  Input:  parsed.json + extract output                            │
│  Output: narrative intelligence                                  │
│  Method: LLM with chain-of-thought, structured output            │
│  Writes: .studio/storyline/events/*.yaml                         │
│          .studio/storyline/structure.yaml                        │
│          .studio/storyline/pacing.yaml                           │
│          characters/*/voice.yaml                                 │
│          characters/*/relationships.yaml                         │
│          characters/*/knowledge.yaml                             │
│          characters/*/arc.yaml (director's intent)               │
│          world/props/*.yaml (lifecycle populated)                │
│          world/timeline.yaml (populated)                         │
│          world/rules.yaml                                        │
│          .studio/knowledge_rules.yaml                            │
└──────────────────────────────┬───────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  4. ENVISION (LLM pass 3 — production layer)                     │
│  Input:  all prior outputs                                       │
│  Output: initial production design                               │
│  Method: DP agent + style agent                                  │
│  Writes: assets/style/global.yaml                                │
│          scenes/*/camera.yaml (initial shot lists)               │
│          scenes/*/lighting.yaml                                  │
│          scenes/*/blocking.yaml                                  │
│          scenes/*/audio.yaml                                     │
│          characters/*/assets/visual.yaml                         │
│          world/locations/*/assets/visual.yaml                    │
│          assets/audio/catalog.yaml                               │
│          pipeline/config.yaml                                    │
└──────────────────────────────┬───────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  5. INDEX                                                         │
│  Input:  all YAML files                                          │
│  Output: SQLite query cache                                      │
│  Method: deterministic — scan YAMLs, populate tables             │
│  Writes: .studio/index.db                                        │
│          .studio/index_version                                   │
└──────────────────────────────┬───────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  6. REVIEW (human in the loop)                                    │
│  Input:  everything generated so far                             │
│  Output: corrections, approvals, enrichments                     │
│  Method: CLI/UI presents summary + flags uncertainties           │
│  Writes: corrections to any YAML file                            │
│  Triggers: reindex if changes made                               │
└──────────────────────────────┬───────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  7. COMMIT                                                        │
│  Creates: decision_000 ("script as written")                     │
│           main timeline                                          │
│           git initial commit + tag v0-ingested                   │
│  Project is now live for exploration.                             │
└──────────────────────────────────────────────────────────────────┘
```

**Key change from earlier draft:** added step 4 (ENVISION) as a separate LLM pass. The production layer — camera, lighting, blocking, audio — is a different kind of reasoning than narrative inference. A DP thinks differently than a script analyst. Keeping them separate means you can iterate on production design without re-running narrative extraction, and you can swap out the DP agent's style without touching the story.

---

## State Machine Transitions

Once the project is live, here are the core state transitions:

```
┌─────────────┐     "what if marcus                ┌──────────────┐
│  IDLE        │      confronts jane               │  DECIDE       │
│  (awaiting   │──────in scene 005?"──────────────►│  create new   │
│   director)  │                                    │  decision node│
└─────────────┘                                    └──────┬───────┘
       ▲                                                  │
       │                                                  ▼
       │                                           ┌──────────────┐
       │                                           │  BRANCH       │
       │                                           │  fork YAML    │
       │                                           │  files, update│
       │                                           │  affected     │
       │                                           │  entities     │
       │                                           └──────┬───────┘
       │                                                  │
       │                                                  ▼
       │                                           ┌──────────────┐
       │                                           │  PROPAGATE    │
       │                                           │  update       │
       │                                           │  knowledge,   │
       │                                           │  emotional    │
       │                                           │  states, world│
       │                                           │  state for all│
       │                                           │  downstream   │
       │                                           │  scenes       │
       │                                           └──────┬───────┘
       │                                                  │
       │                                                  ▼
       │                                           ┌──────────────┐
       │            director                       │  REINDEX      │
       │            approves/                      │  rebuild      │
       │◄───────────rejects────────────────────────│  SQLite from  │
       │                                           │  updated YAML │
       │                                           └──────┬───────┘
       │                                                  │
       │                                                  ▼
       │                                           ┌──────────────┐
       │                                           │  GENERATE     │
       │              approved                     │  storyboards, │
       │◄─────────────renders──────────────────────│  renders,     │
       │                                           │  audio        │
       │                                           └──────────────┘
```

Every cycle through this loop produces:
1. A new decision in `.studio/decisions/`
2. Updated YAML files (characters, events, scenes, production)
3. A reindexed SQLite
4. A git commit capturing the change
5. Optionally, new generated assets (storyboards, renders)

The filmmaker's entire workflow is: **explore → decide → review → commit → repeat.**