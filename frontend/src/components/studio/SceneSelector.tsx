import React, { useState, useEffect } from 'react';
import type { Scene } from '../../lib/studio/types';
import { StudioDataLoader } from '../../lib/studio/data-loader';
import { ConfidenceBadge } from './ConfidenceBadge';

interface SceneSelectorProps {
  branch: string;
  onSceneSelect: (scene: Scene) => void;
  projectRoot?: string;
}

export const SceneSelector: React.FC<SceneSelectorProps> = ({
  branch,
  onSceneSelect,
  projectRoot = '.'
}) => {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadScenes();
  }, [branch]);

  const loadScenes = async () => {
    setLoading(true);
    try {
      const loader = new StudioDataLoader(projectRoot);
      const sceneRefs = await loader.loadAllScenes();
      const loadedScenes = await Promise.all(
        sceneRefs.map(ref => loader.loadScene(ref.id, ref.act))
      );
      setScenes(loadedScenes);
    } catch (error) {
      console.error('Failed to load scenes:', error);
      // Fallback mock data
      setScenes([
        {
          id: 'scene_001',
          act: 'act1',
          sceneOrder: 1,
          characters: [],
          dialogue: [],
          _status: {
            complete: true,
            missingFields: [],
            generatedFields: [],
            confidence: 1.0,
            lastChecked: new Date().toISOString()
          }
        } as Scene
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSceneSelect = (scene: Scene) => {
    onSceneSelect(scene);
  };

  const groupedScenes = scenes.reduce((acc, scene) => {
    if (!acc[scene.act]) {
      acc[scene.act] = [];
    }
    acc[scene.act].push(scene);
    return acc;
  }, {} as Record<string, Scene[]>);

  if (loading) {
    return (
      <div className="w-full p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white rounded-lg shadow-lg p-6 border border-gray-200">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Scene Navigator</h2>

      <div className="space-y-6">
        {Object.entries(groupedScenes).map(([act, actScenes]) => (
          <div key={act}>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 capitalize">{act.replace('act', 'Act ')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {actScenes.map((scene) => (
                <button
                  key={scene.id}
                  onClick={() => handleSceneSelect(scene)}
                  className="relative p-4 rounded-lg border-2 border-gray-300 bg-white hover:border-gray-900 hover:shadow-md transition-all text-left"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 truncate">
                        {scene.id.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                      </div>
                      {scene.location && (
                        <div className="text-xs text-gray-600 mt-1">
                          {typeof scene.location === 'string' ? scene.location : scene.location.name}
                        </div>
                      )}
                    </div>
                    {scene._status && (
                      <div className="flex-shrink-0 ml-1" onClick={(e) => e.stopPropagation()}>
                        <ConfidenceBadge
                          confidence={scene._status.confidence}
                          missingFields={scene._status.missingFields}
                          generatedFields={scene._status.generatedFields}
                          complete={scene._status.complete}
                        />
                      </div>
                    )}
                  </div>

                  {scene.characters && scene.characters.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs font-medium text-gray-700 mb-1">Characters</div>
                      <div className="flex flex-wrap gap-1">
                        {scene.characters.slice(0, 3).map((char, idx) => (
                          <span key={idx} className="text-xs px-2 py-1 bg-gray-800 text-white rounded">
                            {typeof char === 'string' ? char : char.name}
                          </span>
                        ))}
                        {scene.characters.length > 3 && (
                          <span className="text-xs px-2 py-1 bg-gray-800 text-white rounded">
                            +{scene.characters.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};