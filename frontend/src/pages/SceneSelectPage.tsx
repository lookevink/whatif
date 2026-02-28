import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GitTreeVisualization } from '../components/studio/GitTreeVisualization';
import { SceneSelector } from '../components/studio/SceneSelector';
import { BauhausLogo } from '../components/studio/BauhausLogo';
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
    <div className="flex flex-col min-h-screen bg-[#F0F0F0]">
      {/* Header – Blue color block with geometric composition */}
      <header className="bg-[#1040C0] border-b-4 border-[#121212] shadow-bauhaus-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <BauhausLogo size="lg" />
              <div>
                <h1 className="font-display text-white leading-[0.9] tracking-tighter">
                  Whatif Studio
                </h1>
                <p className="text-white/90 text-sm sm:text-base font-medium mt-1 tracking-wide">
                  Construct your narrative
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content – Off-white canvas */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        {/* Timeline section – Yellow accent block */}
        <section className="mb-8 sm:mb-12">
          <div className="bg-[#F0C020] border-4 border-[#121212] shadow-bauhaus-lg p-4 sm:p-6">
            <h2 className="font-subheading text-[#121212] mb-4 sm:mb-6">Timeline Explorer</h2>
            <GitTreeVisualization
              currentBranch={currentBranch}
              onBranchSelect={handleBranchSelect}
              onCommitSelect={handleCommitSelect}
            />
          </div>
        </section>

        {/* Scene Navigator – White card with hard shadow */}
        <section>
          <SceneSelector
            branch={currentBranch}
            onSceneSelect={handleSceneSelect}
            projectRoot="/api/studio/projects/default"
          />
        </section>
      </div>

      {/* Footer – Black bar */}
      <footer className="bg-[#121212] border-t-4 border-[#121212] py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-sm font-bold uppercase tracking-widest text-white">
          <span>Branch: <span className="text-[#F0C020]">{currentBranch}</span></span>
          {selectedCommit && (
            <span>Commit: <span className="text-[#F0C020] font-mono">{selectedCommit.id.substring(0, 7)}</span></span>
          )}
        </div>
      </footer>
    </div>
  );
};
