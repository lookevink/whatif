// Core types for the Whatif Studio system

export interface GitVisualization {
  branches: Branch[];
  currentBranch: string;
  mainBranch: string;
}

export interface Branch {
  name: string;
  commits: Commit[];
  parent?: string;
  timeline?: Timeline;
}

export interface Commit {
  id: string;
  message: string;
  timestamp: string;
  author: string;
  decisions?: Decision[];
}

export interface Decision {
  id: string;
  label: string;
  type: 'character' | 'scene' | 'world' | 'production';
  parentId?: string;
  notes?: string;
  createdAt: string;
}

export interface Timeline {
  id: string;
  name: string;
  isCanonical: boolean;
  decisions: Decision[];
}

// Scene and narrative types
export interface Scene {
  id: string;
  act: string;
  sceneOrder: number;
  location?: Location;
  timeOfDay?: string;
  characters: CharacterRef[];
  dialogue?: Dialogue[];
  directions?: string;
  camera?: CameraSetup;
  lighting?: LightingSetup;
  blocking?: Blocking;
  audio?: AudioSetup;
  storyboard?: StoryboardFrame[];
  renders?: Render[];
  // Fallback/computed fields
  _status?: DataStatus;
  _generated?: boolean;
}

export interface CharacterRef {
  id: string;
  name: string;
  profile?: CharacterProfile;
  visual?: CharacterVisual;
  knowledge?: Knowledge;
  emotionalState?: EmotionalState;
}

export interface CharacterProfile {
  id: string;
  name: string;
  age?: number;
  occupation?: string;
  personality?: {
    traits?: string[];
    mbti?: string;
    flaws?: string[];
    strengths?: string[];
  };
  backstory?: string;
  arc?: {
    type: string;
    from: string;
    to: string;
    turningPoint?: string;
  };
  voice?: VoiceProfile;
}

export interface VoiceProfile {
  speechPatterns?: {
    sentenceLength?: string;
    vocabularyLevel?: string;
    verbalTics?: string[];
    avoids?: string[];
    dialect?: string;
    subtextStyle?: string;
  };
  exampleLines?: string[];
}

export interface CharacterVisual {
  appearance?: {
    ageApparent?: string;
    build?: string;
    height?: string;
    hair?: string;
    eyes?: string;
    skinTone?: string;
    distinguishing?: string;
  };
  wardrobe?: {
    default?: string;
    perScene?: Record<string, {
      outfit: string;
      condition: string;
      note?: string;
    }>;
  };
  referenceImages?: string[];
  glbModel?: string;
  consistencyAnchor?: string;
}

export interface Knowledge {
  knows: KnowledgeItem[];
  doesNotKnow: KnowledgeItem[];
  beliefs: Belief[];
  secretsHeld: Secret[];
}

export interface KnowledgeItem {
  fact: string;
  learnedAt?: string;
  source?: 'direct_observation' | 'told_by' | 'inferred' | 'overheard' | 'physical_evidence';
  confidence?: 'certain' | 'partial' | 'suspicion' | 'rumor';
  emotionalImpact?: string;
}

export interface Belief {
  belief: string;
  heldFrom?: string;
  heldUntil?: string;
  groundTruth?: string;
}

export interface Secret {
  fact: string;
  knownSince?: string;
  hiddenFrom?: string[];
  reason?: string;
}

export interface EmotionalState {
  mood?: string;
  tension?: 'low' | 'medium' | 'high' | 'critical';
  confidence?: number;
  openness?: number;
}

export interface Location {
  id: string;
  name: string;
  type?: 'interior' | 'exterior';
  physical?: {
    size?: string;
    layout?: string;
    keyFeatures?: string[];
  };
  atmosphere?: {
    defaultLighting?: string;
    defaultSound?: string[];
    mood?: string;
  };
  evolution?: LocationEvolution[];
  skybox?: string;
  glbModel?: string;
}

export interface LocationEvolution {
  atEvent: string;
  state: string;
}

export interface Dialogue {
  character: string;
  line: string;
  delivery?: string;
  subtext?: string;
}

export interface CameraSetup {
  shots: CameraShot[];
  shotSequence?: string[];
  sceneCoverage?: {
    style?: string;
    avgShotLength?: string;
    cutRhythm?: string;
  };
}

export interface CameraShot {
  id: string;
  type: 'establishing' | 'wide' | 'medium' | 'close_up' | 'extreme_close_up' | 'over_shoulder' | 'pov';
  subject?: string;
  lens?: string;
  movement?: string;
  duration?: string;
  framingNotes?: string;
  purpose?: string;
}

export interface LightingSetup {
  keyLight?: Light;
  fillLight?: Light;
  accent?: Light;
  practicalLights?: string[];
  mood?: string;
  contrastRatio?: string;
  evolution?: LightingEvolution[];
}

