import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { BauhausLogo } from '../components/studio/BauhausLogo';
import { CharacterCard } from '../components/studio/CharacterCard';
import { CharacterDetailPanel } from '../components/studio/CharacterDetailPanel';
import { useCharacterGallery } from '../hooks/useCharacterGallery';

type Filter = 'all' | 'has-images' | 'no-images' | 'rich-data';

export const CharacterGalleryPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    characters, selectedCharacter, loading, generating,
    batchGenerating, error, loadCharacters, loadCharacterDetail,
    generateImages, batchGenerate, clearSelectedCharacter,
  } = useCharacterGallery();
  const [showDetail, setShowDetail] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => { loadCharacters(); }, [loadCharacters]);

  const filteredCharacters = characters.filter((c) => {
    if (filter === 'has-images') return c.dataCompleteness.hasImages;
    if (filter === 'no-images') return !c.dataCompleteness.hasImages;
    if (filter === 'rich-data') return c.dataCompleteness.hasVoice || c.dataCompleteness.hasArc;
    return true;
  });

  const withImages = characters.filter((c) => c.dataCompleteness.hasImages).length;

  const handleCharacterClick = async (charId: string) => {
    await loadCharacterDetail(charId);
    setShowDetail(true);
  };

  const handleCloseDetail = () => {
    setShowDetail(false);
    clearSelectedCharacter();
  };

  const handleGenerateImages = async (charId: string, force?: boolean) => {
    await generateImages(charId, force);
  };

  const handleBatchGenerate = async () => {
    await batchGenerate();
  };

  const filterButtons: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'has-images', label: 'Has Images' },
    { key: 'no-images', label: 'No Images' },
    { key: 'rich-data', label: 'Rich Data' },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#F0F0F0]">
      {/* Header */}
      <header className="bg-[#1040C0] border-b-4 border-[#121212] shadow-bauhaus-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <BauhausLogo size="lg" />
              <div>
                <h1 className="font-display text-white leading-[0.9] tracking-tighter">
                  Characters
                </h1>
                <p className="text-white/90 text-sm sm:text-base font-medium mt-1 tracking-wide">
                  Character gallery & reference images
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate('/')}
              className="bg-white text-[#121212] border-[#121212] shadow-bauhaus-sm"
            >
              Back to Scenes
            </Button>
          </div>
        </div>
      </header>

      {/* Controls bar */}
      <div className="bg-[#F0C020] border-b-4 border-[#121212]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {filterButtons.map((fb) => (
                <Button
                  key={fb.key}
                  type="button"
                  variant={filter === fb.key ? 'default' : 'outline'}
                  size="xs"
                  onClick={() => setFilter(fb.key)}
                >
                  {fb.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm font-bold text-[#121212] uppercase">
                {withImages} / {characters.length} with images
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => { handleBatchGenerate(); }}
                disabled={batchGenerating}
              >
                {batchGenerating ? 'Generating...' : 'Generate All Missing'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-4 p-4 bg-[#D02020] text-white border-4 border-[#121212] font-bold">
            {error}
          </div>
        )}

        {loading && characters.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-[#121212] border-t-[#D02020] rounded-full animate-spin" />
              <p className="font-bold uppercase tracking-widest text-[#121212]">Loading characters</p>
            </div>
          </div>
        ) : (
          <div className="bg-white border-4 border-[#121212] shadow-bauhaus-lg p-4 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredCharacters.map((character, idx) => (
                <CharacterCard
                  key={character.id}
                  character={character}
                  index={idx}
                  generating={generating === character.id}
                  onSelect={handleCharacterClick}
                  onGenerateImages={handleGenerateImages}
                />
              ))}
            </div>

            {filteredCharacters.length === 0 && (
              <div className="text-center py-12">
                <p className="font-bold uppercase tracking-widest text-[#121212]/50">
                  No characters match this filter
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-[#121212] border-t-4 border-[#121212] px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-sm text-white/70 font-medium">
          <span>{characters.length} characters total</span>
          <span className="font-bold uppercase tracking-widest text-white/50">Whatif Studio</span>
        </div>
      </footer>

      {/* Detail panel */}
      {showDetail && selectedCharacter && (
        <CharacterDetailPanel
          character={selectedCharacter}
          generating={generating === selectedCharacter.id}
          onClose={handleCloseDetail}
          onGenerateImages={handleGenerateImages}
        />
      )}

      {/* Batch generating overlay */}
      {batchGenerating && (
        <div className="fixed inset-0 bg-[#121212]/60 flex items-center justify-center z-50">
          <div className="bg-white border-4 border-[#121212] shadow-bauhaus-lg p-8 text-center max-w-sm mx-4">
            <div className="w-12 h-12 border-4 border-[#121212] border-t-[#D02020] rounded-full animate-spin mx-auto mb-4" />
            <p className="font-bold uppercase tracking-widest text-[#121212]">Generating character images</p>
            <p className="text-sm font-medium text-[#121212]/70 mt-2">This may take several minutes</p>
          </div>
        </div>
      )}
    </div>
  );
};
