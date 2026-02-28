import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Scene, WhatIfQuery, ProposedChange } from '../../lib/studio/types';
import { ConfidenceBadge } from './ConfidenceBadge';

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
  const [processing, setProcessing] = useState(false);
  const [proposedChanges, setProposedChanges] = useState<ProposedChange[]>([]);
  const [branchName, setBranchName] = useState('');
  const [queryHistory, setQueryHistory] = useState<WhatIfQuery[]>([]);

  const exampleQueries = [
    "What if Marcus confronts Jane directly about the letter?",
    "What if the detective arrives earlier in the scene?",
    "What if Jane reveals the truth voluntarily?",
    "What if Marcus decides to leave without saying anything?",
    "What if a new character enters the scene?"
  ];

  const handleSubmitQuery = async () => {
    if (!query.trim()) return;
    setProcessing(true);
    try {
      const response = await processWhatIfQuery(query, scene);
      setProposedChanges(response.changes);
      setBranchName(generateBranchName(query));
      const newQuery: WhatIfQuery = {
        id: `query_${Date.now()}`,
        query,
        sceneId: scene.id,
        type: detectQueryType(query),
        changes: response.changes,
        branch: branchName,
        status: 'complete'
      };
      setQueryHistory([newQuery, ...queryHistory]);
    } catch (error) {
      console.error('Failed to process what-if query:', error);
    } finally {
      setProcessing(false);
    }
  };

  const processWhatIfQuery = async (query: string, scene: Scene): Promise<{ changes: ProposedChange[] }> => {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const changes: ProposedChange[] = [];

    if (query.toLowerCase().includes('confront')) {
      changes.push({
        path: `scenes/${scene.id}/dialogue`,
        originalValue: scene.dialogue?.[0],
        newValue: {
          character: 'Marcus',
          line: "I found your letter. We need to talk.",
          delivery: "direct, controlled anger"
        },
        impact: ['Increases scene tension', 'Accelerates conflict', 'Changes character arc'],
        confidence: 0.85
      });
    }

    if (query.toLowerCase().includes('reveal')) {
      changes.push({
        path: `characters/jane/knowledge`,
        originalValue: null,
        newValue: {
          reveals: 'the_affair',
          to: 'marcus',
          voluntarily: true
        },
        impact: ['Major plot change', 'Affects all subsequent scenes', 'Changes relationship dynamic'],
        confidence: 0.75
      });
    }

    changes.push({
      path: `scenes/${scene.id}/blocking`,
      originalValue: scene.blocking,
      newValue: {
        note: 'Characters positioned for confrontation',
        distance: 'close',
        tension: 'high'
      },
      impact: ['Visual composition change', 'Affects camera angles'],
      confidence: 0.9
    });

    return { changes };
  };

  const detectQueryType = (query: string): 'dialogue' | 'action' | 'character' | 'world' => {
    const lower = query.toLowerCase();
    if (lower.includes('says') || lower.includes('tells') || lower.includes('reveals')) return 'dialogue';
    if (lower.includes('character') || lower.includes('marcus') || lower.includes('jane')) return 'character';
    if (lower.includes('location') || lower.includes('world') || lower.includes('setting')) return 'world';
    return 'action';
  };

  const generateBranchName = (query: string): string => {
    const simplified = query
      .toLowerCase()
      .replace(/what if /gi, '')
      .replace(/[^a-z0-9\s]/g, '')
      .split(' ')
      .slice(0, 4)
      .join('-');
    return `what-if/${simplified}-${Date.now().toString(36)}`;
  };

  const applyChanges = async () => {
    if (proposedChanges.length === 0) return;
    setProcessing(true);
    try {
      const response = await fetch('/api/studio/apply-whatif', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch: branchName,
          parentBranch: branch,
          changes: proposedChanges,
          sceneId: scene.id
        })
      });
      if (response.ok) {
        onQuery(query);
        setQuery('');
        setProposedChanges([]);
      }
    } catch (error) {
      console.error('Failed to apply changes:', error);
    } finally {
      setProcessing(false);
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
                onKeyDown={(e) => e.key === 'Enter' && handleSubmitQuery()}
                placeholder="What if Marcus confronts Jane about the letter?"
                className="flex-1 px-4 py-2 border-2 border-[#121212] bg-white font-medium focus:outline-none focus:ring-2 focus:ring-[#121212]"
                disabled={processing}
              />
              <Button
                variant="default"
                onClick={handleSubmitQuery}
                disabled={processing || !query.trim()}
              >
                {processing ? 'Processing...' : 'Explore'}
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
        {proposedChanges.length > 0 && (
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <h3 className="font-subheading text-[#121212] text-lg sm:text-xl">Proposed Changes</h3>
              <div className="flex items-center gap-2">
                <span className="font-label text-[#121212] text-xs">New branch:</span>
                <code className="px-2 py-1 bg-[#121212] text-[#F0C020] font-mono text-sm font-bold">
                  {branchName}
                </code>
              </div>
            </div>

            <div className="space-y-4">
              {proposedChanges.map((change, idx) => (
                <div
                  key={idx}
                  className="border-4 border-[#121212] bg-white shadow-bauhaus p-4 sm:p-6"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                    <div>
                      <p className="font-bold text-[#121212] uppercase text-sm">
                        Change #{idx + 1}: {change.path.split('/').pop()}
                      </p>
                      <p className="text-xs text-[#121212]/70 mt-1 font-medium">
                        Path: <code className="bg-[#E0E0E0] px-1">{change.path}</code>
                      </p>
                    </div>
                    <ConfidenceBadge confidence={change.confidence} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                    <div>
                      <p className="font-label text-[#121212] text-xs mb-1">Original</p>
                      <pre className="text-xs bg-[#E0E0E0] p-3 border-2 border-[#121212] overflow-x-auto font-mono">
                        {JSON.stringify(change.originalValue, null, 2) || 'null'}
                      </pre>
                    </div>
                    <div>
                      <p className="font-label text-[#121212] text-xs mb-1">New</p>
                      <pre className="text-xs bg-[#FFF9C4] p-3 border-2 border-[#121212] overflow-x-auto font-mono">
                        {JSON.stringify(change.newValue, null, 2)}
                      </pre>
                    </div>
                  </div>

                  {change.impact.length > 0 && (
                    <div className="mt-3">
                      <p className="font-label text-[#121212] text-xs mb-2">Impact</p>
                      <div className="flex flex-wrap gap-2">
                        {change.impact.map((impact, i) => (
                          <span
                            key={i}
                            className="text-xs px-2 py-1 bg-[#F0C020] text-[#121212] border-2 border-[#121212] font-bold uppercase"
                          >
                            {impact}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setProposedChanges([])}>
                Cancel
              </Button>
              <Button variant="secondary" onClick={applyChanges} disabled={processing}>
                Apply Changes & Create Branch
              </Button>
            </div>
          </div>
        )}

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

        {processing && (
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
