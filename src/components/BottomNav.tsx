import React from 'react';
import { Target, Calendar, Train, Coins, Lock, Check, MapPin } from 'lucide-react';

export type TabType = 'act' | 'dat' | 'trv' | 'kit';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  actCount: number;
  isLocked: boolean;
  hasAlignedDate: boolean;
  dateCount: number;
  hasMidpoint: boolean;
  kittyTotal: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  actCount,
  isLocked,
  hasAlignedDate,
  dateCount,
  hasMidpoint,
  kittyTotal,
}) => {
  const tabs = [
    {
      id: 'act' as TabType,
      label: 'Activities',
      icon: Target,
      badge: isLocked ? (
        <Lock className="w-3 h-3 text-[#c6ff3d]" />
      ) : actCount > 0 ? (
        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#24252a] text-[#8d8d94] border border-[#2b2b2f]">
          {actCount}
        </span>
      ) : null,
    },
    {
      id: 'dat' as TabType,
      label: 'Dates',
      icon: Calendar,
      badge: hasAlignedDate ? (
        <Check className="w-3 h-3 text-[#c6ff3d] stroke-[3]" />
      ) : dateCount > 0 ? (
        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#24252a] text-[#8d8d94] border border-[#2b2b2f]">
          {dateCount}
        </span>
      ) : null,
    },
    {
      id: 'trv' as TabType,
      label: 'Travel',
      icon: Train,
      badge: hasMidpoint ? (
        <MapPin className="w-3 h-3 text-[#ff6b57] fill-[#ff6b57]/20" />
      ) : null,
    },
    {
      id: 'kit' as TabType,
      label: 'Kitty',
      icon: Coins,
      badge: kittyTotal > 0 ? (
        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[rgba(198,255,61,0.12)] text-[#c6ff3d] border border-[#c6ff3d]/30 tabular-nums">
          £{kittyTotal}
        </span>
      ) : null,
    },
  ];

  return (
    <nav
      aria-label="Squad Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#17171a]/95 backdrop-blur-xl border-t border-[#2b2b2f] shadow-[0_-4px_24px_rgba(0,0,0,0.4)]"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 6px)' }}
    >
      <div className="max-w-lg mx-auto px-3 pt-1.5 pb-1 flex items-center justify-around gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeTab(tab.id)}
              className={`flex-1 min-h-[48px] py-1 px-1.5 rounded-xl transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 select-none relative ${
                isActive
                  ? 'text-[#ffffff] bg-[#212124] shadow-[inset_0_0_0_1px_rgba(255,107,87,0.35),0_0_12px_rgba(255,107,87,0.1)]'
                  : 'text-[#8d8d94] hover:text-[#f4f4f5] hover:bg-[#1c1c20]'
              }`}
            >
              <div className="flex items-center gap-1 relative">
                <Icon
                  className={`w-4 h-4 transition-transform ${
                    isActive ? 'text-[#ff6b57] scale-110' : 'text-[#8d8d94]'
                  }`}
                />
                {tab.badge}
              </div>
              <span
                className={`text-[11px] font-bold tracking-tight transition-colors ${
                  isActive ? 'text-[#f4f4f5]' : 'text-[#8d8d94]'
                }`}
              >
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute bottom-1 w-5 h-0.5 rounded-full bg-[#ff6b57]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
