/**
 * React hook for in-character dialogue with AI-driven characters via SSE streaming.
 */

import { useState, useCallback, useRef } from 'react';
import axios from 'axios';
import type { DialogueMessage, DialogueCharacter } from '../lib/studio/types';

const API_BASE_URL = import.meta.env.VITE_WHATIF_API_URL || 'http://localhost:8000';

interface SendMessageParams {
  sceneId: string;
  act: string;
  userCharacterId: string;
  aiCharacterId: string;
  message: string;
}

export function useCharacterDialogue() {
  const [messages, setMessages] = useState<DialogueMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [characters, setCharacters] = useState<DialogueCharacter[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const loadCharacters = useCallback(async (sceneId: string, act: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/studio/dialogue/characters/${sceneId}`,
        { params: { act, project_name: 'default' } }
      );
      const chars: DialogueCharacter[] = (response.data.characters || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        description: c.description || '',
        hasVoiceData: c.has_voice_data,
        hasKnowledgeData: c.has_knowledge_data,
        dialogueReady: c.dialogue_ready,
      }));
      setCharacters(chars);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to load characters');
    } finally {
      setLoading(false);
    }
  }, []);

  const sendMessage = useCallback(async (params: SendMessageParams) => {
    const { sceneId, act, userCharacterId, aiCharacterId, message } = params;

    const userMsg: DialogueMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      characterId: userCharacterId,
      characterName: userCharacterId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      text: message,
      timestamp: Date.now(),
    };

    const aiMsgId = `msg_${Date.now() + 1}`;
    const aiName = aiCharacterId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    // We need to capture messages before updating state for the API call
    setMessages(prev => {
      // Build history from current messages (before adding new ones)
      const history = prev.map(m => ({
        role: m.role,
        character_id: m.characterId,
        text: m.text,
      }));

      // Kick off the streaming fetch
      const controller = new AbortController();
      abortRef.current = controller;

      fetch(`${API_BASE_URL}/api/studio/dialogue/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scene_id: sceneId,
          act,
          user_character_id: userCharacterId,
          ai_character_id: aiCharacterId,
          message,
          conversation_history: history,
          project_name: 'default',
        }),
        signal: controller.signal,
      })
        .then(async (response) => {
          const reader = response.body?.getReader();
          if (!reader) throw new Error('No response body');

          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.type === 'chunk') {
                    setMessages(p => p.map(m =>
                      m.id === aiMsgId ? { ...m, text: m.text + data.text } : m
                    ));
                  } else if (data.type === 'error') {
                    setError(data.message);
                  }
                } catch {
                  // skip malformed SSE lines
                }
              }
            }
          }
        })
        .catch((err) => {
          if (err.name !== 'AbortError') {
            setError(err.message);
          }
        })
        .finally(() => {
          setStreaming(false);
          abortRef.current = null;
        });

      return [
        ...prev,
        userMsg,
        {
          id: aiMsgId,
          role: 'character' as const,
          characterId: aiCharacterId,
          characterName: aiName,
          text: '',
          timestamp: Date.now(),
        },
      ];
    });

    setStreaming(true);
    setError(null);
  }, []);

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
  }, []);

  const clearConversation = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    streaming,
    loading,
    error,
    characters,
    loadCharacters,
    sendMessage,
    cancelStream,
    clearConversation,
  };
}
