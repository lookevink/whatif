import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { CircleHelp, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BabylonSceneViewer } from '../components/studio/BabylonSceneViewer';
import { StoryboardGenerator } from '../components/studio/StoryboardGenerator';
import { WhatIfExplorer } from '../components/studio/WhatIfExplorer';
import { CharacterDialoguePanel } from '../components/studio/CharacterDialoguePanel';
import { ConfidenceBadge } from '../components/studio/ConfidenceBadge';
import { BauhausLogo } from '../components/studio/BauhausLogo';
import { StudioDataLoader } from '../lib/studio/data-loader';
import type { Scene, CharacterModel, PropModel, LocationModel } from '../lib/studio/types';
import { CHARACTER_SPACING, CHARACTER_BASELINE_Y, CHARACTER_DEPTH_SPACING } from '../lib/studio/constants';

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
  const [showDialogue, setShowDialogue] = useState(false);
  const [viewerFullscreen, setViewerFullscreen] = useState(false);

  const sceneModels = useMemo(() => {
    if (!scene) return { characters: [], props: [] as PropModel[], location: undefined as LocationModel | undefined };
    const loc = scene.location;
    const locId = typeof loc === 'string' ? loc : loc?.id || 'default';
    const glbModel = typeof loc === 'object' && loc?.glbModel;
    const charCount = scene.characters?.length ?? 1;
    const centerOffset = (CHARACTER_SPACING * (charCount - 1)) / 2;
    const depthCenter = ((charCount - 1) * CHARACTER_DEPTH_SPACING) / 2;
    const characters: CharacterModel[] = scene.characters?.map((char, idx) => {
      const c = typeof char === 'string' ? { id: char, name: char } : char;
      return {
        id: c.id,
        name: c.name,
        glbPath: c.visual?.glbModel ? toGlbUrl(c.visual.glbModel) : undefined,
        position: {
          x: idx * CHARACTER_SPACING - centerOffset,
          y: CHARACTER_BASELINE_Y,
          z: idx * CHARACTER_DEPTH_SPACING - depthCenter
        },
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
    <div className="min-h-screen flex items-center justify-center bg-[#F0F0F0]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-[#121212] border-t-[#D02020] rounded-full animate-spin" />
        <p className="font-bold uppercase tracking-widest text-[#121212]">Loading scene</p>
      </div>
    </div>
  );

  return (
    <>
      <div className="flex flex-col min-h-screen bg-[#F0F0F0]">
        {/* Header – Red color block */}
        <header className="bg-[#D02020] border-b-4 border-[#121212] shadow-bauhaus-md">
          <div className="px-4 sm:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/')}
                className="bg-white text-[#121212] border-[#121212] shadow-bauhaus-sm"
              >
                ← Back to Scenes
              </Button>
              <div className="flex items-center gap-3">
                <BauhausLogo size="sm" />
                <h1 className="font-subheading text-white leading-tight">
                  Scene: {scene.id}
                </h1>
                {scene._status && (
                  <ConfidenceBadge
                    confidence={scene._status.confidence}
                    missingFields={scene._status.missingFields}
                    generatedFields={scene._status.generatedFields}
                    complete={scene._status.complete}
                    dark
                  />
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex flex-1 overflow-hidden">
            {/* Dialogue panel – White card */}
            {scene.dialogue && scene.dialogue.length > 0 && (
              <div className="w-80 flex-shrink-0 border-r-4 border-[#121212] bg-white overflow-auto">
                <div className="p-4 sm:p-6">
                  <h3 className="font-label text-[#121212] mb-3 tracking-widest text-sm">Dialogue</h3>
                  <div className="space-y-3 text-sm">
                    {scene.dialogue.map((line, idx) => (
                      <div key={idx} className="border-l-4 border-[#1040C0] pl-3">
                        <span className="font-bold text-[#121212] uppercase">{line.character}:</span>{' '}
                        <span className="text-[#121212]/90 font-medium">{line.line}</span>
                        {line.delivery && (
                          <span className="block text-xs text-[#121212]/60 italic mt-0.5 font-medium">{line.delivery}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  {scene.directions && (
                    <>
                      <h3 className="font-label text-[#121212] mt-6 mb-2 tracking-widest text-sm">Directions</h3>
                      <p className="text-sm text-[#121212]/90 font-medium whitespace-pre-wrap leading-relaxed">{scene.directions}</p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Storyboard – Off-white section */}
            <div className="flex-1 overflow-auto p-4 sm:p-6 bg-[#F0F0F0]">
              <StoryboardGenerator scene={scene} />
            </div>
          </div>

          {/* Character Dialogue FAB – Blue */}
          <Button
            size="icon-lg"
            variant="secondary"
            shape="pill"
            onClick={() => setShowDialogue(true)}
            className="fixed bottom-24 right-8 shadow-bauhaus-lg hover:-translate-y-1 transition-all duration-200 z-40"
            title="Character Dialogue"
            aria-label="Open Character Dialogue"
          >
            <MessageCircle className="size-8" strokeWidth={3} />
          </Button>

          {/* What If FAB – Yellow, geometric */}
          <Button
            size="icon-lg"
            variant="yellow"
            shape="pill"
            onClick={() => setShowWhatIf(true)}
            className="fixed bottom-8 right-8 shadow-bauhaus-lg hover:-translate-y-1 transition-all duration-200 z-40"
            title="What If..."
            aria-label="Open What-If Explorer"
          >
            <CircleHelp className="size-8" strokeWidth={3} />
          </Button>

          {/* 3D Preview bar – Blue accent */}
          <div className="border-t-4 border-[#121212] bg-[#1040C0] p-4">
            <div className="flex items-center justify-between">
              <span className="font-bold uppercase tracking-widest text-white text-sm">3D Preview</span>
              <Button
                variant="outline"
                onClick={() => setViewerFullscreen(true)}
                className="bg-white text-[#1040C0] border-2 border-[#121212] shadow-bauhaus hover:bg-white/90"
              >
                Enter Fullscreen 3D
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* What If panel – slides in */}
      {showWhatIf && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-[#121212]/60"
            onClick={() => setShowWhatIf(false)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Escape' && setShowWhatIf(false)}
          />
          <div className="relative ml-auto w-full max-w-lg bg-white border-l-4 border-[#121212] shadow-bauhaus-lg overflow-y-auto animate-slide-in">
            <div className="sticky top-0 bg-[#F0C020] border-b-4 border-[#121212] px-6 py-4 flex items-center justify-between">
              <h2 className="font-subheading text-[#121212]">What-If Explorer</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowWhatIf(false)}
                className="text-[#121212] hover:bg-[#121212]/10"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
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

      {/* Character Dialogue panel – slides in */}
      {showDialogue && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-[#121212]/60"
            onClick={() => setShowDialogue(false)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Escape' && setShowDialogue(false)}
          />
          <div className="relative ml-auto w-full max-w-xl bg-white border-l-4 border-[#121212] shadow-bauhaus-lg overflow-hidden flex flex-col animate-slide-in">
            <div className="flex-shrink-0 bg-[#1040C0] border-b-4 border-[#121212] px-6 py-4 flex items-center justify-between">
              <h2 className="font-subheading text-white">Character Dialogue</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDialogue(false)}
                className="text-white hover:bg-white/10"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            </div>
            <div className="flex-1 overflow-hidden p-6">
              <CharacterDialoguePanel scene={scene} />
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen 3D Viewer */}
      {viewerFullscreen && (
        <div className="fixed inset-0 z-50 bg-[#121212]">
          <div className="absolute top-4 right-4 z-10">
            <Button
              variant="outline"
              onClick={() => setViewerFullscreen(false)}
              className="bg-white text-[#121212] border-2 border-[#121212] shadow-bauhaus hover:bg-[#E0E0E0]"
            >
              Exit Fullscreen
            </Button>
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
