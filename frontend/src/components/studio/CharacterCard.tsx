import React from 'react';
import { Button } from '@/components/ui/button';
import type { CharacterListItem } from '../../lib/studio/types';

interface CharacterCardProps {
  character: CharacterListItem;
  index: number;
  generating: boolean;
  onSelect: (charId: string) => void;
  onGenerateImages: (charId: string) => void;
}

export const CharacterCard: React.FC<CharacterCardProps> = ({
  character, index, generating, onSelect, onGenerateImages,
}) => {
  const accents = ['#D02020', '#1040C0', '#F0C020'] as const;
  const accent = accents[index % 3];

  return (
    <div
      className="relative text-left w-full bg-white border-4 border-[#121212] shadow-bauhaus
                 hover:-translate-y-1 hover:shadow-bauhaus-md transition-all duration-200
                 ease-out group cursor-pointer"
      onClick={() => onSelect(character.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(character.id)}
    >
      {/* Corner accent */}
      <div
        className="absolute top-2 right-2 w-3 h-3 border-2 border-[#121212] z-10"
        style={{
          backgroundColor: accent,
          borderRadius: index % 3 === 0 ? '9999px' : 0,
          clipPath: index % 3 === 2 ? 'polygon(50% 0%, 0% 100%, 100% 100%)' : undefined,
        }}
      />

      {/* Image area */}
      <div className="aspect-square bg-[#E0E0E0] border-b-4 border-[#121212] overflow-hidden relative">
        {character.imageUrls.front ? (
          <img
            src={character.imageUrls.front}
            alt={`${character.name} - front view`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div
                className="w-16 h-24 mx-auto border-4 border-[#121212] rounded-t-full"
                style={{ backgroundColor: accent + '40' }}
              />
              <p className="text-xs font-bold uppercase tracking-wider text-[#121212]/50 mt-2">
                No image
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="font-bold text-[#121212] uppercase text-sm truncate">
          {character.name}
        </div>
        <div className="text-xs text-[#121212]/70 mt-1 font-medium line-clamp-2 h-8">
          {character.description || 'No description available'}
        </div>

        {/* Data completeness badges */}
        <div className="flex flex-wrap gap-1 mt-3">
          {character.dataCompleteness.hasVoice && (
            <span className="text-[10px] px-1.5 py-0.5 bg-[#1040C0] text-white font-bold uppercase">
              voice
            </span>
          )}
          {character.dataCompleteness.hasArc && (
            <span className="text-[10px] px-1.5 py-0.5 bg-[#F0C020] text-[#121212] font-bold uppercase">
              arc
            </span>
          )}
          {character.dataCompleteness.hasKnowledge && (
            <span className="text-[10px] px-1.5 py-0.5 bg-[#D02020] text-white font-bold uppercase">
              know
            </span>
          )}
          {character.dataCompleteness.hasGlb && (
            <span className="text-[10px] px-1.5 py-0.5 bg-[#121212] text-white font-bold uppercase">
              3D
            </span>
          )}
          {character.dataCompleteness.hasImages && (
            <span className="text-[10px] px-1.5 py-0.5 bg-[#121212] text-white font-bold uppercase">
              img
            </span>
          )}
        </div>

        {/* Generate button */}
        {!character.dataCompleteness.hasImages && (
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="mt-3 w-full"
            disabled={generating}
            onClick={(e) => {
              e.stopPropagation();
              onGenerateImages(character.id);
            }}
          >
            {generating ? 'Generating...' : 'Generate Images'}
          </Button>
        )}
      </div>
    </div>
  );
};
