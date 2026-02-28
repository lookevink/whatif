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
    if (!acc[scene.act]) acc[scene.act] = [];
    acc[scene.act].push(scene);
    return acc;
  }, {} as Record<string, Scene[]>);

  if (loading) {
    return (
      <div className="w-full p-12 flex items-center justify-center border-4 border-[#121212] bg-white shadow-bauhaus-lg">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#121212] border-t-[#D02020] rounded-full animate-spin" />
          <p className="font-bold uppercase tracking-widest text-[#121212]">Loading scenes</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white border-4 border-[#121212] shadow-bauhaus-lg p-6 sm:p-8">
      <h2 className="font-subheading text-[#121212] mb-6 sm:mb-8">Scene Navigator</h2>

      <div className="space-y-8">
        {Object.entries(groupedScenes).map(([act, actScenes]) => (
          <div key={act}>
            <h3 className="font-label text-[#121212] mb-4 capitalize tracking-widest text-sm sm:text-base">
              {act.replace('act', 'Act ')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {actScenes.map((scene, idx) => {
                const accentColors = ['#D02020', '#1040C0', '#F0C020'] as const;
                const accent = accentColors[idx % 3];
                return (
                  <button
                    key={scene.id}
                    type="button"
                    onClick={() => handleSceneSelect(scene)}
                    className="relative text-left w-full p-4 sm:p-5 bg-white border-4 border-[#121212] shadow-bauhaus hover:-translate-y-1 hover:shadow-bauhaus-md transition-all duration-200 ease-out group"
                  >
                    {/* Corner decoration – geometric shape */}
                    <div
                      className="absolute top-2 right-2 w-2 h-2 sm:w-3 sm:h-3 border-2 border-[#121212]"
                      style={{
                        backgroundColor: accent,
                        clipPath: idx % 3 === 2 ? 'polygon(50% 0%, 0% 100%, 100% 100%)' : undefined,
                        borderRadius: idx % 3 === 0 ? '9999px' : 0,
                      }}
                    />

                    <div className="flex items-start justify-between mb-2 pr-4">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-[#121212] truncate uppercase text-sm">
                          {scene.id.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </div>
                        {scene.location && (
                          <div className="text-xs text-[#121212]/70 mt-1 font-medium">
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
                      <div className="mt-3">
                        <div className="text-xs font-bold text-[#121212] uppercase tracking-wider mb-2">Characters</div>
                        <div className="flex flex-wrap gap-1">
                          {scene.characters.slice(0, 3).map((char, i) => (
                            <span
                              key={i}
                              className="text-xs px-2 py-1 bg-[#121212] text-white font-bold uppercase"
                            >
                              {typeof char === 'string' ? char : char.name}
                            </span>
                          ))}
                          {scene.characters.length > 3 && (
                            <span className="text-xs px-2 py-1 bg-[#121212] text-white font-bold">
                              +{scene.characters.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
