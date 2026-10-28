import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { AppConfig, BanItem, OutingEvent, User, Venue } from '../../types';
import { normName, realPlace } from '../../utils/storage';
import { askGergAI, MODES } from '../../utils/gemini';
import { rollMapSpots } from '../../utils/mapRoll';
import { themeConfetti } from '../../utils/theme';
import { VenueExplorer } from '../VenueExplorer';
import { FlickeringFlameLoader } from '../FlickeringFlameLoader';
import { Dices, Flame, Gem, Home, MapPin, Plus, Route, Search, Sparkles, Ticket, X, Zap, Map as MapIcon } from 'lucide-react';

interface DiscoverPanelProps {
  event: OutingEvent;
  squad: User[];
  banList: BanItem[];
  currentUser: User | null;
  config: AppConfig;
  notify: (msg: string) => void;
  onOpenPintdr: () => void;
  onAddVenue: (venue: Partial<Venue>) => void; // a like from the map explorer
  onShortlist: (ideas: Partial<Venue>[]) => boolean;
  onAddRolled: (venues: Partial<Venue>[]) => number; // returns bounties redeemed
  onPitch: (name: string, loc: string) => boolean;
  onAddBan: (name: string) => void;
  askToken: number; // bump to run Gerg AI straight away (the bounty "bailout")
}

const NEED_PROFILE = '👆 Tap your profile first in the squad bar above (or + New Profile)';

