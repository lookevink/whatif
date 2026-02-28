import React, { useState, useRef, useEffect } from 'react';

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

  return (
    <div
      className="relative inline-block"
      ref={containerRef}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        className={`inline-flex items-center justify-center w-5 h-5 rounded-full transition-colors cursor-pointer text-sm ${
          dark ? 'text-white/80 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
        }`}
        title="Data quality & completeness"
        aria-label="Show data quality info"
      >
        {children ?? 'ⓘ'}
      </button>
      {isOpen && (
        <div className="absolute z-50 mt-1 min-w-[180px] p-3 bg-white rounded-lg shadow-lg border border-gray-300 text-left">
          <div className="text-xs font-medium text-gray-900 mb-2">
            Data quality & completeness
          </div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs text-gray-700">Confidence: {pct}%</span>
            <span className={`text-xs font-medium ${complete ? 'text-green-600' : 'text-amber-600'}`}>
              {complete ? 'Complete' : 'Incomplete'}
            </span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full rounded-full ${
                complete ? 'bg-green-500' : pct > 80 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {!complete && missingFields.length > 0 && (
            <div className="text-xs text-red-600 mt-1">
              Missing: {missingFields.slice(0, 3).join(', ')}
              {missingFields.length > 3 && ` +${missingFields.length - 3}`}
            </div>
          )}
          {generatedFields.length > 0 && (
            <div className="text-xs text-amber-600 mt-1">
              Generated: {generatedFields.slice(0, 2).join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
