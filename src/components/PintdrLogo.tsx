import React from 'react';

interface PintdrLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  className?: string;
  orientation?: 'vertical' | 'horizontal';
}

export const PintdrLogo: React.FC<PintdrLogoProps> = ({
  size = 'md',
  showWordmark = true,
  className = '',
  orientation = 'horizontal',
}) => {
  const iconSizes = {
    sm: 'w-10 h-10',
    md: 'w-13 h-13 sm:w-14 sm:h-14',
    lg: 'w-20 h-20',
  };

  const textSizes = {
    sm: 'text-xl sm:text-2xl',
    md: 'text-2xl sm:text-3xl',
    lg: 'text-3xl sm:text-4xl',
  };

  const sublineSizes = {
    sm: 'text-[11px]',
    md: 'text-xs',
    lg: 'text-sm',
  };

  return (
    <div
      className={`flex ${
        orientation === 'vertical' ? 'flex-col items-start gap-2' : 'items-center gap-3.5'
      } ${className}`}
    >
      {/* Pint Glass Brand Icon: Colour-matched flame pint from user asset */}
      <div
        className={`relative ${iconSizes[size]} shrink-0 rounded-2xl overflow-hidden bg-[#1a1d22] border border-[#ff6b57]/40 shadow-[0_4px_20px_rgba(255,107,87,0.22)] flex items-center justify-center group transition-transform hover:scale-105`}
      >
        <img
          src="/assets/aistudio/1792890516940_5de73647.jpg"
          alt="Pintdr Logo Pint Glass"
          className="w-[142%] max-w-none h-[142%] object-cover object-[50%_36%] select-none pointer-events-none drop-shadow-md"
        />
      </div>

      {showWordmark && (
        <div className="flex flex-col justify-center leading-none">
          <div
            className={`font-black tracking-tight font-display flex items-baseline select-none ${textSizes[size]}`}
          >
            <span className="text-[#ff6b57] drop-shadow-[0_2px_12px_rgba(255,107,87,0.3)]">
              Pintdr
            </span>
          </div>
          <span
            className={`text-[#a1a1aa] font-medium tracking-normal mt-1 lowercase ${sublineSizes[size]}`}
          >
            squad outing matcher
          </span>
        </div>
      )}
    </div>
  );
};

