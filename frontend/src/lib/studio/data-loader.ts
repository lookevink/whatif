import type { Scene, CharacterProfile, Location, DataStatus } from './types';
import * as yaml from 'js-yaml';

/**
 * Resilient data loader that handles missing files and incomplete data
 * Falls back to AI generation when necessary
 */
export class StudioDataLoader {
  private projectRoot: string;
  // private fallbackCache: Map<string, DataFallback> = new Map(); // Unused for now

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  /**
   * Load a scene with all its associated data
   * Gracefully handles missing files and generates fallbacks
   */
  async loadScene(sceneId: string): Promise<Scene> {
    const scenePath = `${this.projectRoot}/scenes/${this.getActFromSceneId(sceneId)}/${sceneId}`;
    const scene: Partial<Scene> = {
      id: sceneId,
      _status: {
        complete: false,
        missingFields: [],
        generatedFields: [],
        confidence: 1.0,
        lastChecked: new Date().toISOString()
      }
    };

    // Try to load core scene data
    try {
      const sceneYaml = await this.loadYaml(`${scenePath}/scene.yaml`);
      Object.assign(scene, sceneYaml);
    } catch (error) {
      scene._status!.missingFields.push('scene.yaml');
      // Generate basic scene info from ID
      scene.act = this.getActFromSceneId(sceneId);
      scene.sceneOrder = parseInt(sceneId.replace(/\D/g, '')) || 1;
      scene._status!.generatedFields.push('act', 'sceneOrder');
      scene._status!.confidence *= 0.8;
    }

    // Load dialogue
    try {
      const dialogueJson = await this.loadJson(`${scenePath}/dialogue.json`);
      scene.dialogue = dialogueJson;
    } catch (error) {
      scene._status!.missingFields.push('dialogue.json');
      // Will need to generate from directions or context
      scene.dialogue = [];
      scene._status!.confidence *= 0.7;
    }

    // Load directions
    try {
      const directions = await this.loadFile(`${scenePath}/directions.md`);
      scene.directions = directions;
    } catch (error) {
      scene._status!.missingFields.push('directions.md');
      scene.directions = '';
      scene._status!.confidence *= 0.9;
    }

    // Load camera setup
    try {
      const camera = await this.loadYaml(`${scenePath}/camera.yaml`);
      scene.camera = camera;
    } catch (error) {
      scene._status!.missingFields.push('camera.yaml');
      // Generate default camera setup
      scene.camera = this.generateDefaultCameraSetup(scene as Scene);
      scene._status!.generatedFields.push('camera');
      scene._status!.confidence *= 0.85;
    }

    // Load lighting
    try {
      const lighting = await this.loadYaml(`${scenePath}/lighting.yaml`);
      scene.lighting = lighting;
    } catch (error) {
      scene._status!.missingFields.push('lighting.yaml');
      scene.lighting = this.generateDefaultLighting(scene as Scene);
      scene._status!.generatedFields.push('lighting');
      scene._status!.confidence *= 0.85;
    }

    // Load blocking
    try {
      const blocking = await this.loadYaml(`${scenePath}/blocking.yaml`);
      scene.blocking = blocking;
    } catch (error) {
      scene._status!.missingFields.push('blocking.yaml');
      scene._status!.confidence *= 0.8;
    }

    // Load audio setup
    try {
      const audio = await this.loadYaml(`${scenePath}/audio.yaml`);
      scene.audio = audio;
    } catch (error) {
      scene._status!.missingFields.push('audio.yaml');
      scene._status!.confidence *= 0.9;
    }

    // Load characters
    scene.characters = await this.loadSceneCharacters(scene);

    // Load location
    if (scene.location) {
      scene.location = await this.loadLocation(scene.location as any);
    }

    // Update status
    scene._status!.complete = scene._status!.missingFields.length === 0;

    return scene as Scene;
  }

  /**
   * Load character data with fallbacks
   */
  async loadCharacter(characterId: string): Promise<CharacterProfile> {
    const charPath = `${this.projectRoot}/characters/${characterId}`;
    const character: Partial<CharacterProfile> = {
      id: characterId,
      name: characterId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    };

    // Load profile
    try {
      const profile = await this.loadYaml(`${charPath}/profile.yaml`);
      Object.assign(character, profile);
    } catch (error) {
      // Generate basic profile from name
      character.personality = {
        traits: ['complex', 'evolving'],
        flaws: [],
        strengths: []
      };
    }

    // Load voice
    try {
      const voice = await this.loadYaml(`${charPath}/voice.yaml`);
      character.voice = voice;
    } catch (error) {
      // Generate default voice profile
      character.voice = {
        speechPatterns: {
          sentenceLength: 'medium',
          vocabularyLevel: 'standard',
          verbalTics: [],
          avoids: [],
          dialect: 'neutral'
        }
      };
    }

    return character as CharacterProfile;
  }

  /**
   * Load location data with fallbacks
   */
  async loadLocation(locationId: string | Location): Promise<Location> {
    if (typeof locationId !== 'string') {
      return locationId;
    }

    const locPath = `${this.projectRoot}/world/locations/${locationId}`;
    const location: Partial<Location> = {
      id: locationId,
      name: locationId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    };

    try {
      const description = await this.loadYaml(`${locPath}/description.yaml`);
      Object.assign(location, description);
    } catch (error) {
      // Generate basic location from ID
      location.type = locationId.includes('apartment') || locationId.includes('room') ? 'interior' : 'exterior';
      location.atmosphere = {
        defaultLighting: 'natural',
        defaultSound: [],
        mood: 'neutral'
      };
    }

    // Try to load visual assets
    try {
      const visual = await this.loadYaml(`${locPath}/assets/visual.yaml`);
      if (visual.skybox) {
        location.skybox = visual.skybox;
      }
      if (visual.glbModel) {
        location.glbModel = visual.glbModel;
      }
    } catch (error) {
      // No visual assets, will use defaults
    }

    return location as Location;
  }

