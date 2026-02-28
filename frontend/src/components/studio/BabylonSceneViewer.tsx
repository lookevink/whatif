import React, { useEffect, useRef, useState } from 'react';
import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import type { Scene, CharacterModel, PropModel, LocationModel, LightingConfig } from '../../lib/studio/types';

interface BabylonSceneViewerProps {
  scene: Scene;
  characters?: CharacterModel[];
  props?: PropModel[];
  location?: LocationModel;
  onReady?: (scene: BABYLON.Scene) => void;
}

export const BabylonSceneViewer: React.FC<BabylonSceneViewerProps> = ({
  scene: studioScene,
  characters = [],
  props = [],
  location,
  onReady
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BABYLON.Engine | null>(null);
  const sceneRef = useRef<BABYLON.Scene | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Initializing scene...');

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize Babylon.js
    const engine = new BABYLON.Engine(canvasRef.current, true, {
      preserveDrawingBuffer: true,
      stencil: true
    });
    engineRef.current = engine;

    const babylonScene = new BABYLON.Scene(engine);
    sceneRef.current = babylonScene;

    setupScene(babylonScene);

    // Handle window resize
    const handleResize = () => {
      engine.resize();
    };
    window.addEventListener('resize', handleResize);

    // Render loop
    engine.runRenderLoop(() => {
      babylonScene.render();
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      babylonScene.dispose();
      engine.dispose();
    };
  }, []);

  useEffect(() => {
    if (sceneRef.current) {
      loadSceneAssets();
    }
  }, [studioScene, characters, props, location]);

  const setupScene = async (babylonScene: BABYLON.Scene) => {
    // Set up camera
    const camera = new BABYLON.ArcRotateCamera(
      'camera',
      -Math.PI / 2,
      Math.PI / 3,
      10,
      BABYLON.Vector3.Zero(),
      babylonScene
    );
    camera.attachControl(canvasRef.current, true);
    camera.wheelPrecision = 50;
    camera.lowerRadiusLimit = 2;
    camera.upperRadiusLimit = 50;

    // Set up lighting
    setupLighting(babylonScene, studioScene.lighting as any);

    // Environment
    babylonScene.clearColor = new BABYLON.Color4(0.1, 0.1, 0.15, 1);
    babylonScene.ambientColor = new BABYLON.Color3(0.2, 0.2, 0.3);

    // Enable shadows
    setupShadows(babylonScene);

    setLoading(false);
    onReady?.(babylonScene);
  };

  const setupLighting = (babylonScene: BABYLON.Scene, lightingConfig?: LightingConfig) => {
    // Default hemisphere light
    const hemisphereLight = new BABYLON.HemisphericLight(
      'hemisphereLight',
      new BABYLON.Vector3(0, 1, 0),
      babylonScene
    );

    if (lightingConfig?.hemisphere) {
      hemisphereLight.direction = new BABYLON.Vector3(
        lightingConfig.hemisphere.direction.x,
        lightingConfig.hemisphere.direction.y,
        lightingConfig.hemisphere.direction.z
      );
      hemisphereLight.groundColor = BABYLON.Color3.FromHexString(lightingConfig.hemisphere.groundColor);
      hemisphereLight.diffuse = BABYLON.Color3.FromHexString(lightingConfig.hemisphere.skyColor);
      hemisphereLight.intensity = lightingConfig.hemisphere.intensity;
    } else {
      hemisphereLight.intensity = 0.7;
      hemisphereLight.groundColor = new BABYLON.Color3(0.2, 0.2, 0.3);
    }

    // Key light (directional)
    const keyLight = new BABYLON.DirectionalLight(
      'keyLight',
      new BABYLON.Vector3(-1, -2, -1),
      babylonScene
    );

    if (studioScene.lighting?.keyLight) {
      // Parse lighting from scene data
      const temp = parseInt(studioScene.lighting.keyLight.colorTemp?.replace('K', '') || '5600');
      keyLight.diffuse = colorTempToRGB(temp);
      keyLight.intensity = parseIntensity(studioScene.lighting.keyLight.intensity || 'medium');
    } else {
      keyLight.position = new BABYLON.Vector3(5, 10, 5);
      keyLight.intensity = 0.8;
    }

    // Fill light
    if (studioScene.lighting?.fillLight) {
      const fillLight = new BABYLON.DirectionalLight(
        'fillLight',
        new BABYLON.Vector3(1, -1, 1),
        babylonScene
      );
      const temp = parseInt(studioScene.lighting.fillLight.colorTemp?.replace('K', '') || '4500');
      fillLight.diffuse = colorTempToRGB(temp);
      fillLight.intensity = parseIntensity(studioScene.lighting.fillLight.intensity || 'low');
    }

    return keyLight;
  };

  const setupShadows = (babylonScene: BABYLON.Scene): BABYLON.ShadowGenerator | null => {
    const keyLight = babylonScene.getLightByName('keyLight') as BABYLON.DirectionalLight;
    if (!keyLight) return null;

    const shadowGenerator = new BABYLON.ShadowGenerator(1024, keyLight);
    shadowGenerator.useBlurExponentialShadowMap = true;
    shadowGenerator.blurKernel = 32;
    shadowGenerator.setDarkness(0.5);

    return shadowGenerator;
  };

  const loadSceneAssets = async () => {
    if (!sceneRef.current) return;

    setLoading(true);
    const babylonScene = sceneRef.current;

    // Clear existing meshes (except camera and lights)
    babylonScene.meshes.forEach(mesh => {
      if (mesh.name !== '__root__' && !mesh.name.includes('camera') && !mesh.name.includes('Light')) {
        mesh.dispose();
      }
    });

    try {
      // Load location/environment
      if (location) {
        setLoadingMessage('Loading environment...');
        await loadLocation(babylonScene, location);
      } else {
        // Create default ground
        const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: 20, height: 20 }, babylonScene);
        const groundMat = new BABYLON.StandardMaterial('groundMat', babylonScene);
        groundMat.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.35);
        ground.material = groundMat;
        ground.receiveShadows = true;
      }

      // Load characters
      for (let i = 0; i < characters.length; i++) {
        setLoadingMessage(`Loading character ${i + 1}/${characters.length}...`);
        await loadCharacter(babylonScene, characters[i]);
      }

      // Load props
      for (let i = 0; i < props.length; i++) {
        setLoadingMessage(`Loading prop ${i + 1}/${props.length}...`);
        await loadProp(babylonScene, props[i]);
      }

      // Apply blocking if available
      if (studioScene.blocking) {
        applyBlocking(babylonScene, studioScene.blocking);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading scene assets:', error);
      setLoadingMessage('Error loading assets');

      // Create fallback scene
      createFallbackScene(babylonScene);
      setLoading(false);
    }
  };

  const loadLocation = async (babylonScene: BABYLON.Scene, location: LocationModel) => {
    if (location.skyboxPath) {
      // Load skybox
      const skyboxMaterial = new BABYLON.StandardMaterial('skyBox', babylonScene);
      skyboxMaterial.backFaceCulling = false;
      skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture(location.skyboxPath, babylonScene);
      skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
      skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
      skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);

      const skybox = BABYLON.MeshBuilder.CreateBox('skyBox', { size: 100 }, babylonScene);
      skybox.material = skyboxMaterial;
    }

    if (location.glbPath) {
      // Load GLB model
      try {
        const result = await BABYLON.SceneLoader.AppendAsync(
          '',
          location.glbPath,
          babylonScene
        );
        result.meshes.forEach(mesh => {
          mesh.receiveShadows = true;
        });
      } catch (error) {
        console.warn('Failed to load location GLB:', error);
        createDefaultEnvironment(babylonScene);
      }
    } else {
      createDefaultEnvironment(babylonScene);
    }
  };

  const loadCharacter = async (babylonScene: BABYLON.Scene, character: CharacterModel) => {
    if (character.glbPath) {
      try {
        const result = await BABYLON.SceneLoader.AppendAsync(
          '',
          character.glbPath,
          babylonScene
        );

        const root = result.meshes[0];
        root.name = `character_${character.id}`;
        root.position = new BABYLON.Vector3(
          character.position.x,
          character.position.y,
          character.position.z
        );
        root.rotation = new BABYLON.Vector3(
          character.rotation.x,
          character.rotation.y,
          character.rotation.z
        );

        // Enable shadows
        result.meshes.forEach(mesh => {
          mesh.receiveShadows = true;
          const shadowGen = babylonScene.lights[0]?.getShadowGenerator();
          if (shadowGen && 'addShadowCaster' in shadowGen) {
            (shadowGen as any).addShadowCaster(mesh);
          }
        });

      } catch (error) {
        console.warn(`Failed to load character ${character.id}:`, error);
        createFallbackCharacter(babylonScene, character);
      }
    } else {
      createFallbackCharacter(babylonScene, character);
    }
  };

  const loadProp = async (babylonScene: BABYLON.Scene, prop: PropModel) => {
    if (prop.glbPath) {
      try {
        const result = await BABYLON.SceneLoader.AppendAsync(
          '',
          prop.glbPath,
          babylonScene
        );

        const root = result.meshes[0];
        root.name = `prop_${prop.id}`;
        root.position = new BABYLON.Vector3(prop.position.x, prop.position.y, prop.position.z);
        root.rotation = new BABYLON.Vector3(prop.rotation.x, prop.rotation.y, prop.rotation.z);
        root.scaling = new BABYLON.Vector3(prop.scale.x, prop.scale.y, prop.scale.z);

      } catch (error) {
        console.warn(`Failed to load prop ${prop.id}:`, error);
        createFallbackProp(babylonScene, prop);
      }
    } else {
      createFallbackProp(babylonScene, prop);
    }
  };

  const createFallbackCharacter = (babylonScene: BABYLON.Scene, character: CharacterModel) => {
    // Create a simple capsule as fallback
    const capsule = BABYLON.MeshBuilder.CreateCapsule(
      `character_${character.id}`,
      { height: 1.8, radius: 0.3 },
      babylonScene
    );

    const mat = new BABYLON.StandardMaterial(`mat_${character.id}`, babylonScene);
    mat.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.7);
    capsule.material = mat;

    capsule.position = new BABYLON.Vector3(
      character.position.x,
      character.position.y + 0.9,
      character.position.z
    );

    // Add name label
    const nameTexture = new BABYLON.DynamicTexture(`name_${character.id}`, { width: 256, height: 64 }, babylonScene);
    nameTexture.drawText(character.name, 10, 40, 'bold 36px Arial', 'white', 'transparent');

    const namePlane = BABYLON.MeshBuilder.CreatePlane(`nameplate_${character.id}`, { width: 2, height: 0.5 }, babylonScene);
    const nameMat = new BABYLON.StandardMaterial(`namemat_${character.id}`, babylonScene);
    nameMat.diffuseTexture = nameTexture;
    nameMat.emissiveTexture = nameTexture;
    nameMat.backFaceCulling = false;
    namePlane.material = nameMat;
    namePlane.parent = capsule;
    namePlane.position.y = 1.2;
    namePlane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
  };

  const createFallbackProp = (babylonScene: BABYLON.Scene, prop: PropModel) => {
    const box = BABYLON.MeshBuilder.CreateBox(
      `prop_${prop.id}`,
      { size: 0.5 },
      babylonScene
    );

    const mat = new BABYLON.StandardMaterial(`propmat_${prop.id}`, babylonScene);
    mat.diffuseColor = new BABYLON.Color3(0.7, 0.5, 0.3);
    box.material = mat;

    box.position = new BABYLON.Vector3(prop.position.x, prop.position.y, prop.position.z);
    box.scaling = new BABYLON.Vector3(prop.scale.x, prop.scale.y, prop.scale.z);
  };

  const createDefaultEnvironment = (babylonScene: BABYLON.Scene) => {
    const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: 20, height: 20 }, babylonScene);
    const groundMat = new BABYLON.StandardMaterial('groundMat', babylonScene);

    // Create checkered texture
    const texture = new BABYLON.DynamicTexture('groundTexture', { width: 512, height: 512 }, babylonScene);
    const ctx = texture.getContext();

    const tileSize = 64;
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        ctx.fillStyle = (i + j) % 2 === 0 ? '#444444' : '#555555';
        ctx.fillRect(i * tileSize, j * tileSize, tileSize, tileSize);
      }
    }
    texture.update();

    groundMat.diffuseTexture = texture;
    ground.material = groundMat;
    ground.receiveShadows = true;
  };

  const createFallbackScene = (babylonScene: BABYLON.Scene) => {
    createDefaultEnvironment(babylonScene);

    // Add some basic geometry to show something is working
    const sphere = BABYLON.MeshBuilder.CreateSphere('fallbackSphere', { diameter: 2 }, babylonScene);
    sphere.position.y = 1;

    const mat = new BABYLON.StandardMaterial('fallbackMat', babylonScene);
    mat.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.7);
    sphere.material = mat;
  };

  const applyBlocking = (babylonScene: BABYLON.Scene, blocking: any) => {
    // Apply character positions from blocking data
    if (blocking.characterMovements) {
      blocking.characterMovements.forEach((movement: any) => {
        const mesh = babylonScene.getMeshByName(`character_${movement.character}`);
        if (mesh && movement.movements.length > 0) {
          const lastMovement = movement.movements[movement.movements.length - 1];
          if (blocking.space?.keyPositions?.[lastMovement.position]) {
            const pos = blocking.space.keyPositions[lastMovement.position];
            mesh.position.x = pos.x;
            mesh.position.z = pos.y; // Using y as z for 2D to 3D mapping
          }
        }
      });
    }
  };

  const colorTempToRGB = (kelvin: number): BABYLON.Color3 => {
    // Approximate color temperature to RGB conversion
    let r, g, b;
    kelvin = kelvin / 100;

    if (kelvin <= 66) {
      r = 255;
      g = kelvin;
      g = 99.4708025861 * Math.log(g) - 161.1195681661;
      if (kelvin <= 19) {
        b = 0;
      } else {
        b = kelvin - 10;
        b = 138.5177312231 * Math.log(b) - 305.0447927307;
      }
    } else {
      r = kelvin - 60;
      r = 329.698727446 * Math.pow(r, -0.1332047592);
      g = kelvin - 60;
      g = 288.1221695283 * Math.pow(g, -0.0755148492);
      b = 255;
    }

    return new BABYLON.Color3(
      Math.min(255, Math.max(0, r)) / 255,
      Math.min(255, Math.max(0, g)) / 255,
      Math.min(255, Math.max(0, b)) / 255
    );
  };

  const parseIntensity = (intensity: string): number => {
    switch (intensity.toLowerCase()) {
      case 'very_low': return 0.2;
      case 'low': return 0.4;
      case 'medium': return 0.6;
      case 'high': return 0.8;
      case 'very_high': return 1.0;
      default: return 0.5;
    }
  };

  return (
    <div className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ outline: 'none' }}
      />

      {loading && (
        <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p>{loadingMessage}</p>
          </div>
        </div>
      )}

      <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white p-2 rounded">
        <p className="text-sm font-mono">Scene: {studioScene.id}</p>
        {studioScene._status && (
          <p className="text-xs text-yellow-400">
            Confidence: {Math.round(studioScene._status.confidence * 100)}%
          </p>
        )}
      </div>

      <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white p-2 rounded">
        <p className="text-xs">Drag to rotate • Scroll to zoom</p>
      </div>
    </div>
  );
};