// Idea generator: Gerg AI, the interactive map and custom pitches.
export const DiscoverPanel: React.FC<DiscoverPanelProps> = ({
  event,
  squad,
  banList,
  currentUser,
  config,
  notify,
  onOpenPintdr,
  onAddVenue,
  onShortlist,
  onAddRolled,
  onPitch,
  onAddBan,
  askToken,
}) => {
  const [discoverTool, setDiscoverTool] = useState<'ai' | 'map' | 'manual'>('ai');
  const [pitchName, setPitchName] = useState('');
  const [pitchLoc, setPitchLoc] = useState('');

  const [aiLoc, setAiLoc] = useState(event.where || '');
  const [aiVib, setAiVib] = useState(event.vibe || '');
  const [aiWhen, setAiWhen] = useState(event.when || '');
  const [aiBud] = useState('');

  // Keep search inputs synchronized when switching events or receiving a Travel Midpoint hand-off
  useEffect(() => {
    setAiLoc(event.where || '');
    setAiVib(event.vibe || '');
    setAiWhen(event.when || '');
  }, [event.id, event.where, event.vibe, event.when]);

  const [aiMode, setAiMode] = useState('gems');
  const [freeMsg, setFreeMsg] = useState('');
  const [aiMsg, setAiMsg] = useState('');
  const [aiSources, setAiSources] = useState<Array<{ title: string; uri: string }>>([]);
  const [fastMode, setFastMode] = useState(true);
  const [streamingIdeas, setStreamingIdeas] = useState<Partial<Venue>[]>([]);
  const [isAiStreaming, setIsAiStreaming] = useState(false);
  const [stagedIdeas, setStagedIdeas] = useState<Venue[]>([]);

  const handleRollFree = async () => {
    if (!currentUser) {
      notify(NEED_PROFILE);
      return;
    }
    const where = aiLoc.trim() || realPlace(event.where) || (event.mid && event.mid.name) || '';
    const vibe = aiVib.trim() || event.vibe || '';
    if (!where) {
      setFreeMsg('📍 Set an area for this plan first – tap Edit ▾ on the plan card');
      return;
    }
    setFreeMsg(`🗺️ Searching the map around ${where}...`);
    const roll = await rollMapSpots(event, banList, where, vibe, (msg) => setFreeMsg(`🗺️ ${msg}`));
    if (!roll.venues.length) {
      setFreeMsg(
        roll.curated
          ? "❌ Couldn't reach the map – try another area or use Gerg AI."
          : `🤷 That's everything nearby for "${vibe || 'any vibe'}" – try another vibe or wider area`
      );
      return;
    }
    const won = onAddRolled(roll.venues);
    setFreeMsg(
      roll.curated
        ? `✅ Rolled ${roll.venues.length} curated anti-default spots near ${where}`
        : `✅ Added ${roll.venues.length} real venues near ${where}${
            won ? ' • 🎯 Veto Bounty redeemed!' : ''
          } • 🎲 roll again for more • OpenStreetMap verified`
    );
  };

  const handleAskGergAI = async () => {
    if (!currentUser) {
      notify(NEED_PROFILE);
      return;
    }
    setAiMsg('');
    setAiSources([]);
    setStreamingIdeas([]);
    setIsAiStreaming(true);

    const handleStreamIdea = (idea: Partial<Venue>) => {
      setStreamingIdeas((prev) => {
        if (prev.some((p) => normName(p.name || '') === normName(idea.name || ''))) return prev;
        return [...prev, idea];
      });
    };

    try {
      const res = await askGergAI(
        config,
        aiMode,
        squad,
        event,
        banList,
        aiLoc,
        aiVib,
        aiWhen,
        aiBud,
        (msg) => setAiMsg(msg),
        handleStreamIdea,
        fastMode
      );
      setStagedIdeas(
        res.ideas.map((x, i) => ({
          id: 'v_staged_' + Date.now() + '_' + i,
          name: x.name || 'Venue',
          loc: x.loc || aiLoc || '',
          desc: x.desc || '',
          kind: x.kind || 'spot',
          when: x.when,
          cost: x.cost,
          url: x.url,
          steps: x.steps,
          live: x.live,
          votes: {},
        }))
      );
      setAiSources(res.sources);
      setAiMsg(
        `⚡ Gerg AI delivered ${res.ideas.length} ideas in ${res.duration.toFixed(
          1
        )}s! Review them below in "Fresh Gerg AI Rolls" and tap "➕ Shortlist This" to add to the squad list.`
      );
    } catch (e: any) {
      setAiMsg(`⚠️ ${e.message} The Interactive Map still finds real spots nearby.`);
    } finally {
      setIsAiStreaming(false);
      setStreamingIdeas([]);
    }
  };

  // The veto-bounty "Gerg AI Bailout" opens this panel and asks straight away
  useEffect(() => {
    if (askToken > 0) {
      setDiscoverTool('ai');
      handleAskGergAI();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askToken]);

  const handleShortlist = (ideas: Venue[]) => {
    if (!ideas.length || !onShortlist(ideas.map(({ id, votes, ...rest }) => rest))) return;
    const ids = new Set(ideas.map((i) => i.id));
    setStagedIdeas((prev) => prev.filter((i) => !ids.has(i.id)));
    confetti({ particleCount: 45, spread: 60, origin: { y: 0.6 }, colors: themeConfetti() });
    notify(ideas.length === 1 ? `💖 Shortlisted "${ideas[0].name}"!` : `💖 Shortlisted ${ideas.length} ideas!`);
  };

  const handlePitch = () => {
    if (onPitch(pitchName, pitchLoc || aiLoc)) {
      setPitchName('');
      setPitchLoc('');
    }
  };

  return (
  <div className="space-y-4">
    {/* One Clean Pintdr Swipe Deck Hero Button */}
    <button
      type="button"
      onClick={onOpenPintdr}
      className="w-full cursor-pointer bg-gradient-to-r from-primary to-primary-hi hover:brightness-110 active:scale-[0.99] text-primary-ink font-display font-black text-sm sm:text-base py-3.5 px-6 rounded-2xl transition flex items-center justify-center gap-2.5 shadow-[0_0_24px_color-mix(in_oklab,var(--accent)_30%,transparent)]"
    >
      <Flame className="w-5 h-5 fill-current" />
      <span>Launch Pintdr Swipe Deck</span>
    </button>

    {/* Discovery Tool Sub-Pills */}
    <div className="grid grid-cols-3 gap-2">
      <button
        type="button"
        onClick={() => setDiscoverTool('ai')}
        className={`min-h-[42px] cursor-pointer text-xs sm:text-sm px-3 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 whitespace-nowrap shadow-sm font-bold ${
          discoverTool === 'ai'
            ? 'bg-ink text-card'
            : 'bg-card2 text-muted hover:text-ink border border-line'
        }`}
      >
        <Sparkles className={`w-4 h-4 ${discoverTool === 'ai' ? 'text-card' : 'text-secondary'}`} />
        <span>Ask Gerg AI</span>
      </button>
      <button
        type="button"
        onClick={() => setDiscoverTool('map')}
        className={`min-h-[42px] cursor-pointer text-xs sm:text-sm px-3 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 whitespace-nowrap shadow-sm font-bold ${
          discoverTool === 'map'
            ? 'bg-ink text-card'
            : 'bg-card2 text-muted hover:text-ink border border-line'
        }`}
      >
        <MapIcon className={`w-4 h-4 ${discoverTool === 'map' ? 'text-card' : 'text-primary'}`} />
        <span>Interactive Map</span>
      </button>
      <button
        type="button"
        onClick={() => {
          setDiscoverTool('manual');
          if (!pitchLoc) setPitchLoc(realPlace(event.where));
        }}
        className={`min-h-[42px] cursor-pointer text-xs sm:text-sm px-3 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 whitespace-nowrap shadow-sm font-bold ${
          discoverTool === 'manual'
            ? 'bg-ink text-card'
            : 'bg-card2 text-muted hover:text-ink border border-line'
        }`}
      >
        <Plus className={`w-4 h-4 ${discoverTool === 'manual' ? 'text-card stroke-[3]' : 'text-ink'}`} />
        <span>Pitch Custom</span>
      </button>
    </div>

        {/* Child Panel: Mode 1 - Interactive Map & Curated Spots */}
        {discoverTool === 'map' && (
          <div className="space-y-4 pt-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card2 border border-line rounded-xl p-3.5">
              <div className="text-xs text-ink2">
                Browse real venues in <b>{aiLoc || event.where || 'your area'}</b> with Google Map pins, Tinder swipe cards, or grid.
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleRollFree}
                  className="cursor-pointer bg-card border border-line hover:border-primary text-ink font-semibold text-xs px-3.5 py-2 rounded-xl active:scale-95 transition whitespace-nowrap flex items-center gap-1.5"
                >
                  <Dices className="w-3.5 h-3.5 text-primary" />
                  <span>Roll 3 Instant Spots</span>
                </button>
              </div>
            </div>
            {freeMsg && (
              <div className="text-xs text-ink2 bg-card2 border border-line px-3.5 py-2.5 rounded-xl">
                {freeMsg}
              </div>
            )}

            <VenueExplorer
              event={event}
              squad={squad}
              currentUser={currentUser}
              banList={banList}
              defaultArea={
                aiLoc.trim() || event.where || (event.mid && event.mid.name) || realPlace(currentUser?.loc) || 'Rochester'
              }
              defaultVibe={aiVib.trim() || event.vibe || ''}
              onAddVenue={onAddVenue}
              onAddBan={onAddBan}
              onShowToast={notify}
              onOpenPintdr={onOpenPintdr}
            />
          </div>
        )}

        {/* Child Panel: Mode 2 - Gerg AI */}
        {discoverTool === 'ai' && (
          <div className="space-y-4 pt-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-ink flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span>Gerg AI Idea Engine</span>
                </div>
                <div className="text-[11px] text-muted">
                  {MODES[aiMode]?.sub || 'Tailored ideas, live events & multi-stop combos'}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setFastMode(!fastMode)}
                className={`cursor-pointer text-[11px] font-bold px-3 py-1 rounded-lg border transition flex items-center gap-1.5 shrink-0 ${
                  fastMode
                    ? 'bg-[color-mix(in_oklab,var(--good)_12%,transparent)] text-secondary border-secondary/40'
                    : 'bg-card2 text-muted border-line'
                }`}
              >
                {fastMode ? (
                  <>
                    <Zap className="w-3 h-3 text-secondary" />
                    <span>Fast Mode: ON</span>
                  </>
                ) : (
                  <>
                    <Search className="w-3 h-3" />
                    <span>Deep Web Search</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {Object.entries(MODES).map(([k, m]) => {
                const ModeIcon = k === 'gems' ? Gem : k === 'events' ? Ticket : k === 'combo' ? Route : Dices;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setAiMode(k)}
                    className={`cursor-pointer text-xs font-semibold px-3 py-2 rounded-xl border transition whitespace-nowrap flex items-center justify-center gap-1.5 ${
                      aiMode === k
                        ? 'border-primary bg-card2 text-ink'
                        : 'border-line bg-card2 text-muted hover:text-ink'
                    }`}
                  >
                    <ModeIcon className="w-3.5 h-3.5" />
                    <span>{m.lbl}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleAskGergAI}
              disabled={isAiStreaming}
              className={`w-full cursor-pointer font-bold text-xs sm:text-sm px-4 py-3 rounded-xl transition flex items-center justify-center gap-2 ${
                isAiStreaming
                  ? 'border border-primary bg-card text-primary animate-pulse cursor-wait'
                  : 'bg-primary text-primary-ink hover:brightness-105 active:scale-[0.99]'
              }`}
            >
              {isAiStreaming ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
                  <span>Generating ideas for {aiLoc || 'your area'}...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 fill-current" />
                  <span>Ask Gerg AI ({MODES[aiMode]?.lbl})</span>
                </>
              )}
            </button>

            {/* Animated Flickering Flame Loading State */}
            {isAiStreaming && streamingIdeas.length === 0 && (
              <div className="bg-card border border-primary/30 rounded-2xl p-6 shadow-xl my-2">
                <FlickeringFlameLoader
                  statusText={`🔥 Gerg AI is uncorking "${aiVib || 'anti-default'}" spots near ${aiLoc || 'your area'}...`}
                  subText="Scanning Google Search, live tickets, and tailored venues"
                  size="sm"
                />
              </div>
            )}

            {/* Real-time Streaming Rack */}
            {streamingIdeas.length > 0 && (
              <div className="p-3.5 bg-card2 border border-primary/40 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-primary">
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-primary" />
                    <span>Incoming ideas ({streamingIdeas.length} of 3)</span>
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {streamingIdeas.map((idea, idx) => (
                    <div
                      key={idx}
                      className="bg-card border border-line rounded-lg p-3 text-xs"
                    >
                      <div className="font-bold text-ink truncate flex items-center gap-1.5">
                        {idea.kind === 'combo' ? (
                          <Route className="w-3.5 h-3.5 text-secondary shrink-0" />
                        ) : idea.live ? (
                          <Ticket className="w-3.5 h-3.5 text-primary shrink-0" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-secondary shrink-0" />
                        )}
                        <span className="truncate">{idea.name}</span>
                      </div>
                      <div className="text-[11px] text-muted truncate mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-primary" />
                        <span>{idea.loc}</span>
                      </div>
                      <p className="text-[11px] text-ink2 mt-1 line-clamp-2">{idea.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {aiMsg && (
              <div className="text-xs text-ink2 whitespace-pre-line bg-card2 border border-line p-3 rounded-xl">
                {aiMsg}
              </div>
            )}
            {aiSources.length > 0 && (
              <div className="text-xs text-muted flex flex-wrap items-center gap-1">
                <Search className="w-3.5 h-3.5 mr-0.5 inline" />
                <span>Checked:</span>
                {aiSources.map((s, idx) => (
                  <span key={idx}>
                    {idx > 0 && ' · '}
                    <a
                      href={s.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ink2 hover:underline"
                    >
                      {s.title}
                    </a>
                  </span>
                ))}
              </div>
            )}

            {/* Fresh Gerg AI Rolls Staging Area */}
            {stagedIdeas.length > 0 && (
              <div className="bg-card border-2 border-primary/40 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/80 pb-3">
                  <div>
                    <div className="font-display font-black text-sm sm:text-base text-ink flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span>Fresh Gerg AI Rolls ({stagedIdeas.length})</span>
                    </div>
                    <div className="text-[11px] text-muted mt-0.5">
                      Staged ideas · tap <strong>➕ Shortlist This</strong> to promote any idea to the squad shortlist.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      handleShortlist(stagedIdeas);
                    }}
                    className="cursor-pointer text-xs font-bold text-secondary hover:underline bg-[color-mix(in_oklab,var(--good)_10%,transparent)] px-2.5 py-1 rounded-lg border border-secondary/30"
                  >
                    ➕ Shortlist All
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {stagedIdeas.map((idea) => {
                    const isGreedy = /greedy\s*banker/i.test(idea.name || '');
                    return (
                      <div
                        key={idea.id}
                        className={`bg-card2 border rounded-xl p-3.5 space-y-2.5 flex flex-col justify-between transition ${
                          isGreedy
                            ? 'border-red-500/80 bg-red-950/30 shadow-[0_0_12px_rgba(239,68,68,0.25)] animate-pulse'
                            : 'border-line hover:border-line2'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-display font-black text-sm sm:text-base text-ink leading-snug">
                              {idea.name}
                            </h4>
                            {idea.kind === 'combo' && (
                              <span className="text-[10px] font-bold text-secondary bg-secondary/10 px-1.5 py-0.5 rounded border border-secondary/20 shrink-0">
                                Combo
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-primary-hi font-semibold flex items-center gap-1 mt-1 flex-wrap">
                            <MapPin className="w-3 h-3 text-primary shrink-0" />
                            <span className="truncate">{idea.loc}</span>
                            {idea.cost ? (
                              <span className="text-ink2">
                                • £{idea.cost.replace(/[^0-9.]/g, '') || idea.cost} pp
                              </span>
                            ) : null}
                            {idea.when ? (
                              <span className="text-muted">• 🕒 {idea.when}</span>
                            ) : null}
                          </div>
                          {Boolean(idea.desc) && (
                            <p className="text-xs text-ink2 mt-2 line-clamp-3 leading-relaxed">
                              {idea.desc}
                            </p>
                          )}
                        </div>

                        <div className="pt-2 border-t border-line flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => handleShortlist([idea])}
                            className={`flex-1 cursor-pointer font-bold text-xs py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 shadow-md active:scale-95 ${
                              isGreedy
                                ? 'bg-red-600 hover:bg-red-500 text-white font-black'
                                : 'bg-primary hover:brightness-110 text-primary-ink'
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{isGreedy ? '🐍 Commit Treason & Shortlist' : '➕ Shortlist This'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setStagedIdeas((prev) => prev.filter((i) => i.id !== idea.id))}
                            className="cursor-pointer text-muted hover:text-primary p-2 rounded-xl border border-line bg-card"
                            title="Discard idea"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Child Panel: Mode 3 - Manual Pitch */}
        {discoverTool === 'manual' && (
          <div className="bg-card2 border border-line rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-bold text-ink font-display flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-secondary" />
                  <span>Pitch Custom Activity</span>
                </div>
                <div className="text-xs text-muted">
                  Add your own venue or custom activity directly to the squad shortlist
                </div>
              </div>
              {currentUser && (
                <button
                  type="button"
                  onClick={() => {
                    setPitchName(`${currentUser.name}'s Place`);
                    setPitchLoc(realPlace(currentUser.loc) || aiLoc);
                  }}
                  className="cursor-pointer text-xs font-bold text-secondary hover:underline transition whitespace-nowrap flex items-center gap-1"
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>Pitch My Place</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-muted mb-1">
                  Venue or Activity Name
                </label>
                <input
                  value={pitchName}
                  onChange={(e) => setPitchName(e.target.value)}
                  placeholder="e.g. Flight Club Darts"
                  className="w-full bg-card border border-line focus:border-primary text-ink px-3.5 py-2.5 rounded-xl text-xs sm:text-sm outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-muted mb-1">
                  Town / Station (Defaults to parent location)
                </label>
                <input
                  value={pitchLoc || aiLoc}
                  onChange={(e) => setPitchLoc(e.target.value)}
                  placeholder="e.g. Rochester"
                  className="w-full bg-card border border-line focus:border-primary text-ink px-3.5 py-2.5 rounded-xl text-xs sm:text-sm outline-none"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handlePitch}
              className="w-full cursor-pointer bg-[color-mix(in_oklab,var(--good)_12%,transparent)] border border-secondary/30 text-secondary font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl hover:bg-[color-mix(in_oklab,var(--good)_20%,transparent)] active:scale-95 transition flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Custom Pitch to Shortlist</span>
            </button>
          </div>
        )}
      </div>
  );
};
