import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import type { Scene, WhatIfQuery } from '../../lib/studio/types';
import { ConfidenceBadge } from './ConfidenceBadge';
import { useWhatIf } from '../../hooks/useWhatIf';

interface WhatIfExplorerProps {
  scene: Scene;
  branch: string;
  onQuery: (query: string) => void;
  embedded?: boolean;
}

export const WhatIfExplorer: React.FC<WhatIfExplorerProps> = ({
  scene,
  branch,
  onQuery,
  embedded = false
}) => {
  const [query, setQuery] = useState('');
  const [queryHistory, setQueryHistory] = useState<WhatIfQuery[]>([]);
  const [branches, setBranches] = useState<Array<{ name: string; full_name: string }>>([]);

  const {
    loading,
    error,
    preview,
    result,
    previewWhatIf,
    createWhatIfScene,
    getSceneBranches,
    reset
  } = useWhatIf();

  // Load existing branches on mount
  useEffect(() => {
    getSceneBranches(scene.id)
      .then((data) => setBranches(data?.branches || []))
      .catch(() => {});
  }, [scene.id, getSceneBranches]);

  const exampleQueries = [
    "What if Victor refuses to help William?",
    "What if the Creature arrives during the confrontation?",
    "What if Elizabeth intervenes before William dies?",
    "What if Victor confesses his creation to William?",
    "What if a new character enters the scene?"
  ];

  const detectQueryType = (q: string): 'dialogue' | 'action' | 'character' | 'world' => {
    const lower = q.toLowerCase();
    if (lower.includes('says') || lower.includes('tells') || lower.includes('reveals') || lower.includes('confess')) return 'dialogue';
    if (lower.includes('character') || lower.includes('enters') || lower.includes('arrives')) return 'character';
    if (lower.includes('location') || lower.includes('world') || lower.includes('setting')) return 'world';
    return 'action';
  };

  const handlePreview = async () => {
    if (!query.trim()) return;
    try {
      await previewWhatIf({
        sceneId: scene.id,
        act: scene.act,
        whatIfText: query,
        projectName: 'default'
      });
    } catch {
      // error is set via hook state
    }
  };

  const handleCreateBranch = async () => {
    if (!query.trim()) return;
    try {
      const response = await createWhatIfScene({
        sceneId: scene.id,
        act: scene.act,
        whatIfText: query,
        currentBranch: branch,
        projectName: 'default'
      });

      // Add to history
      const newEntry: WhatIfQuery = {
        id: `query_${Date.now()}`,
        query,
        sceneId: scene.id,
        type: detectQueryType(query),
        changes: (preview?.changesSummary
          ? [
              ...preview.changesSummary.added.map((a) => ({
                path: a.split(':')[0],
                originalValue: null,
                newValue: a,
                impact: ['Added'],
                confidence: 0.9
              })),
              ...preview.changesSummary.modified.map((m) => ({
                path: m.split(':')[0],
                originalValue: m.split(' -> ')[0],
                newValue: m.split(' -> ')[1] || m,
                impact: ['Modified'],
                confidence: 0.85
              }))
            ]
          : []),
        branch: response?.branchName,
        status: 'complete'
      };
      setQueryHistory([newEntry, ...queryHistory]);

      // Refresh branches
      const branchData = await getSceneBranches(scene.id);
      setBranches(branchData?.branches || []);

      onQuery(query);
      setQuery('');
      reset();
    } catch {
      // error is set via hook state
    }
  };

  return (
    <div className={`h-full flex flex-col ${embedded ? '' : 'bg-white border-4 border-[#121212] shadow-bauhaus-lg'}`}>
      <div className={embedded ? 'pt-0' : 'p-4 sm:p-6 border-b-4 border-[#121212]'}>
        {!embedded && (
          <h2 className="font-subheading text-[#121212] mb-4">What-If Explorer</h2>
        )}

        <div className="space-y-4">
          <div>
            <label className="block font-label text-[#121212] text-xs tracking-widest mb-2">
              Ask a &quot;What If&quot; Question
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePreview()}
                placeholder="What if Victor refuses to help William?"
                className="flex-1 px-4 py-2 border-2 border-[#121212] bg-white font-medium focus:outline-none focus:ring-2 focus:ring-[#121212]"
                disabled={loading}
              />
              <Button
                variant="default"
                onClick={handlePreview}
                disabled={loading || !query.trim()}
              >
                {loading ? 'Processing...' : 'Preview'}
              </Button>
            </div>
          </div>

          <div>
            <p className="font-label text-[#121212] text-xs tracking-widest mb-2">Try these examples</p>
            <div className="flex flex-wrap gap-2">
              {exampleQueries.map((example, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="xs"
                  shape="pill"
                  onClick={() => setQuery(example)}
                  className="text-xs"
                >
                  {example}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {/* Error display */}
        {error && (
          <div className="mb-4 p-3 border-4 border-[#D02020] bg-[#D02020]/10">
            <p className="text-sm font-bold text-[#D02020]">{error}</p>
          </div>
        )}

        {/* Preview results */}
        {preview && (
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <h3 className="font-subheading text-[#121212] text-lg sm:text-xl">Preview Changes</h3>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={reset}>
                  Dismiss
                </Button>
                <Button variant="secondary" onClick={handleCreateBranch} disabled={loading}>
                  {loading ? 'Creating...' : 'Create Branch'}
                </Button>
              </div>
            </div>

            {/* Changes summary */}
            <div className="border-4 border-[#121212] bg-white shadow-bauhaus p-4 sm:p-6 mb-4">
              <p className="font-bold text-[#121212] uppercase text-sm mb-3">Changes Summary</p>
              <div className="space-y-2">
                {preview.changesSummary.added.length > 0 && (
                  <div>
                    <span className="text-xs font-bold uppercase text-[#1040C0]">Added: </span>
                    {preview.changesSummary.added.map((a, i) => (
                      <span key={i} className="text-xs px-2 py-1 bg-[#1040C0]/10 text-[#1040C0] border border-[#1040C0] font-bold mr-1 mb-1 inline-block">
                        {a}
                      </span>
                    ))}
                  </div>
                )}
                {preview.changesSummary.modified.length > 0 && (
                  <div>
                    <span className="text-xs font-bold uppercase text-[#F0C020]">Modified: </span>
                    {preview.changesSummary.modified.map((m, i) => (
                      <span key={i} className="text-xs px-2 py-1 bg-[#F0C020]/10 text-[#121212] border border-[#F0C020] font-bold mr-1 mb-1 inline-block">
                        {m}
                      </span>
                    ))}
                  </div>
                )}
                {preview.changesSummary.removed.length > 0 && (
                  <div>
                    <span className="text-xs font-bold uppercase text-[#D02020]">Removed: </span>
                    {preview.changesSummary.removed.map((r, i) => (
                      <span key={i} className="text-xs px-2 py-1 bg-[#D02020]/10 text-[#D02020] border border-[#D02020] font-bold mr-1 mb-1 inline-block">
                        {r}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* YAML diff */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="border-4 border-[#121212] p-4">
                <p className="font-label text-[#121212] text-xs mb-2">Original YAML</p>
                <pre className="text-xs bg-[#E0E0E0] p-3 border-2 border-[#121212] overflow-x-auto font-mono max-h-48 overflow-y-auto">
                  {JSON.stringify(preview.originalYaml, null, 2)}
                </pre>
              </div>
              <div className="border-4 border-[#121212] p-4">
                <p className="font-label text-[#121212] text-xs mb-2">Modified YAML</p>
                <pre className="text-xs bg-[#FFF9C4] p-3 border-2 border-[#121212] overflow-x-auto font-mono max-h-48 overflow-y-auto">
                  {JSON.stringify(preview.modifiedYaml, null, 2)}
                </pre>
              </div>
            </div>

            {/* Story blocks */}
            {preview.storyBlocks.length > 0 && (
              <div className="border-4 border-[#121212] bg-white shadow-bauhaus p-4 sm:p-6 mb-4">
                <p className="font-bold text-[#121212] uppercase text-sm mb-3">Story Blocks</p>
                <div className="space-y-2">
                  {preview.storyBlocks.map((block, idx) => (
                    <div key={idx} className={`px-3 py-2 border-l-4 ${
                      block.type === 'heading' ? 'border-[#121212] bg-[#121212] text-white font-bold uppercase' :
                      block.type === 'dialogue' ? 'border-[#1040C0] bg-[#1040C0]/5' :
                      block.type === 'action' ? 'border-[#D02020] bg-[#D02020]/5' :
                      block.type === 'camera' ? 'border-[#F0C020] bg-[#F0C020]/10' :
                      block.type === 'parenthetical' ? 'border-[#121212]/30 bg-[#E0E0E0]' :
                      'border-[#121212]/20 bg-white'
                    }`}>
                      {block.type === 'dialogue' && block.character && (
                        <span className="text-xs font-bold text-[#1040C0] uppercase block mb-1">{block.character}</span>
                      )}
                      <span className="text-sm font-medium">{block.content}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Storyboard panels */}
            {preview.storyboard && preview.storyboard.length > 0 && (
              <div className="border-4 border-[#121212] bg-white shadow-bauhaus p-4 sm:p-6">
                <p className="font-bold text-[#121212] uppercase text-sm mb-3">
                  Storyboard ({preview.storyboard.length} panels)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {preview.storyboard.map((panel, idx) => {
                    const accents = ['#D02020', '#1040C0', '#F0C020'] as const;
                    const accent = accents[idx % 3];
                    return (
                      <div key={idx} className="border-4 border-[#121212] bg-white overflow-hidden">
                        <div className="aspect-video bg-[#E0E0E0] relative border-b-2 border-[#121212] flex items-center justify-center">
                          <div className="text-center p-2">
                            <p className="text-xs font-bold uppercase tracking-wider text-[#121212]/50">Panel {panel.index + 1}</p>
                          </div>
                          <div className="absolute top-1 left-1 px-2 py-0.5 bg-[#121212] text-white text-[10px] font-bold uppercase">
                            {panel.shotType}
                          </div>
                          <div
                            className={`absolute top-1 right-1 w-6 h-6 flex items-center justify-center text-[10px] font-black text-white border-2 border-[#121212] ${idx % 3 === 0 ? 'rounded-full' : ''}`}
                            style={{ backgroundColor: accent }}
                          >
                            {panel.index + 1}
                          </div>
                        </div>
                        <div className="p-2">
                          <p className="text-xs font-medium text-[#121212] mb-1 line-clamp-2">{panel.description}</p>
                          {panel.dialogue && panel.dialogue.length > 0 && (
                            <div className="border-t border-[#121212]/20 pt-1 mt-1">
                              {panel.dialogue.map((line, i) => (
                                <p key={i} className="text-[10px] text-[#121212]/70 italic truncate">{line}</p>
                              ))}
                            </div>
                          )}
                          <div className="mt-1 flex gap-1">
                            {panel.cameraAngle && (
                              <span className="px-1 py-0.5 bg-[#121212] text-white text-[10px] font-bold uppercase">
                                {panel.cameraAngle}
                              </span>
                            )}
                            {panel.lighting && (
                              <span className="px-1 py-0.5 bg-[#E0E0E0] text-[#121212] border border-[#121212] text-[10px] font-bold uppercase">
                                {panel.lighting}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Branch creation result */}
        {result && (
          <div className="mb-8 border-4 border-[#1040C0] bg-[#1040C0]/5 p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg font-black text-[#1040C0]">&#10003;</span>
              <h3 className="font-subheading text-[#121212]">{result.message}</h3>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <div>
                <span className="font-label text-xs text-[#121212]/70">Branch:</span>{' '}
                <code className="px-2 py-1 bg-[#121212] text-[#F0C020] font-mono text-sm font-bold">
                  {result.branchName}
                </code>
              </div>
              {result.commitHash && (
                <div>
                  <span className="font-label text-xs text-[#121212]/70">Commit:</span>{' '}
                  <code className="px-2 py-1 bg-[#E0E0E0] font-mono text-sm font-bold">
                    {result.commitHash}
                  </code>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Existing branches */}
        {branches.length > 0 && (
          <div className="mb-8">
            <h3 className="font-subheading text-[#121212] text-lg mb-3">
              What-If Branches ({branches.length})
            </h3>
            <div className="space-y-2">
              {branches.map((b, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-white border-4 border-[#121212] shadow-bauhaus-sm flex items-center justify-between"
                >
                  <code className="text-sm font-mono font-bold text-[#121212]">{b.full_name}</code>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Query history */}
        {queryHistory.length > 0 && (
          <div>
            <h3 className="font-subheading text-[#121212] text-lg mb-3">History</h3>
            <div className="space-y-2">
              {queryHistory.map((q) => (
                <div
                  key={q.id}
                  className="p-3 sm:p-4 bg-white border-4 border-[#121212] shadow-bauhaus-sm"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-[#121212]">{q.query}</p>
                      <p className="text-xs text-[#121212]/70 mt-1 font-medium">
                        Scene: {q.sceneId} | Type: {q.type} | Changes: {q.changes.length}
                        {q.branch && <> | Branch: <code className="bg-[#E0E0E0] px-1">{q.branch}</code></>}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 font-bold uppercase ${
                        q.status === 'complete'
                          ? 'bg-[#1040C0] text-white border-2 border-[#121212]'
                          : q.status === 'approved'
                            ? 'bg-[#F0C020] text-[#121212] border-2 border-[#121212]'
                            : 'bg-[#E0E0E0] text-[#121212] border-2 border-[#121212]'
                      }`}
                    >
                      {q.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading spinner */}
        {loading && !preview && !result && (
          <div className="flex items-center justify-center min-h-64">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-[#121212] border-t-[#D02020] rounded-full animate-spin mx-auto mb-4" />
              <p className="font-bold uppercase tracking-widest text-[#121212]">Analyzing your what-if scenario</p>
              <p className="text-sm font-medium text-[#121212]/70 mt-2">This may take a moment</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
