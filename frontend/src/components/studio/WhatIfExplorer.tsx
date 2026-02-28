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

export const WhatIfExplorer: React.FC<WhatIfExplorerProps> = ({ scene, branch, onQuery, embedded = false }) => {
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
      // This would call your AI backend
      const response = await processWhatIfQuery(query, scene);

      setProposedChanges(response.changes);
      setBranchName(generateBranchName(query));

      // Add to history
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
    // Mock processing - would call AI backend
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Generate mock changes based on query
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

    // Add a general change
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
    // Simple branch name generation
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
      // This would create a new git branch and apply changes
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
        // Clear after successful application
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
    <div className={`h-full flex flex-col ${embedded ? '' : 'bg-white rounded-lg shadow-lg'}`}>
      {/* Query Input */}
      <div className={embedded ? 'pt-0' : 'p-4 border-b border-gray-200'}>
        {!embedded && (
          <h2 className="text-xl font-semibold text-gray-800 mb-4">What-If Explorer</h2>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ask a "What If" Question
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSubmitQuery()}
                placeholder="What if Marcus confronts Jane about the letter?"
                className="flex-1 px-4 py-2 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={processing}
              />
              <Button
                onClick={handleSubmitQuery}
                disabled={processing || !query.trim()}
              >
                {processing ? 'Processing...' : 'Explore'}
              </Button>
            </div>
          </div>

          {/* Example Queries */}
          <div>
            <p className="text-sm text-gray-600 mb-2">Try these examples:</p>
            <div className="flex flex-wrap gap-2">
              {exampleQueries.map((example, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="xs"
                  onClick={() => setQuery(example)}
                  className="rounded-full text-xs"
                >
                  {example}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Results Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {proposedChanges.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Proposed Changes</h3>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">New branch:</span>
                <code className="px-2 py-1 bg-gray-800 text-white text-sm rounded">{branchName}</code>
              </div>
            </div>

            <div className="space-y-4">
              {proposedChanges.map((change, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Change #{idx + 1}: {change.path.split('/').pop()}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Path: <code className="bg-gray-50 px-1">{change.path}</code>
                      </p>
                    </div>
                    <ConfidenceBadge confidence={change.confidence} />
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-1">Original:</p>
                      <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                        {JSON.stringify(change.originalValue, null, 2) || 'null'}
                      </pre>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-1">New:</p>
                      <pre className="text-xs bg-blue-50 p-2 rounded overflow-x-auto">
                        {JSON.stringify(change.newValue, null, 2)}
                      </pre>
                    </div>
                  </div>

                  {change.impact.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-gray-600 mb-1">Impact:</p>
                      <div className="flex flex-wrap gap-1">
                        {change.impact.map((impact, i) => (
                          <span key={i} className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                            {impact}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setProposedChanges([])}
              >
                Cancel
              </Button>
              <Button
                onClick={applyChanges}
                disabled={processing}
                className="bg-green-600 hover:bg-green-700"
              >
                Apply Changes & Create Branch
              </Button>
            </div>
          </div>
        )}

        {/* Query History */}
        {queryHistory.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">History</h3>
            <div className="space-y-2">
              {queryHistory.map((q) => (
                <div key={q.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-gray-700">{q.query}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Scene: {q.sceneId} | Type: {q.type} | Changes: {q.changes.length}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${
                      q.status === 'complete' ? 'bg-green-100 text-green-800' :
                      q.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-700 text-gray-800'
                    }`}>
                      {q.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {processing && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-600">Analyzing your what-if scenario...</p>
              <p className="text-sm text-gray-500 mt-2">This may take a moment</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};