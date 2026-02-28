import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { GitTreeVisualization } from './components/studio/GitTreeVisualization';
import { SceneSelector } from './components/studio/SceneSelector';
import { BabylonSceneViewer } from './components/studio/BabylonSceneViewer';
import { StoryboardGenerator } from './components/studio/StoryboardGenerator';
import { WhatIfExplorer } from './components/studio/WhatIfExplorer';
import type { Scene, Commit, CharacterModel, LocationModel, PropModel } from './lib/studio/types';
import { CHARACTER_SPACING, CHARACTER_BASELINE_Y, CHARACTER_DEPTH_SPACING } from './lib/studio/constants';

const PROJECT_ROOT = '/api/studio/projects/default';

function toGlbUrl(projectRelativePath: string): string {
  return `${PROJECT_ROOT}/files/${projectRelativePath}`;
}

export const StudioApp: React.FC = () => {
  const [currentBranch, setCurrentBranch] = useState<string>('main');
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<Commit | null>(null);
  const [activeTab, setActiveTab] = useState<'viewer' | 'storyboard' | 'whatif'>('viewer');

  // Mock data for development
  const [sceneModels, setSceneModels] = useState<{
    characters: CharacterModel[];
    props: PropModel[];
    location: LocationModel | undefined;
  }>({
    characters: [],
    props: [],
    location: undefined
  });

  const handleBranchSelect = (branch: string) => {
    setCurrentBranch(branch);
    setSelectedScene(null); // Reset scene when branch changes
  };

  const handleCommitSelect = (commit: Commit, branch: string) => {
    setSelectedCommit(commit);
    console.log('Selected commit:', commit, 'on branch:', branch);
  };

  const handleSceneSelect = (scene: Scene) => {
    setSelectedScene(scene);

    // Convert scene data to Babylon models
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
        fallbackModel: 'capsule' as const
      };
    }) || [];

    const location: LocationModel = {
      id: locId,
      glbPath: glbModel ? toGlbUrl(glbModel) : undefined,
      ambientLight: {
        intensity: 0.5,
        color: '#ffffff'
      }
    };

    setSceneModels({ characters, props: [], location });
  };

  const handleWhatIfQuery = async (query: string) => {
    console.log('What-if query:', query);
    // This would trigger the what-if system
  };

  return (
    <div className="flex flex-col h-screen bg-gray-700">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-800">Whatif Studio</h1>
        </div>
      </header>

      {/* Git Visualization */}
      <div className="px-6 py-4">
        <GitTreeVisualization
          currentBranch={currentBranch}
          onBranchSelect={handleBranchSelect}
          onCommitSelect={handleCommitSelect}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Scene Selector */}
        <div className="w-1/4 bg-white border-r border-gray-200 overflow-y-auto">
          <SceneSelector
            branch={currentBranch}
            onSceneSelect={handleSceneSelect}
            projectRoot="/api/studio/projects/default"
          />
        </div>

        {/* Right Panel - Main Viewer */}
        <div className="flex-1 flex flex-col">
          {selectedScene ? (
            <>
              {/* Tab Navigation */}
              <div className="bg-white border-b border-gray-200">
                <div className="flex space-x-1 px-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTab('viewer')}
                    className={activeTab === 'viewer' ? 'text-blue-600 border-b-2 border-blue-600 rounded-none' : 'text-gray-600 hover:text-gray-800'}
                  >
                    3D Viewer
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTab('storyboard')}
                    className={activeTab === 'storyboard' ? 'text-blue-600 border-b-2 border-blue-600 rounded-none' : 'text-gray-600 hover:text-gray-800'}
                  >
                    Storyboard
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTab('whatif')}
                    className={activeTab === 'whatif' ? 'text-blue-600 border-b-2 border-blue-600 rounded-none' : 'text-gray-600 hover:text-gray-800'}
                  >
                    What If...
                  </Button>
                </div>
              </div>

              {/* Tab Content */}
              <div className="flex-1 p-4">
                {activeTab === 'viewer' && (
                  <div className="h-full">
                    <BabylonSceneViewer
                      scene={selectedScene}
                      characters={sceneModels.characters}
                      props={sceneModels.props}
                      location={sceneModels.location}
                    />
                  </div>
                )}

                {activeTab === 'storyboard' && (
                  <StoryboardGenerator scene={selectedScene} />
                )}

                {activeTab === 'whatif' && (
                  <WhatIfExplorer
                    scene={selectedScene}
                    branch={currentBranch}
                    onQuery={handleWhatIfQuery}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h18M3 16h18" />
                </svg>
                <p className="mt-4 text-lg">Select a scene to begin</p>
                <p className="mt-2 text-sm">Choose a branch and scene from the left panel</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <footer className="bg-white border-t border-gray-200 px-6 py-2">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center space-x-4">
            <span>Branch: <strong>{currentBranch}</strong></span>
            {selectedScene && (
              <span>Scene: <strong>{selectedScene.id}</strong></span>
            )}
            {selectedCommit && (
              <span>Commit: <strong>{selectedCommit.id.substring(0, 7)}</strong></span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {selectedScene?._status && !selectedScene._status.complete && (
              <span className="text-yellow-600">
                ⚠ Incomplete data (Confidence: {Math.round(selectedScene._status.confidence * 100)}%)
              </span>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};