import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface ConfidenceBadgeProps {
  confidence: number;
  missingFields?: string[];
  generatedFields?: string[];
  complete?: boolean;
  variant?: 'compact' | 'detailed';
  dark?: boolean;
  children?: React.ReactNode;
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({
  confidence,
  missingFields = [],
  generatedFields = [],
  complete = false,
  dark = false,
  children
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const pct = Math.round(confidence * 100);

  const getBarColor = () => {
    if (complete) return '#1040C0';
    if (pct > 80) return '#F0C020';
    return '#D02020';
  };

  return (
    <div
      className="relative inline-block"
      ref={containerRef}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className={`inline-flex items-center justify-center rounded-full font-black ${
          dark
            ? 'text-white/90 hover:text-white hover:bg-white/20'
            : 'text-[#121212] hover:bg-[#E0E0E0]'
        }`}
        title="Data quality & completeness"
        aria-label="Show data quality info"
      >
        {children ?? 'ⓘ'}
      </Button>
      {isOpen && (
        <div className="absolute z-50 mt-1 min-w-[200px] p-4 bg-white border-4 border-[#121212] shadow-bauhaus-lg text-left">
          <div className="font-label text-[#121212] text-xs tracking-widest mb-2">
            Data quality & completeness
          </div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-sm font-bold text-[#121212]">Confidence: {pct}%</span>
            <span
              className={`text-xs font-bold uppercase ${
                complete ? 'text-[#1040C0]' : 'text-[#D02020]'
              }`}
            >
              {complete ? 'Complete' : 'Incomplete'}
            </span>
          </div>
          <div className="w-full h-3 bg-[#E0E0E0] border-2 border-[#121212] overflow-hidden mb-2">
            <div
              className="h-full transition-all duration-200"
              style={{
                width: `${pct}%`,
                backgroundColor: getBarColor()
              }}
            />
          </div>
          {!complete && missingFields.length > 0 && (
            <div className="text-xs font-medium text-[#D02020] mt-1">
              Missing: {missingFields.slice(0, 3).join(', ')}
              {missingFields.length > 3 && ` +${missingFields.length - 3}`}
            </div>
          )}
          {generatedFields.length > 0 && (
            <div className="text-xs font-medium text-[#121212] mt-1">
              Generated: {generatedFields.slice(0, 2).join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
