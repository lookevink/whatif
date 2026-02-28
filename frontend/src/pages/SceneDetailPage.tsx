import React, { useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { BabylonSceneViewer } from '../components/studio/BabylonSceneViewer';
import { StoryboardGenerator } from '../components/studio/StoryboardGenerator';
import { WhatIfExplorer } from '../components/studio/WhatIfExplorer';
import { ConfidenceBadge } from '../components/studio/ConfidenceBadge';
import type { Scene, CharacterModel, PropModel, LocationModel } from '../lib/studio/types';

export const SceneDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { sceneId } = useParams();
  const { state } = useLocation() as { state?: { scene: Scene; branch: string } };
  const [scene] = useState<Scene | null>(state?.scene ?? null);
  const [branch] = useState<string>(state?.branch ?? 'main');
  const [showWhatIf, setShowWhatIf] = useState(false);
  const [viewerFullscreen, setViewerFullscreen] = useState(false);

  const [sceneModels, setSceneModels] = useState<{
    characters: CharacterModel[];
    props: PropModel[];
    location: LocationModel | undefined;
  }>({
    characters: [],
    props: [],
    location: undefined
  });

  // If we navigated here without state (e.g. refresh), we'd need to load the scene
  // For now, redirect back if no scene
  React.useEffect(() => {
    if (!scene && sceneId) {
      // Could fetch scene by ID here; for now redirect
      navigate('/', { replace: true });
    }
  }, [scene, sceneId, navigate]);

  React.useEffect(() => {
    if (!scene) return;
    const characters: CharacterModel[] = scene.characters?.map((char, idx) => ({
      id: typeof char === 'string' ? char : char.id,
      name: typeof char === 'string' ? char : char.name,
      position: { x: idx * 2 - 2, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      fallbackModel: 'capsule'
    })) || [];
    const location: LocationModel = {
      id: typeof scene.location === 'string' ? scene.location : scene.location?.id || 'default',
      ambientLight: { intensity: 0.5, color: '#ffffff' }
    };
    setSceneModels({ characters, props: [], location });
  }, [scene]);

  const handleWhatIfQuery = async (query: string) => {
    console.log('What-if query:', query);
  };

  if (!scene) return null;

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
