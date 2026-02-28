import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import type { Scene, DialogueCharacter } from '../../lib/studio/types';
import { useCharacterDialogue } from '../../hooks/useCharacterDialogue';

interface CharacterDialoguePanelProps {
  scene: Scene;
}

export const CharacterDialoguePanel: React.FC<CharacterDialoguePanelProps> = ({ scene }) => {
  const [userCharId, setUserCharId] = useState<string | null>(null);
  const [aiCharId, setAiCharId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    streaming,
    loading,
    error,
    characters,
    loadCharacters,
    sendMessage,
    cancelStream,
    clearConversation,
  } = useCharacterDialogue();

  useEffect(() => {
    loadCharacters(scene.id, scene.act);
  }, [scene.id, scene.act, loadCharacters]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const inChat = userCharId && aiCharId;

  const handleSend = () => {
    if (!input.trim() || !userCharId || !aiCharId || streaming) return;
    sendMessage({
      sceneId: scene.id,
      act: scene.act,
      userCharacterId: userCharId,
      aiCharacterId: aiCharId,
      message: input.trim(),
    });
    setInput('');
  };

  const handleStartOver = () => {
    clearConversation();
    setUserCharId(null);
    setAiCharId(null);
  };

  const getCharName = (id: string) => {
    const c = characters.find(ch => ch.id === id);
    return c?.name || id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Character selection phase
  if (!inChat) {
    return (
      <div className="space-y-6">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-[#121212] border-t-[#1040C0] rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="p-3 border-4 border-[#D02020] bg-[#D02020]/10">
            <p className="text-sm font-bold text-[#D02020]">{error}</p>
          </div>
        )}

        {!loading && characters.length > 0 && (
          <>
            <CharacterPicker
              label="I am..."
              characters={characters}
              selected={userCharId}
              disabled={aiCharId}
              onSelect={setUserCharId}
            />

            <CharacterPicker
              label="Talking to..."
              characters={characters}
              selected={aiCharId}
              disabled={userCharId}
              onSelect={setAiCharId}
            />

            {userCharId && aiCharId && (
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {/* inChat will become true */}}
              >
                Start Conversation
              </Button>
            )}
          </>
        )}

        {!loading && characters.length === 0 && (
          <p className="text-sm text-[#121212]/60 font-medium text-center py-8">
            No characters found in this scene.
          </p>
        )}
      </div>
    );
  }

  // Chat phase
  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center justify-between pb-3 border-b-2 border-[#121212]/20 mb-3">
        <div className="text-sm font-bold text-[#121212]">
          <span className="text-[#F0C020]">{getCharName(userCharId)}</span>
          {' '}&rarr;{' '}
          <span className="text-[#1040C0]">{getCharName(aiCharId)}</span>
        </div>
        <Button variant="ghost" size="xs" onClick={handleStartOver}>
          Change
        </Button>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-3 p-2 border-2 border-[#D02020] bg-[#D02020]/10">
          <p className="text-xs font-bold text-[#D02020]">{error}</p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-3 min-h-0">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm font-medium text-[#121212]/40">
              Say something as {getCharName(userCharId)}...
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`px-3 py-2 border-l-4 ${
              msg.role === 'user'
                ? 'border-[#F0C020] bg-[#F0C020]/10'
                : 'border-[#1040C0] bg-[#1040C0]/5'
            }`}
          >
            <span className={`text-xs font-bold uppercase block mb-1 ${
              msg.role === 'user' ? 'text-[#121212]' : 'text-[#1040C0]'
            }`}>
              {msg.characterName}
            </span>
            <span className="text-sm font-medium text-[#121212]">
              {msg.text}
              {streaming && msg.role === 'character' && msg.text === '' && (
                <span className="inline-flex gap-1 ml-1">
                  <span className="w-1.5 h-1.5 bg-[#1040C0] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-[#1040C0] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-[#1040C0] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              )}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t-2 border-[#121212]/20 pt-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={`Speak as ${getCharName(userCharId)}...`}
            className="flex-1 px-3 py-2 border-2 border-[#121212] bg-white font-medium text-sm focus:outline-none focus:ring-2 focus:ring-[#121212]"
            disabled={streaming}
          />
          {streaming ? (
            <Button variant="default" size="default" onClick={cancelStream}>
              Stop
            </Button>
          ) : (
            <Button variant="secondary" size="default" onClick={handleSend} disabled={!input.trim()}>
              Send
            </Button>
          )}
        </div>
        {messages.length > 0 && (
          <div className="mt-2 flex justify-end">
            <Button variant="ghost" size="xs" onClick={clearConversation}>
              Clear History
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};


// Sub-component for character selection
interface CharacterPickerProps {
  label: string;
  characters: DialogueCharacter[];
  selected: string | null;
  disabled: string | null;
  onSelect: (id: string | null) => void;
}

const CharacterPicker: React.FC<CharacterPickerProps> = ({
  label,
  characters,
  selected,
  disabled,
  onSelect,
}) => (
  <div>
    <p className="font-label text-[#121212] text-xs tracking-widest mb-2">{label}</p>
    <div className="flex flex-wrap gap-2">
      {characters.map((char) => {
        const isSelected = selected === char.id;
        const isDisabled = disabled === char.id;
        return (
          <button
            key={char.id}
            onClick={() => onSelect(isSelected ? null : char.id)}
            disabled={isDisabled}
            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider border-2 transition-all ${
              isSelected
                ? 'bg-[#121212] text-white border-[#121212]'
                : isDisabled
                  ? 'bg-[#E0E0E0] text-[#121212]/30 border-[#121212]/20 cursor-not-allowed'
                  : 'bg-white text-[#121212] border-[#121212] hover:bg-[#E0E0E0]'
            } ${!char.dialogueReady && !isDisabled ? 'border-dashed' : ''}`}
            title={
              isDisabled
                ? 'Already selected for the other role'
                : !char.dialogueReady
                  ? 'Limited character data -- responses may be generic'
                  : char.description
            }
          >
            {char.name}
            {!char.dialogueReady && !isDisabled && (
              <span className="ml-1 text-[#F0C020]">*</span>
            )}
          </button>
        );
      })}
    </div>
    {characters.some(c => !c.dialogueReady && c.id !== disabled) && (
      <p className="text-[10px] text-[#121212]/50 mt-1 font-medium">
        <span className="text-[#F0C020]">*</span> Limited voice/knowledge data
      </p>
    )}
  </div>
);
