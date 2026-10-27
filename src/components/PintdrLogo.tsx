import React from 'react';

interface PintdrLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  className?: string;
  orientation?: 'vertical' | 'horizontal';
  inlineNode?: React.ReactNode;
}

export const PintdrLogo: React.FC<PintdrLogoProps> = ({
  size = 'md',
  showWordmark = true,
  className = '',
  orientation = 'horizontal',
  inlineNode,
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
        orientation === 'vertical' ? 'flex-col items-start gap-2' : 'items-center gap-3'
      } min-w-0 ${className}`}
    >
      {/* Pint Glass Brand Icon */}
      <div
        className={`relative ${iconSizes[size]} shrink-0 rounded-2xl overflow-hidden bg-card border border-primary/40 shadow-[0_4px_20px_color-mix(in_oklab,var(--accent)_22%,transparent)] flex items-center justify-center group transition-transform hover:scale-105`}
      >
        <img
          src="/assets/pintdr-flaming-pint-centered.png"
          alt="Pintdr Logo Pint Glass"
          className="w-full h-full object-cover select-none pointer-events-none drop-shadow-md"
        />
      </div>

      {showWordmark && (
        <div className="flex flex-col justify-center leading-none min-w-0">
          <div
            className={`font-black tracking-tight font-display flex items-center gap-2 select-none min-w-0 ${textSizes[size]}`}
          >
            <span className="text-primary drop-shadow-[0_2px_12px_color-mix(in_oklab,var(--accent)_30%,transparent)]">
              Pintdr
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 min-w-0">
            {inlineNode}
            <span
              className={`text-muted font-medium tracking-normal lowercase truncate ${inlineNode ? 'hidden sm:inline' : ''} ${sublineSizes[size]}`}
            >
              squad outing matcher
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

