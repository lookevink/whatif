import React from 'react';

interface BauhausLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = { sm: 24, md: 32, lg: 48 };

export const BauhausLogo: React.FC<BauhausLogoProps> = ({ size = 'md', className = '' }) => {
  const s = sizeMap[size];
  const circleR = s * 0.25;
  const squareSize = s * 0.35;
  const triangleSize = s * 0.3;

  return (
    <div className={`flex items-center gap-1 ${className}`} aria-hidden>
      {/* Circle – Red */}
      <div
        className="rounded-full border-2 border-[#121212] shadow-bauhaus-sm flex-shrink-0"
        style={{
          width: circleR * 2,
          height: circleR * 2,
          backgroundColor: '#D02020',
        }}
      />
      {/* Square – Blue */}
      <div
        className="rounded-none border-2 border-[#121212] shadow-bauhaus-sm flex-shrink-0"
        style={{
          width: squareSize,
          height: squareSize,
          backgroundColor: '#1040C0',
        }}
      />
      {/* Triangle – Yellow (SVG for clean border) */}
      <svg
        width={triangleSize}
        height={triangleSize}
        viewBox="0 0 32 32"
        className="flex-shrink-0 drop-shadow-[3px_3px_0_#121212]"
      >
        <polygon
          points="16,2 2,30 30,30"
          fill="#F0C020"
          stroke="#121212"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
};
