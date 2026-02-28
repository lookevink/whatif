/**
 * What-If Panel Component
 * Allows users to create narrative branches with "what if" scenarios
 */

import { useState, useEffect, type ChangeEvent } from 'react';
import { useWhatIf } from '../hooks/useWhatIf';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

interface WhatIfPanelProps {
  sceneId: string;
  act: string;
  projectName?: string;
  onBranchCreated?: (branchName: string) => void;
}

export function WhatIfPanel({ sceneId, act, projectName = 'default', onBranchCreated }: WhatIfPanelProps) {
  const [whatIfText, setWhatIfText] = useState('');
  const [branches, setBranches] = useState<any[]>([]);

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
    getSceneBranches(sceneId).then(data => {
      if (data?.branches) {
        setBranches(data.branches);
      }
    });
  }, [sceneId, getSceneBranches]);

  const handlePreview = async () => {
    if (!whatIfText.trim()) return;

    await previewWhatIf({
      sceneId,
      act,
      whatIfText,
      projectName
    });
  };

  const handleCreate = async () => {
    if (!whatIfText.trim()) return;

    const response = await createWhatIfScene({
      sceneId,
      act,
      whatIfText,
      projectName
    });

    if (response?.success) {
      // Refresh branches list
      const branchData = await getSceneBranches(sceneId);
      if (branchData?.branches) {
        setBranches(branchData.branches);
      }

      // Notify parent component
      if (onBranchCreated) {
        onBranchCreated(response.branchName);
      }

      // Clear form
      setWhatIfText('');
      reset();
    }
  };

  const renderStoryBlock = (block: any, index: number) => {
    const blockStyles: Record<string, string> = {
      heading: 'font-bold text-lg uppercase',
      narrative: 'italic text-gray-600',
      dialogue: 'ml-8',
      action: 'text-gray-700',
      camera: 'text-blue-600 font-semibold',
      transition: 'text-right font-bold uppercase',
      parenthetical: 'ml-12 italic text-sm text-gray-500'
    };

    return (
      <div key={index} className={`mb-2 ${blockStyles[block.type] || ''}`}>
        {block.character && (
          <span className="font-bold uppercase">{block.character}: </span>
        )}
        {block.content}
      </div>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>What-If Scenario Builder</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input Section */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Describe your "what if" scenario:
          </label>
          <Textarea
            value={whatIfText}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setWhatIfText(e.target.value)}
            placeholder="What if the character reveals a secret..."
            className="min-h-[100px]"
          />
          <div className="flex gap-2">
            <Button
              onClick={handlePreview}
              disabled={loading || !whatIfText.trim()}
              variant="outline"
            >
              Preview Changes
            </Button>
            <Button
              onClick={handleCreate}
              disabled={loading || !whatIfText.trim()}
            >
              Create Branch
            </Button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Success Message */}
        {result?.success && (
          <Alert>
            <AlertDescription>
              Branch created: <strong>{result.branchName}</strong>
            </AlertDescription>
          </Alert>
        )}

        {/* Preview Section */}
        {preview && (
          <Tabs defaultValue="story" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="story">Story Blocks</TabsTrigger>
              <TabsTrigger value="changes">Changes</TabsTrigger>
              <TabsTrigger value="yaml">Modified YAML</TabsTrigger>
            </TabsList>

            <TabsContent value="story" className="space-y-2">
              <div className="border rounded-lg p-4 bg-gray-50">
                {preview.storyBlocks.map(renderStoryBlock)}
              </div>
            </TabsContent>

            <TabsContent value="changes" className="space-y-2">
              <div className="space-y-3">
                {preview.changesSummary.added.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-green-600">Added:</h4>
                    <ul className="list-disc ml-5">
                      {preview.changesSummary.added.map((item, i) => (
                        <li key={i} className="text-sm">{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {preview.changesSummary.modified.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-blue-600">Modified:</h4>
                    <ul className="list-disc ml-5">
                      {preview.changesSummary.modified.map((item, i) => (
                        <li key={i} className="text-sm">{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {preview.changesSummary.removed.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-red-600">Removed:</h4>
                    <ul className="list-disc ml-5">
                      {preview.changesSummary.removed.map((item, i) => (
                        <li key={i} className="text-sm">{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="yaml" className="space-y-2">
              <pre className="border rounded-lg p-4 bg-gray-50 overflow-x-auto text-xs">
                {JSON.stringify(preview.modifiedYaml, null, 2)}
              </pre>
            </TabsContent>
          </Tabs>
        )}

        {/* Existing Branches */}
        {branches.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold">Existing What-If Branches:</h4>
            <ul className="list-disc ml-5">
              {branches.map((branch, i) => (
                <li key={i} className="text-sm">
                  {branch.name}
                  {branch.is_current && <span className="text-green-600 ml-2">(current)</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}