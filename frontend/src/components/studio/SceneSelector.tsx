import React, { useState, useEffect } from 'react';
import type { Scene } from '../../lib/studio/types';
import { StudioDataLoader } from '../../lib/studio/data-loader';

interface SceneSelectorProps {
  branch: string;
  onSceneSelect: (scene: Scene) => void;
  projectRoot?: string;
}

export const SceneSelector: React.FC<SceneSelectorProps> = ({
  branch,
  onSceneSelect,
  projectRoot = '.'
}) => {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataReport, setDataReport] = useState<any>(null);
  const [filter, setFilter] = useState<'all' | 'complete' | 'incomplete'>('all');

  useEffect(() => {
    loadScenes();
  }, [branch]);

  const loadScenes = async () => {
    setLoading(true);
    try {
      const loader = new StudioDataLoader(projectRoot);
      const sceneIds = await loader.loadAllScenes();
      const loadedScenes = await Promise.all(
        sceneIds.map(id => loader.loadScene(id))
      );
      setScenes(loadedScenes);

      // Check data integrity
      const integrity = await loader.checkDataIntegrity();
      setDataReport(integrity.report);
    } catch (error) {
      console.error('Failed to load scenes:', error);
      // Fallback mock data
      setScenes([
        {
          id: 'scene_001',
          act: 'act1',
          sceneOrder: 1,
          characters: [],
          dialogue: [],
          _status: {
            complete: true,
            missingFields: [],
            generatedFields: [],
            confidence: 1.0,
            lastChecked: new Date().toISOString()
          }
        } as Scene
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSceneSelect = (scene: Scene) => {
    setSelectedScene(scene);
    onSceneSelect(scene);
  };

  const getSceneStatus = (scene: Scene) => {
    if (!scene._status) return 'unknown';
    if (scene._status.complete) return 'complete';
    if (scene._status.confidence > 0.8) return 'partial';
    return 'incomplete';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete': return 'bg-green-500';
      case 'partial': return 'bg-yellow-500';
      case 'incomplete': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete': return '✓';
      case 'partial': return '!';
      case 'incomplete': return '✗';
      default: return '?';
    }
  };

  const filteredScenes = scenes.filter(scene => {
    if (filter === 'all') return true;
    if (filter === 'complete') return scene._status?.complete;
    if (filter === 'incomplete') return !scene._status?.complete;
    return true;
  });

  const groupedScenes = filteredScenes.reduce((acc, scene) => {
    if (!acc[scene.act]) {
      acc[scene.act] = [];
    }
    acc[scene.act].push(scene);
    return acc;
  }, {} as Record<string, Scene[]>);

  if (loading) {
    return (
      <div className="w-full p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white rounded-lg shadow-lg p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Scene Navigator</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded ${filter === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('complete')}
              className={`px-3 py-1 rounded ${filter === 'complete' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              Complete
            </button>
            <button
              onClick={() => setFilter('incomplete')}
              className={`px-3 py-1 rounded ${filter === 'incomplete' ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              Incomplete
            </button>
          </div>
        </div>

        {dataReport && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600">
              Data Integrity: {Object.values(dataReport.scenes).filter((s: any) => s.complete).length}/{Object.keys(dataReport.scenes).length} scenes complete
            </div>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {Object.entries(groupedScenes).map(([act, actScenes]) => (
          <div key={act}>
            <h3 className="text-lg font-semibold text-gray-700 mb-3 capitalize">{act.replace('act', 'Act ')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {actScenes.map((scene) => {
                const status = getSceneStatus(scene);
                const isSelected = selectedScene?.id === scene.id;

                return (
                  <button
                    key={scene.id}
                    onClick={() => handleSceneSelect(scene)}
                    className={`relative p-4 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 shadow-lg'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-md bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="text-left">
                        <div className="font-semibold text-gray-800">
                          {scene.id.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </div>
                        {scene.location && (
                          <div className="text-xs text-gray-500 mt-1">
                            {typeof scene.location === 'string' ? scene.location : scene.location.name}
                          </div>
                        )}
                      </div>
                      <div className={`w-6 h-6 rounded-full ${getStatusColor(status)} text-white text-xs flex items-center justify-center font-bold`}>
                        {getStatusIcon(status)}
                      </div>
                    </div>

                    {scene.characters && scene.characters.length > 0 && (
                      <div className="mt-2">
                        <div className="text-xs text-gray-600">Characters:</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {scene.characters.slice(0, 3).map((char, idx) => (
                            <span key={idx} className="text-xs px-2 py-1 bg-gray-100 rounded">
                              {typeof char === 'string' ? char : char.name}
                            </span>
                          ))}
                          {scene.characters.length > 3 && (
                            <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                              +{scene.characters.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {scene._status && !scene._status.complete && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <div className="text-xs text-gray-500">
                          Confidence: {Math.round(scene._status.confidence * 100)}%
                        </div>
                        {scene._status.missingFields.length > 0 && (
                          <div className="text-xs text-red-600 mt-1">
                            Missing: {scene._status.missingFields.slice(0, 2).join(', ')}
                            {scene._status.missingFields.length > 2 && ` +${scene._status.missingFields.length - 2}`}
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {selectedScene && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold text-gray-800 mb-2">Selected Scene Details</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-600">Scene:</span> {selectedScene.id}
            </div>
            <div>
              <span className="text-gray-600">Act:</span> {selectedScene.act}
            </div>
            <div>
              <span className="text-gray-600">Characters:</span> {selectedScene.characters?.length || 0}
            </div>
            <div>
              <span className="text-gray-600">Dialogue Lines:</span> {selectedScene.dialogue?.length || 0}
            </div>
            {selectedScene.camera && (
              <div>
                <span className="text-gray-600">Shots:</span> {selectedScene.camera.shots?.length || 0}
              </div>
            )}
            {selectedScene._status && (
              <div>
                <span className="text-gray-600">Data Quality:</span> {Math.round(selectedScene._status.confidence * 100)}%
              </div>
            )}
          </div>

          {selectedScene._status?.missingFields && selectedScene._status.missingFields.length > 0 && (
            <div className="mt-3 p-2 bg-yellow-100 rounded">
              <div className="text-xs font-semibold text-yellow-800 mb-1">Missing Data:</div>
              <div className="text-xs text-yellow-700">
                {selectedScene._status.missingFields.join(', ')}
              </div>
              <button className="mt-2 text-xs px-2 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700">
                Auto-Repair with AI
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};