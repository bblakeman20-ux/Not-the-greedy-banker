import React from 'react';
import { Flame } from 'lucide-react';

interface FlickeringFlameLoaderProps {
  statusText?: string;
  subText?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const FlickeringFlameLoader: React.FC<FlickeringFlameLoaderProps> = ({
  statusText = 'Gerg AI is igniting fresh ideas...',
  subText = 'Tailoring directly to your theme & location',
  size = 'md',
}) => {
  const badgeSizes = {
    sm: 'w-14 h-14 rounded-2xl shadow-lg shadow-primary/25',
    md: 'w-20 h-20 rounded-3xl shadow-xl shadow-primary/30',
    lg: 'w-24 h-24 rounded-3xl shadow-2xl shadow-primary/35',
  };

  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  const auraSizes = {
    sm: 'w-24 h-24',
    md: 'w-32 h-32',
    lg: 'w-40 h-40',
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-200">
      {/* Outer Pulse Container */}
      <div className="relative flex items-center justify-center my-2">
        {/* Soft Ambient Radiance Aura */}
        <div
          className={`absolute ${auraSizes[size]} rounded-full bg-gradient-to-tr from-primary/30 to-primary-hi/20 blur-2xl animate-pulse pointer-events-none`}
        />

        {/* Hot Coral Badge with Charcoal Cutout Flame */}
        <div
          className={`relative ${badgeSizes[size]} bg-gradient-to-tr from-primary via-primary to-primary-hi flex items-center justify-center text-primary-ink border border-ink/20 select-none z-10 animate-[flamePulse_1.5s_ease-in-out_infinite_alternate]`}
        >
          <Flame className={`${iconSizes[size]} fill-current drop-shadow-sm`} />
        </div>
      </div>

      {/* Dynamic Status Text */}
      <div className="mt-5 space-y-1.5 max-w-sm">
        <h4 className="font-display font-black text-sm sm:text-base text-ink tracking-wide leading-snug">
          {statusText}
        </h4>
        {Boolean(subText) && (
          <p className="text-xs text-muted leading-relaxed">
            {subText}
          </p>
        )}
      </div>

      {/* High-quality smooth breathing pulse keyframe */}
      <style>{`
        @keyframes flamePulse {
          0% {
            transform: scale(0.94);
            box-shadow: 0 0 20px color-mix(in oklab,var(--accent) 30%,transparent);
          }
          50% {
            transform: scale(1.05);
            box-shadow: 0 0 38px color-mix(in oklab,var(--accent) 60%,transparent);
          }
          100% {
            transform: scale(0.98);
            box-shadow: 0 0 25px color-mix(in oklab,var(--accent) 40%,transparent);
          }
        }
      `}</style>
    </div>
  );
};
