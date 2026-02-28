import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
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
      .slice(0, 2);
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
      const updatedPanels = await Promise.all(
        panels.map(async (panel) => {
          const response = await mockGenerateImage(panel.prompt || panel.description);
          return { ...panel, imageUrl: response.url };
        })
      );
      setPanels(updatedPanels);
    } catch (error) {
      console.error('Failed to generate storyboard:', error);
    } finally {
      setGenerating(false);
    }
  };

  const mockGenerateImage = async (prompt: string): Promise<{ url: string }> => {
    await new Promise(resolve => setTimeout(resolve, 1000));
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
    <div className="h-full flex flex-col bg-white border-4 border-[#121212] shadow-bauhaus-lg">
      {/* Controls – Bauhaus card header */}
      <div className="p-4 sm:p-6 border-b-4 border-[#121212]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <h2 className="font-subheading text-[#121212]">Storyboard Generator</h2>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="default"
              onClick={generateImages}
              disabled={generating}
            >
              {generating ? 'Generating...' : 'Generate Storyboard'}
            </Button>
            <Button
              variant="secondary"
              onClick={exportStoryboard}
            >
              Export
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div>
            <label className="font-label text-[#121212] text-xs tracking-widest block mb-1">Style</label>
            <select
              value={selectedStyle}
              onChange={(e) => setSelectedStyle(e.target.value as typeof selectedStyle)}
              className="px-3 py-2 border-2 border-[#121212] bg-white font-bold uppercase text-sm focus:outline-none focus:ring-2 focus:ring-[#121212]"
            >
              <option value="cinematic">Cinematic</option>
              <option value="sketch">Sketch</option>
              <option value="comic">Comic</option>
              <option value="realistic">Realistic</option>
            </select>
          </div>

          <div>
            <label className="font-label text-[#121212] text-xs tracking-widest block mb-1">Panels</label>
            <input
              type="number"
              min={4}
              max={12}
              value={panelCount}
              onChange={(e) => setPanelCount(parseInt(e.target.value) || 6)}
              className="w-16 px-2 py-2 border-2 border-[#121212] bg-white font-bold text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#121212]"
            />
          </div>

          <div className="text-sm font-bold text-[#121212] uppercase">
            Scene: <span className="text-[#1040C0]">{scene.id}</span>
            {scene.dialogue && ` | ${scene.dialogue.length} lines`}
            {scene.camera?.shots && ` | ${scene.camera.shots.length} shots`}
          </div>
        </div>
      </div>

      {/* Storyboard Grid – Bauhaus cards */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {panels.map((panel, idx) => {
            const accents = ['#D02020', '#1040C0', '#F0C020'] as const;
            const accent = accents[idx % 3];
            return (
              <div
                key={panel.index}
                className="group bg-white border-4 border-[#121212] shadow-bauhaus hover:-translate-y-1 hover:shadow-bauhaus-md transition-all duration-200 ease-out overflow-hidden"
              >
                {/* Image Area */}
                <div className="aspect-video bg-[#E0E0E0] relative border-b-2 border-[#121212]">
                  {panel.imageUrl ? (
                    <img
                      src={panel.imageUrl}
                      alt={panel.description}
                      className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-200"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-[#121212]/50">
                      <div className="text-center">
                        <svg className="w-12 h-12 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-xs font-bold uppercase tracking-wider">Panel {panel.index + 1}</p>
                      </div>
                    </div>
                  )}

                  {/* Shot Type Badge – hard shadow */}
                  <div className="absolute top-2 left-2 px-2 py-1 bg-[#121212] text-white text-xs font-bold uppercase border-2 border-[#121212]">
                    {panel.shotType}
                  </div>

                  {/* Panel Number – geometric shape */}
                  <div
                    className={`absolute top-2 right-2 w-7 h-7 flex items-center justify-center text-xs font-black text-white border-2 border-[#121212] ${idx % 3 === 0 ? 'rounded-full' : ''}`}
                    style={{
                      backgroundColor: accent,
                      transform: idx % 3 === 2 ? 'rotate(45deg)' : undefined,
                    }}
                  >
                    <span style={{ transform: idx % 3 === 2 ? 'rotate(-45deg)' : undefined }}>
                      {panel.index + 1}
                    </span>
                  </div>
                </div>

                {/* Panel Details */}
                <div className="p-3 sm:p-4">
                  <p className="text-sm font-medium text-[#121212] mb-2 leading-relaxed">{panel.description}</p>

                  {panel.dialogue && panel.dialogue.length > 0 && (
                    <div className="border-t-2 border-[#121212] pt-2 mt-2">
                      {panel.dialogue.map((line, i) => (
                        <p key={i} className="text-xs text-[#121212]/80 italic font-medium">
                          {line}
                        </p>
                      ))}
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {panel.cameraAngle && (
                      <span className="px-2 py-1 bg-[#121212] text-white font-bold uppercase">
                        {panel.cameraAngle}
                      </span>
                    )}
                    {panel.lighting && (
                      <span className="px-2 py-1 bg-[#E0E0E0] text-[#121212] border-2 border-[#121212] font-bold uppercase">
                        {panel.lighting}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {generating && (
          <div className="fixed inset-0 bg-[#121212]/60 flex items-center justify-center z-50">
            <div className="bg-white border-4 border-[#121212] shadow-bauhaus-lg p-8 text-center max-w-sm mx-4">
              <div className="w-12 h-12 border-4 border-[#121212] border-t-[#D02020] rounded-full animate-spin mx-auto mb-4" />
              <p className="font-bold uppercase tracking-widest text-[#121212]">Generating storyboard images</p>
              <p className="text-sm font-medium text-[#121212]/70 mt-2">This may take a few moments</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
