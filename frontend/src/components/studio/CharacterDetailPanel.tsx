import React from 'react';
import { Button } from '@/components/ui/button';
import type { CharacterDetail } from '../../lib/studio/types';

interface CharacterDetailPanelProps {
  character: CharacterDetail;
  generating: boolean;
  onClose: () => void;
  onGenerateImages: (charId: string, forceRegenerate?: boolean) => void;
}

export const CharacterDetailPanel: React.FC<CharacterDetailPanelProps> = ({
  character, generating, onClose, onGenerateImages,
}) => {
  const name = character.profile?.name || character.name || character.id;
  const description = character.profile?.description || '';
  const views = ['front', 'side', 'back'] as const;

  const speechPatterns = character.voice?.speech_patterns;
  const exampleLines = speechPatterns?.example_lines || character.voice?.example_lines || [];
  const knowledge = character.knowledge;
  const arc = character.arc;
  const relationships = character.relationships?.relationships;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#121212]/60"
        onClick={onClose}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      />

      {/* Panel */}
      <div className="relative ml-auto w-full max-w-2xl bg-white border-l-4 border-[#121212]
                      shadow-bauhaus-lg overflow-y-auto animate-slide-in">
        {/* Header */}
        <div className="sticky top-0 bg-[#D02020] border-b-4 border-[#121212] px-6 py-4
                        flex items-center justify-between z-10">
          <h2 className="font-subheading text-white">{name}</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-white/10"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Reference Images */}
          <div>
            <h3 className="font-label text-[#121212] text-sm tracking-widest mb-3">Reference Images</h3>
            <div className="grid grid-cols-3 gap-3">
              {views.map((view) => (
                <div key={view} className="border-4 border-[#121212] overflow-hidden">
                  {character.imageUrls[view] ? (
                    <img
                      src={character.imageUrls[view]}
                      alt={`${name} - ${view}`}
                      className="w-full aspect-square object-cover"
                    />
                  ) : (
                    <div className="w-full aspect-square bg-[#E0E0E0] flex items-center justify-center">
                      <span className="text-xs font-bold uppercase text-[#121212]/50">{view}</span>
                    </div>
                  )}
                  <div className="bg-[#121212] text-white text-xs font-bold uppercase tracking-widest text-center py-1">
                    {view}
                  </div>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="default"
              size="sm"
              className="mt-3 w-full"
              disabled={generating}
              onClick={() => onGenerateImages(character.id, true)}
            >
              {generating ? 'Generating...' : 'Generate / Regenerate Images'}
            </Button>
          </div>

          {/* Description */}
          {description && (
            <div>
              <h3 className="font-label text-[#121212] text-sm tracking-widest mb-2">Description</h3>
              <p className="text-sm text-[#121212]/90 font-medium leading-relaxed">{description}</p>
            </div>
          )}

          {/* Voice Profile */}
          {speechPatterns && (
            <div className="border-4 border-[#121212] p-4">
              <h3 className="font-label text-[#121212] text-sm tracking-widest mb-3">Voice Profile</h3>
              <div className="space-y-2 text-sm">
                {speechPatterns.dialect && (
                  <div><span className="font-bold uppercase text-xs">Dialect:</span> <span className="font-medium">{speechPatterns.dialect}</span></div>
                )}
                {speechPatterns.sentence_length && (
                  <div><span className="font-bold uppercase text-xs">Sentence Length:</span> <span className="font-medium">{speechPatterns.sentence_length}</span></div>
                )}
                {speechPatterns.vocabulary_level && (
                  <div><span className="font-bold uppercase text-xs">Vocabulary:</span> <span className="font-medium">{speechPatterns.vocabulary_level}</span></div>
                )}
                {speechPatterns.subtext_style && (
                  <div><span className="font-bold uppercase text-xs">Subtext Style:</span> <span className="font-medium">{speechPatterns.subtext_style}</span></div>
                )}
                {speechPatterns.verbal_tics?.length > 0 && (
                  <div>
                    <span className="font-bold uppercase text-xs">Verbal Tics:</span>{' '}
                    <span className="font-medium">{speechPatterns.verbal_tics.join(', ')}</span>
                  </div>
                )}
                {speechPatterns.avoids?.length > 0 && (
                  <div>
                    <span className="font-bold uppercase text-xs">Avoids:</span>{' '}
                    <span className="font-medium">{speechPatterns.avoids.join(', ')}</span>
                  </div>
                )}
              </div>
              {exampleLines.length > 0 && (
                <div className="mt-3 border-t-2 border-[#121212] pt-3">
                  <span className="font-bold uppercase text-xs text-[#121212]">Example Lines:</span>
                  {exampleLines.slice(0, 3).map((line: string, i: number) => (
                    <p key={i} className="text-sm italic text-[#121212]/80 font-medium mt-1">
                      &ldquo;{line}&rdquo;
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Knowledge */}
          {knowledge && (knowledge.knows?.length > 0 || knowledge.beliefs?.length > 0 || knowledge.secrets_held?.length > 0) && (
            <div className="border-4 border-[#121212] p-4">
              <h3 className="font-label text-[#121212] text-sm tracking-widest mb-3">Knowledge</h3>
              <div className="space-y-3 text-sm">
                {knowledge.knows?.length > 0 && (
                  <div>
                    <span className="font-bold uppercase text-xs text-[#1040C0]">Knows:</span>
                    <ul className="mt-1 space-y-1">
                      {knowledge.knows.slice(0, 5).map((item: any, i: number) => (
                        <li key={i} className="font-medium text-[#121212]/80">
                          <span className="text-[10px] px-1 py-0.5 bg-[#E0E0E0] text-[#121212] font-bold uppercase mr-1">
                            {item.confidence || 'certain'}
                          </span>
                          {item.fact}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {knowledge.beliefs?.length > 0 && (
                  <div>
                    <span className="font-bold uppercase text-xs text-[#F0C020]">Beliefs:</span>
                    <ul className="mt-1 space-y-1">
                      {knowledge.beliefs.slice(0, 3).map((item: any, i: number) => (
                        <li key={i} className="font-medium text-[#121212]/80">{item.belief}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {knowledge.secrets_held?.length > 0 && (
                  <div>
                    <span className="font-bold uppercase text-xs text-[#D02020]">Secrets:</span>
                    <ul className="mt-1 space-y-1">
                      {knowledge.secrets_held.slice(0, 3).map((item: any, i: number) => (
                        <li key={i} className="font-medium text-[#121212]/80">{item.fact}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Arc */}
          {arc && (arc.from || arc.to) && (
            <div className="border-4 border-[#121212] p-4">
              <h3 className="font-label text-[#121212] text-sm tracking-widest mb-3">Character Arc</h3>
              <div className="flex items-center gap-3 text-sm">
                {arc.from && (
                  <span className="px-2 py-1 bg-[#E0E0E0] text-[#121212] border-2 border-[#121212] font-bold uppercase">
                    {arc.from}
                  </span>
                )}
                {arc.from && arc.to && (
                  <span className="text-[#121212] font-bold">&rarr;</span>
                )}
                {arc.to && (
                  <span className="px-2 py-1 bg-[#121212] text-white font-bold uppercase">
                    {arc.to}
                  </span>
                )}
              </div>
              {arc.type && (
                <div className="mt-2 text-xs font-bold uppercase text-[#121212]/70">
                  Type: {arc.type}
                </div>
              )}
            </div>
          )}

          {/* Relationships */}
          {relationships && Object.keys(relationships).length > 0 && (
            <div className="border-4 border-[#121212] p-4">
              <h3 className="font-label text-[#121212] text-sm tracking-widest mb-3">Relationships</h3>
              <div className="space-y-2">
                {Object.entries(relationships).map(([charId, rel]: [string, any]) => (
                  <div key={charId} className="flex items-start gap-2 text-sm">
                    <span className="px-2 py-0.5 bg-[#1040C0] text-white font-bold uppercase text-xs shrink-0">
                      {charId.replace(/_/g, ' ')}
                    </span>
                    <span className="font-medium text-[#121212]/80">
                      {rel.type || 'connected'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
