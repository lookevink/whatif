import React, { useState, useEffect } from 'react';
import type { Scene, StoryboardPanel, CameraShot } from '../../lib/studio/types';

interface StoryboardGeneratorProps {
  scene: Scene;
}

export const StoryboardGenerator: React.FC<StoryboardGeneratorProps> = ({ scene }) => {
  const [panels, setPanels] = useState<StoryboardPanel[]>([]);
  const [generating, setGenerating] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<'cinematic' | 'sketch' | 'comic' | 'realistic'>('cinematic');
  const [panelCount, setPanelCount] = useState(6);

  useEffect(() => {
    generateStoryboardFromScene();
  }, [scene]);

  const generateStoryboardFromScene = () => {
    // Generate panels from camera shots and dialogue
    const generatedPanels: StoryboardPanel[] = [];

    if (scene.camera?.shots) {
      scene.camera.shots.slice(0, panelCount).forEach((shot, index) => {
        generatedPanels.push({
          index,
          shotType: shot.type,
          description: shot.framingNotes || `${shot.type} of ${shot.subject}`,
          cameraAngle: shot.type,
          lighting: scene.lighting?.mood || 'neutral',
          dialogue: getDialogueForShot(shot, index),
          prompt: generatePromptForShot(shot)
        });
      });
    }

    // Fill in remaining panels with generated content
    while (generatedPanels.length < panelCount) {
      const index = generatedPanels.length;
      generatedPanels.push({
        index,
        shotType: getDefaultShotType(index),
        description: `Generated panel ${index + 1}`,
        dialogue: getDialogueForIndex(index),
        cameraAngle: getDefaultShotType(index),
        lighting: scene.lighting?.mood || 'neutral'
      });
    }

    setPanels(generatedPanels);
  };

  const getDialogueForShot = (_shot: CameraShot, index: number): string[] => {
    if (!scene.dialogue) return [];

    const dialoguePerShot = Math.ceil(scene.dialogue.length / panelCount);
    const startIdx = index * dialoguePerShot;
    const endIdx = Math.min(startIdx + dialoguePerShot, scene.dialogue.length);

    return scene.dialogue
      .slice(startIdx, endIdx)
      .map(d => `${d.character}: ${d.line}`)
      .slice(0, 2); // Max 2 lines per panel
  };

  const getDialogueForIndex = (index: number): string[] => {
    if (!scene.dialogue) return [];

    const dialoguePerPanel = Math.ceil(scene.dialogue.length / panelCount);
    const startIdx = index * dialoguePerPanel;
    const endIdx = Math.min(startIdx + dialoguePerPanel, scene.dialogue.length);

    return scene.dialogue
      .slice(startIdx, endIdx)
      .map(d => `${d.character}: ${d.line}`)
      .slice(0, 2);
  };

  const getDefaultShotType = (index: number): string => {
    const shotTypes = ['establishing', 'wide', 'medium', 'close_up', 'over_shoulder', 'medium'];
    return shotTypes[index % shotTypes.length];
  };

  const generatePromptForShot = (shot: CameraShot): string => {
    const characters = scene.characters?.map(c => typeof c === 'string' ? c : c.name).join(', ') || 'characters';
    const location = typeof scene.location === 'string' ? scene.location : scene.location?.name || 'location';

    return `${shot.type} shot of ${shot.subject || characters} in ${location}, ${shot.framingNotes || ''}, ${selectedStyle} style, film still`;
  };

  const generateImages = async () => {
    setGenerating(true);

    try {
      // This would call your image generation API
      const updatedPanels = await Promise.all(
        panels.map(async (panel) => {
          // Mock API call - replace with actual image generation
          const response = await mockGenerateImage(panel.prompt || panel.description);
          return {
            ...panel,
            imageUrl: response.url
          };
        })
      );

      setPanels(updatedPanels);
    } catch (error) {
      console.error('Failed to generate images:', error);
    } finally {
      setGenerating(false);
    }
  };

  const mockGenerateImage = async (prompt: string): Promise<{ url: string }> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Return placeholder image
    return {
      url: `https://via.placeholder.com/512x288/1a1a2e/eee?text=${encodeURIComponent(prompt.slice(0, 30))}`
    };
  };

  const exportStoryboard = () => {
    const storyboardData = {
      scene: scene.id,
      style: selectedStyle,
      panels,
      generated: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(storyboardData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `storyboard_${scene.id}_${Date.now()}.json`;
    a.click();
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-lg shadow-lg">
      {/* Controls */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Storyboard Generator</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={generateImages}
              disabled={generating}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
            >
              {generating ? 'Generating...' : 'Generate Images'}
            </button>
            <button
              onClick={exportStoryboard}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Export
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div>
            <label className="text-sm text-gray-600">Style:</label>
            <select
              value={selectedStyle}
              onChange={(e) => setSelectedStyle(e.target.value as any)}
              className="ml-2 px-2 py-1 border border-gray-300 rounded"
            >
              <option value="cinematic">Cinematic</option>
              <option value="sketch">Sketch</option>
              <option value="comic">Comic</option>
              <option value="realistic">Realistic</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-600">Panels:</label>
            <input
              type="number"
              min="4"
              max="12"
              value={panelCount}
              onChange={(e) => setPanelCount(parseInt(e.target.value))}
              className="ml-2 w-16 px-2 py-1 border border-gray-300 rounded"
            />
          </div>

          <div className="text-sm text-gray-600">
            Scene: <strong>{scene.id}</strong>
            {scene.dialogue && ` | ${scene.dialogue.length} lines`}
            {scene.camera?.shots && ` | ${scene.camera.shots.length} shots`}
          </div>
        </div>
      </div>

      {/* Storyboard Grid */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {panels.map((panel) => (
            <div key={panel.index} className="bg-gray-50 rounded-lg overflow-hidden shadow">
              {/* Image Area */}
              <div className="aspect-video bg-gray-200 relative">
                {panel.imageUrl ? (
                  <img
                    src={panel.imageUrl}
                    alt={panel.description}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <div className="text-center">
                      <svg className="w-12 h-12 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-xs">Panel {panel.index + 1}</p>
                    </div>
                  </div>
                )}

                {/* Shot Type Badge */}
                <div className="absolute top-2 left-2 px-2 py-1 bg-black bg-opacity-50 text-white text-xs rounded">
                  {panel.shotType}
                </div>

                {/* Panel Number */}
                <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 text-white text-xs flex items-center justify-center rounded-full">
                  {panel.index + 1}
                </div>
              </div>

              {/* Panel Details */}
              <div className="p-3">
                <p className="text-sm text-gray-700 mb-2">{panel.description}</p>

                {panel.dialogue && panel.dialogue.length > 0 && (
                  <div className="border-t pt-2">
                    {panel.dialogue.map((line, idx) => (
                      <p key={idx} className="text-xs text-gray-600 italic">
                        {line}
                      </p>
                    ))}
                  </div>
                )}

                <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                  {panel.cameraAngle && (
                    <span className="px-2 py-1 bg-gray-100 rounded">
                      {panel.cameraAngle}
                    </span>
                  )}
                  {panel.lighting && (
                    <span className="px-2 py-1 bg-gray-100 rounded">
                      {panel.lighting}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {generating && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p>Generating storyboard images...</p>
              <p className="text-sm text-gray-600 mt-2">This may take a few moments</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};