export interface Light {
  source?: string;
  direction?: string;
  intensity?: string;
  colorTemp?: string;
  quality?: string;
}

export interface LightingEvolution {
  at: string;
  note: string;
}

export interface Blocking {
  space?: {
    reference?: string;
    entryPoints?: string[];
    keyPositions?: Record<string, { x: number; y: number }>;
  };
  characterMovements?: CharacterMovement[];
  spatialRelationships?: string[];
}

export interface CharacterMovement {
  character: string;
  movements: Movement[];
}

export interface Movement {
  at: string;
  position: string;
  action?: string;
  bodyLanguage?: string;
}

export interface AudioSetup {
  dialogue?: AudioDialogue[];
  ambient?: {
    base?: string[];
    evolution?: AudioEvolution[];
  };
  music?: MusicCue[];
  soundEffects?: SoundEffect[];
}

export interface AudioDialogue {
  character: string;
  line?: string;
  delivery?: string;
  at?: string;
  note?: string;
}

export interface AudioEvolution {
  at: string;
  add?: string[];
  reduce?: string[];
}

export interface MusicCue {
  at: string;
  cue?: string;
  style?: string;
  instrument?: string;
}

export interface SoundEffect {
  at: string;
  sfx: string;
  note?: string;
}

export interface StoryboardFrame {
  id: string;
  shotId: string;
  imagePath?: string;
  description?: string;
  generated?: boolean;
  prompt?: string;
}

export interface Render {
  id: string;
  sceneId: string;
  timelineId?: string;
  model?: string;
  status: 'queued' | 'generating' | 'complete' | 'failed' | 'approved' | 'rejected';
  inputPath?: string;
  outputPath?: string;
  directorNotes?: string;
  approved?: boolean;
  createdAt?: string;
}

// Data resilience types
export interface DataStatus {
  complete: boolean;
  missingFields: string[];
  generatedFields: string[];
  confidence: number;
  lastChecked: string;
}

export interface DataFallback {
  field: string;
  originalValue?: any;
  generatedValue: any;
  reason: string;
  confidence: number;
}

// What-if system types
export interface WhatIfQuery {
  id: string;
  query: string;
  sceneId: string;
  type: 'dialogue' | 'action' | 'character' | 'world';
  changes: ProposedChange[];
  branch?: string;
  status: 'pending' | 'processing' | 'complete' | 'approved' | 'rejected';
}

export interface ProposedChange {
  path: string;
  originalValue: any;
  newValue: any;
  impact: string[];
  confidence: number;
}

// Character Dialogue types
export interface DialogueMessage {
  id: string;
  role: 'user' | 'character';
  characterId: string;
  characterName: string;
  text: string;
  timestamp: number;
}

export interface DialogueCharacter {
  id: string;
  name: string;
  description: string;
  hasVoiceData: boolean;
  hasKnowledgeData: boolean;
  dialogueReady: boolean;
}

// Storyboard generation types
export interface StoryboardRequest {
  sceneId: string;
  style?: 'cinematic' | 'sketch' | 'comic' | 'realistic';
  panelCount?: number;
  aspectRatio?: string;
  includeCamera?: boolean;
  includeDialogue?: boolean;
}

export interface StoryboardPanel {
  index: number;
  shotType: string;
  description: string;
  dialogue?: string[];
  cameraAngle?: string;
  lighting?: string;
  imageUrl?: string;
  prompt?: string;
}

// Babylon.js integration types
export interface SceneViewer {
  sceneId: string;
  characters: CharacterModel[];
  props: PropModel[];
  location: LocationModel;
  camera: CameraConfig;
  lighting: LightingConfig;
}

export interface CharacterModel {
  id: string;
  name: string;
  glbPath?: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  animation?: string;
  fallbackModel?: string;
}

export interface PropModel {
  id: string;
  name: string;
  glbPath?: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
}

export interface LocationModel {
  id: string;
  skyboxPath?: string;
  glbPath?: string;
  ambientLight?: {
    intensity: number;
    color: string;
  };
}

export interface CameraConfig {
  type: 'universal' | 'arc_rotate' | 'follow';
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  fov: number;
  animations?: CameraAnimation[];
}

export interface CameraAnimation {
  duration: number;
  from: { x: number; y: number; z: number };
  to: { x: number; y: number; z: number };
  easing?: string;
}

export interface LightingConfig {
  hemisphere?: {
    direction: { x: number; y: number; z: number };
    groundColor: string;
    skyColor: string;
    intensity: number;
  };
  directional?: {
    direction: { x: number; y: number; z: number };
    color: string;
    intensity: number;
  }[];
  point?: {
    position: { x: number; y: number; z: number };
    color: string;
    intensity: number;
    range?: number;
  }[];
}