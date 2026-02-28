import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GitTreeVisualization } from '../components/studio/GitTreeVisualization';
import { SceneSelector } from '../components/studio/SceneSelector';
import type { Scene, Commit } from '../lib/studio/types';

export const SceneSelectPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentBranch, setCurrentBranch] = useState<string>('main');
  const [selectedCommit, setSelectedCommit] = useState<Commit | null>(null);

  const handleBranchSelect = (branch: string) => {
    setCurrentBranch(branch);
  };

  const handleCommitSelect = (commit: Commit, _branch: string) => {
    setSelectedCommit(commit);
  };

  const handleSceneSelect = (scene: Scene) => {
    navigate(`/scene/${encodeURIComponent(scene.id)}`, {
      state: { scene, branch: currentBranch }
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-800">Whatif Studio</h1>
        </div>
      </header>

      <div className="flex-1 px-6 py-6">
        <div className="mb-6">
          <GitTreeVisualization
            currentBranch={currentBranch}
            onBranchSelect={handleBranchSelect}
            onCommitSelect={handleCommitSelect}
          />
        </div>

        <SceneSelector
          branch={currentBranch}
          onSceneSelect={handleSceneSelect}
          projectRoot="/api/studio/projects/default"
        />
      </div>

      <footer className="bg-white border-t border-gray-200 px-6 py-2">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Branch: <strong>{currentBranch}</strong></span>
          {selectedCommit && (
            <span>Commit: <strong>{selectedCommit.id.substring(0, 7)}</strong></span>
          )}
        </div>
      </footer>
    </div>
  );
};
