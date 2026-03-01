import { useState, useCallback } from 'react';
import type { CharacterListItem, CharacterDetail, CharacterImageGenResult } from '../lib/studio/types';

const PROJECT_ROOT = '/api/studio/projects/default';

export function useCharacterGallery() {
  const [characters, setCharacters] = useState<CharacterListItem[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCharacters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${PROJECT_ROOT}/characters`);
      if (response.ok) {
        setCharacters(await response.json());
      } else {
        setError('Failed to load characters');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load characters');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCharacterDetail = useCallback(async (charId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${PROJECT_ROOT}/characters/${charId}`);
      if (response.ok) {
        setSelectedCharacter(await response.json());
      } else {
        setError('Character not found');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load character');
    } finally {
      setLoading(false);
    }
  }, []);

  const generateImages = useCallback(async (
    charId: string,
    forceRegenerate: boolean = false,
  ): Promise<CharacterImageGenResult | null> => {
    setGenerating(charId);
    setError(null);
    try {
      const response = await fetch(
        `${PROJECT_ROOT}/characters/${charId}/generate-images`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            character_id: charId,
            force_regenerate: forceRegenerate,
          }),
        },
      );
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.detail || response.statusText);
      }
      const result: CharacterImageGenResult = await response.json();
      // Refresh list and detail to pick up new images
      await loadCharacters();
      if (selectedCharacter?.id === charId) {
        await loadCharacterDetail(charId);
      }
      return result;
    } catch (err: any) {
      setError(err.message || 'Image generation failed');
      return null;
    } finally {
      setGenerating(null);
    }
  }, [loadCharacters, loadCharacterDetail, selectedCharacter?.id]);

  const batchGenerate = useCallback(async (
    characterIds?: string[],
    skipExisting: boolean = true,
  ) => {
    setBatchGenerating(true);
    setError(null);
    try {
      const response = await fetch(
        `${PROJECT_ROOT}/characters/generate-images`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            character_ids: characterIds || null,
            skip_existing: skipExisting,
            min_description_length: 20,
          }),
        },
      );
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.detail || response.statusText);
      }
      const result = await response.json();
      await loadCharacters();
      return result;
    } catch (err: any) {
      setError(err.message || 'Batch generation failed');
      return null;
    } finally {
      setBatchGenerating(false);
    }
  }, [loadCharacters]);

  return {
    characters,
    selectedCharacter,
    loading,
    generating,
    batchGenerating,
    error,
    loadCharacters,
    loadCharacterDetail,
    generateImages,
    batchGenerate,
    clearSelectedCharacter: useCallback(() => setSelectedCharacter(null), []),
  };
}
