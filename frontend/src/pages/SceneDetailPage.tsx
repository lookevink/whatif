import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { BabylonSceneViewer } from '../components/studio/BabylonSceneViewer';
import { StoryboardGenerator } from '../components/studio/StoryboardGenerator';
import { WhatIfExplorer } from '../components/studio/WhatIfExplorer';
import { ConfidenceBadge } from '../components/studio/ConfidenceBadge';
import { StudioDataLoader } from '../lib/studio/data-loader';
import type { Scene, CharacterModel, PropModel, LocationModel } from '../lib/studio/types';

const PROJECT_ROOT = '/api/studio/projects/default';

function toGlbUrl(projectRelativePath: string): string {
  return `${PROJECT_ROOT}/files/${projectRelativePath}`;
}

export const SceneDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { sceneId } = useParams();
  const { state } = useLocation() as { state?: { scene: Scene; branch: string } };
  const [scene, setScene] = useState<Scene | null>(state?.scene ?? null);
  const [branch] = useState<string>(state?.branch ?? 'main');
  const [loading, setLoading] = useState(!state?.scene && !!sceneId);
  const [showWhatIf, setShowWhatIf] = useState(false);
  const [viewerFullscreen, setViewerFullscreen] = useState(false);

  const sceneModels = useMemo(() => {
    if (!scene) return { characters: [], props: [] as PropModel[], location: undefined as LocationModel | undefined };
    const loc = scene.location;
    const locId = typeof loc === 'string' ? loc : loc?.id || 'default';
    const glbModel = typeof loc === 'object' && loc?.glbModel;
    const characters: CharacterModel[] = scene.characters?.map((char, idx) => {
      const c = typeof char === 'string' ? { id: char, name: char } : char;
      return {
        id: c.id,
        name: c.name,
        glbPath: c.visual?.glbModel ? toGlbUrl(c.visual.glbModel) : undefined,
        position: { x: idx * 2 - 2, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        fallbackModel: 'capsule'
      };
    }) || [];
    const location: LocationModel = {
      id: locId,
      glbPath: glbModel ? toGlbUrl(glbModel) : undefined,
      ambientLight: { intensity: 0.5, color: '#ffffff' }
    };
    return { characters, props: [], location };
  }, [scene]);

  // Load scene when no state (e.g. refresh or direct URL)
  useEffect(() => {
    if (!scene && sceneId) {
      const loader = new StudioDataLoader(PROJECT_ROOT);
      loader.loadAllScenes()
        .then((refs) => {
          const ref = refs.find((r) => r.id === sceneId);
          return loader.loadScene(sceneId, ref?.act);
        })
        .then(setScene)
        .catch(() => navigate('/', { replace: true }))
        .finally(() => setLoading(false));
    }
  }, [scene, sceneId, navigate]);

  const handleWhatIfQuery = async (query: string) => {
    console.log('What-if query:', query);
  };

  if (loading || !scene) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
    </div>
  );

  return (
    <>
      <div className="flex flex-col min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="text-gray-600 hover:text-gray-800 text-sm font-medium"
              >
                ← Back to Scenes
              </button>
              <h1 className="text-xl font-bold text-gray-900">Scene: {scene.id}</h1>
              {scene._status && (
                <ConfidenceBadge
                  confidence={scene._status.confidence}
                  missingFields={scene._status.missingFields}
                  generatedFields={scene._status.generatedFields}
                  complete={scene._status.complete}
                />
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex flex-1 overflow-hidden">
            {/* Scene dialogue & directions */}
            {scene.dialogue && scene.dialogue.length > 0 && (
              <div className="w-80 flex-shrink-0 border-r border-gray-200 bg-white overflow-auto">
                <div className="p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Dialogue</h3>
                  <div className="space-y-2 text-sm">
                    {scene.dialogue.map((line, idx) => (
                      <div key={idx} className="border-l-2 border-gray-300 pl-3">
                        <span className="font-medium text-gray-800">{line.character}:</span>{' '}
                        <span className="text-gray-600">{line.line}</span>
                        {line.delivery && (
                          <span className="block text-xs text-gray-500 italic mt-0.5">{line.delivery}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  {scene.directions && (
                    <>
                      <h3 className="text-sm font-semibold text-gray-700 mt-4 mb-2">Directions</h3>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">{scene.directions}</p>
                    </>
                  )}
                </div>
              </div>
            )}
            {/* Storyboard panel */}
            <div className="flex-1 overflow-auto p-6">
              <StoryboardGenerator scene={scene} />
            </div>
          </div>

          {/* Round What If button */}
          <button
            onClick={() => setShowWhatIf(true)}
            className="fixed bottom-8 right-8 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg flex items-center justify-center text-sm font-medium transition-all hover:scale-110 z-40"
            title="What If..."
          >
            What if?
          </button>

          {/* 3D Viewer entry - small preview / enter fullscreen */}
          <div className="border-t border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">3D Preview</span>
              <button
                onClick={() => setViewerFullscreen(true)}
                className="px-4 py-2 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-700"
              >
                Enter Fullscreen 3D
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* What If panel - slides in when FAB clicked */}
      {showWhatIf && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowWhatIf(false)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Escape' && setShowWhatIf(false)}
          />
          <div className="relative ml-auto w-full max-w-lg bg-white shadow-2xl overflow-y-auto animate-slide-in">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">What-If Explorer</h2>
              <button
                onClick={() => setShowWhatIf(false)}
                className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-700"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <WhatIfExplorer
                scene={scene}
                branch={branch}
                onQuery={handleWhatIfQuery}
                embedded
              />
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen 3D Viewer */}
      {viewerFullscreen && (
        <div className="fixed inset-0 z-50 bg-black">
          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={() => setViewerFullscreen(false)}
              className="px-4 py-2 bg-white/90 hover:bg-white text-gray-800 rounded-lg font-medium shadow-lg"
            >
              Exit Fullscreen
            </button>
          </div>
          <div className="w-full h-full">
            <BabylonSceneViewer
              scene={scene}
              characters={sceneModels.characters}
              props={sceneModels.props}
              location={sceneModels.location}
              fullscreen
            />
          </div>
        </div>
      )}
    </>
  );
};