  /**
   * Load all available scenes in the project
   * Browser version - would need API endpoint
   */
  async loadAllScenes(): Promise<string[]> {
    try {
      // In browser, this would call an API endpoint
      const response = await fetch(`/api/studio/scenes`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.warn('Could not load scenes:', error);
    }

    // Fallback mock data
    return ['scene_001', 'scene_002', 'scene_003', 'scene_004', 'scene_005'];
  }

  /**
   * Check data integrity and report missing assets
   */
  async checkDataIntegrity(): Promise<{
    complete: boolean;
    report: {
      scenes: { [key: string]: DataStatus };
      characters: { [key: string]: DataStatus };
      locations: { [key: string]: DataStatus };
    };
  }> {
    const report = {
      scenes: {} as { [key: string]: DataStatus },
      characters: {} as { [key: string]: DataStatus },
      locations: {} as { [key: string]: DataStatus }
    };

    const scenes = await this.loadAllScenes();
    let allComplete = true;

    for (const sceneId of scenes) {
      const scene = await this.loadScene(sceneId);
      report.scenes[sceneId] = scene._status!;
      if (!scene._status!.complete) {
        allComplete = false;
      }
    }

    return {
      complete: allComplete,
      report
    };
  }

  // Helper methods

  private async loadYaml(filePath: string): Promise<any> {
    const response = await fetch(filePath);
    if (!response.ok) throw new Error(`Failed to load ${filePath}`);
    const content = await response.text();
    return yaml.load(content);
  }

  private async loadJson(filePath: string): Promise<any> {
    const response = await fetch(filePath);
    if (!response.ok) throw new Error(`Failed to load ${filePath}`);
    return await response.json();
  }

  private async loadFile(filePath: string): Promise<string> {
    const response = await fetch(filePath);
    if (!response.ok) throw new Error(`Failed to load ${filePath}`);
    return await response.text();
  }

  private getActFromSceneId(sceneId: string): string {
    const sceneNum = parseInt(sceneId.replace(/\D/g, '')) || 1;
    if (sceneNum <= 4) return 'act1';
    if (sceneNum <= 9) return 'act2';
    return 'act3';
  }

  private async loadSceneCharacters(scene: Partial<Scene>): Promise<any[]> {
    const characters = [];

    // Try to get character list from scene.yaml
    if (scene.characters && Array.isArray(scene.characters)) {
      for (const charRef of scene.characters) {
        const charId = typeof charRef === 'string' ? charRef : charRef.id;
        try {
          const character = await this.loadCharacter(charId);
          characters.push({ ...character, id: charId });
        } catch (error) {
          // Character not found, create placeholder
          characters.push({
            id: charId,
            name: charId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
          });
        }
      }
    } else if (scene.dialogue) {
      // Extract characters from dialogue
      const charSet = new Set<string>();
      for (const line of scene.dialogue) {
        if (line.character) {
          charSet.add(line.character);
        }
      }
      for (const charId of charSet) {
        try {
          const character = await this.loadCharacter(charId);
          characters.push({ ...character, id: charId });
        } catch (error) {
          characters.push({
            id: charId,
            name: charId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
          });
        }
      }
    }

    return characters;
  }

  private generateDefaultCameraSetup(scene: Scene): any {
    return {
      shots: [
        {
          id: 'shot_001',
          type: 'establishing',
          subject: scene.location?.name || 'location',
          lens: '35mm',
          movement: 'static',
          duration: '3s',
          framingNotes: 'Establish the scene',
          purpose: 'Set the location and mood'
        },
        {
          id: 'shot_002',
          type: 'medium',
          subject: 'characters',
          lens: '50mm',
          movement: 'static',
          duration: '10s',
          framingNotes: 'Character interaction',
          purpose: 'Dialogue coverage'
        }
      ],
      shotSequence: ['shot_001', 'shot_002'],
      sceneCoverage: {
        style: 'standard',
        avgShotLength: '6s',
        cutRhythm: 'medium'
      }
    };
  }

  private generateDefaultLighting(scene: Scene): any {
    const isInterior = scene.location?.type === 'interior';
    return {
      keyLight: {
        source: isInterior ? 'practical_lamp' : 'sun',
        direction: 'camera_left',
        intensity: 'medium',
        colorTemp: isInterior ? '3200K' : '5600K',
        quality: 'soft'
      },
      fillLight: {
        source: isInterior ? 'window_ambient' : 'sky',
        direction: 'camera_right',
        intensity: 'low',
        colorTemp: isInterior ? '4500K' : '6500K',
        quality: 'diffused'
      },
      mood: 'neutral',
      contrastRatio: '3:1'
    };
  }

  /**
   * Repair missing data using AI generation
   */
  async repairMissingData(sceneId: string): Promise<Scene> {
    const scene = await this.loadScene(sceneId);

    if (scene._status?.missingFields.length === 0) {
      return scene;
    }

    // This would call out to AI service to generate missing fields
    // For now, returning scene as-is
    console.log(`Scene ${sceneId} has missing fields:`, scene._status?.missingFields);
    console.log(`Would generate: ${scene._status?.missingFields.join(', ')}`);

    return scene;
  }
}