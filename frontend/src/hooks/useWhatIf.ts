/**
 * React hook for What-If scene branching functionality
 */

import { useState, useCallback } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8101';

interface WhatIfSceneRequest {
  sceneId: string;
  act: string;
  whatIfText: string;
  currentBranch?: string;
  projectName?: string;
}

interface StoryBlock {
  type: 'heading' | 'narrative' | 'dialogue' | 'action' | 'camera' | 'transition' | 'parenthetical';
  content: string;
  character?: string;
  metadata?: Record<string, any>;
}

interface WhatIfSceneResponse {
  success: boolean;
  branchName: string;
  sceneId: string;
  modifiedYaml: Record<string, any>;
  storyBlocks: StoryBlock[];
  commitHash?: string;
  message: string;
}

interface PreviewResponse {
  originalYaml: Record<string, any>;
  modifiedYaml: Record<string, any>;
  storyBlocks: StoryBlock[];
  changesSummary: {
    added: string[];
    modified: string[];
    removed: string[];
  };
}

export function useWhatIf() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [result, setResult] = useState<WhatIfSceneResponse | null>(null);

  /**
   * Preview what-if changes without creating a branch
   */
  const previewWhatIf = useCallback(async (request: WhatIfSceneRequest) => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post<PreviewResponse>(
        `${API_BASE_URL}/api/studio/whatif/scene/preview`,
        {
          scene_id: request.sceneId,
          act: request.act,
          what_if_text: request.whatIfText,
          project_name: request.projectName || 'default'
        }
      );

      setPreview(response.data);
      return response.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to preview what-if changes';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Create a what-if branch with scene modifications
   */
  const createWhatIfScene = useCallback(async (request: WhatIfSceneRequest) => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post<WhatIfSceneResponse>(
        `${API_BASE_URL}/api/studio/whatif/scene/create`,
        {
          scene_id: request.sceneId,
          act: request.act,
          what_if_text: request.whatIfText,
          current_branch: request.currentBranch || 'main',
          project_name: request.projectName || 'default'
        }
      );

      setResult(response.data);
      return response.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to create what-if scene';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get all what-if branches for a scene
   */
  const getSceneBranches = useCallback(async (sceneId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/studio/whatif/scene/${sceneId}/branches`
      );

      return response.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to get scene branches';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Reset the hook state
   */
  const reset = useCallback(() => {
    setPreview(null);
    setResult(null);
    setError(null);
  }, []);

  return {
    // State
    loading,
    error,
    preview,
    result,

    // Actions
    previewWhatIf,
    createWhatIfScene,
    getSceneBranches,
    reset
  };
}