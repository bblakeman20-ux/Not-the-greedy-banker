import { Settings, FileText, Download, QrCode } from 'lucide-react';

interface HeaderProps {
  statusText: string;
  isDenied: boolean;
  onOpenSetup: () => void;
  onOpenSummary: () => void;
  onOpenQrCode: () => void;
  showInstall: boolean;
  onInstall: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  statusText,
  isDenied,
  onOpenSetup,
  onOpenSummary,
  onOpenQrCode,
  showInstall,
  onInstall,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <button
          type="button"
          onClick={onOpenSetup}
          title="Click to manage room or backend connection"
          className="inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#212124] text-[#ff6b57] transition hover:bg-[#2b2b2f] hover:text-[#f4f4f5] cursor-pointer"
        >
          {statusText}
        </button>
        <h1 className="text-xl font-extrabold text-[#f4f4f5] tracking-tight mt-0.5 mb-0 font-display">
          🍻 Not The Greedy Banker
        </h1>
        <div className="text-xs text-[#8d8d94]">
          Anti-Default Outing Engine • Deffo Not Outlook
        </div>
      </div>
      <div className="flex items-center gap-2">
        {showInstall && (
          <button
            type="button"
            onClick={onInstall}
            className="flex items-center gap-1.5 cursor-pointer border border-[#2b2b2f] bg-[#212124] text-[#f4f4f5] font-semibold text-xs px-3 py-2 rounded-xl transition hover:border-[#3b3b40] active:scale-95"
          >
            <Download className="w-3.5 h-3.5 text-[#ff6b57]" />
            <span>📲 Install</span>
          </button>
        )}
        <button
          type="button"
          onClick={onOpenQrCode}
          className="flex items-center gap-1.5 cursor-pointer border border-[#2b2b2f] bg-[#212124] text-[#f4f4f5] font-semibold text-xs px-3 py-2 rounded-xl transition hover:border-[#3b3b40] active:scale-95"
          title="Show QR Code to join room"
        >
          <QrCode className="w-3.5 h-3.5 text-[#ff6b57]" />
          <span>📱 QR</span>
        </button>
        <button
          type="button"
          onClick={onOpenSetup}
          className="flex items-center gap-1.5 cursor-pointer border border-[#2b2b2f] bg-[#212124] text-[#f4f4f5] font-semibold text-xs px-3 py-2 rounded-xl transition hover:border-[#3b3b40] active:scale-95"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>⚙️ Setup</span>
        </button>
        <button
          type="button"
          onClick={onOpenSummary}
          className="flex items-center gap-1.5 cursor-pointer bg-[rgba(198,255,61,0.12)] text-[#c6ff3d] font-semibold text-xs px-3 py-2 rounded-xl transition hover:bg-[rgba(198,255,61,0.2)] active:scale-95"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>📋 Summary</span>
        </button>
      </div>
    </div>
  );
};
