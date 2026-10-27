import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppConfig, BanItem, OutingEvent, User, Venue } from '../types';
import { fetchPlaces, makeIdeas, miles } from '../utils/osm';
import { askGergAI, MODES } from '../utils/gemini';
import { isBanned, normName, safeUrl } from '../utils/storage';
import { FlickeringFlameLoader } from './FlickeringFlameLoader';
import {
  Flame,
  X,
  RotateCcw,
  ThumbsDown,
  ThumbsUp,
  Star,
  Ban,
  Sparkles,
  MapPin,
  ExternalLink,
  Map as MapIcon,
  RefreshCw,
  SlidersHorizontal,
  Bot,
  Compass,
  Check,
  Zap,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export interface PintdrCard {
  id: string;
  name: string;
  loc: string;
  desc: string;
  kind?: 'spot' | 'event' | 'combo';
  when?: string;
  cost?: string;
  url?: string;
  steps?: string[];
  source: 'ai' | 'osm';
  category?: string;
  emoji?: string;
  distMiles?: number;
  live?: number;
}

interface PintdrOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  event: OutingEvent;
  squad: User[];
  banList: BanItem[];
  currentUser: User | null;
  config: AppConfig;
  onAddVenue: (venue: Partial<Venue>, makeWinner?: boolean) => void;
  onAddBan: (name: string) => void;
  onShowToast: (msg: string) => void;
  onOpenSetup: () => void;
}

type SourceFilter = 'mixed' | 'ai' | 'osm';

export const PintdrOverlay: React.FC<PintdrOverlayProps> = ({
  isOpen,
  onClose,
  event,
  squad,
  banList,
  currentUser,
  config,
  onAddVenue,
  onAddBan,
  onShowToast,
  onOpenSetup,
}) => {
  // Filters & Parameters
  const [area, setArea] = useState(
    event.where || (event.mid && event.mid.name) || currentUser?.loc || 'Rochester'
  );
  const [vibe, setVibe] = useState(event.vibe || '');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('mixed');
  const [aiMode, setAiMode] = useState<string>('wild');

  // Deck State
  const [deck, setDeck] = useState<PintdrCard[]>([]);
  const [history, setHistory] = useState<PintdrCard[]>([]);
  const [swipedCount, setSwipedCount] = useState(0);
  const [likedCount, setLikedCount] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Swipe Gesture Animation State
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | 'up' | null>(null);

  const seenIdsRef = useRef<Set<string>>(new Set());
  const isFetchingRef = useRef(false);
  const deckCacheRef = useRef<Record<string, PintdrCard[]>>({});

  // Sound / haptic feedback simulation via micro animations
  const currentCard = deck[0] || null;
  const nextCard = deck[1] || null;

  // Sync parameters with active event when opened
  useEffect(() => {
    if (isOpen) {
      const targetArea = event.where || (event.mid && event.mid.name) || currentUser?.loc || 'Rochester';
      const targetVibe = event.vibe || '';
      setArea(targetArea);
      setVibe(targetVibe);

      const cacheKey = `${targetArea.trim().toLowerCase()}__${targetVibe.trim().toLowerCase()}__${sourceFilter}`;
      const cached = deckCacheRef.current[cacheKey];
      if (cached && cached.length > 0) {
        setDeck(cached);
      } else if (!isFetchingRef.current) {
        replenishDeck(true, targetArea, targetVibe);
      }
    }
  }, [isOpen, event.id, event.where, event.vibe]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' || e.key === 'l' || e.key === 'L') {
        if (currentCard) triggerSwipe('right');
      } else if (e.key === 'ArrowLeft' || e.key === 'h' || e.key === 'H') {
        if (currentCard) triggerSwipe('left');
      } else if (e.key === 'ArrowUp' || e.key === 'k' || e.key === 'K') {
        if (currentCard) triggerSwipe('up');
      } else if (e.key === 'z' || e.key === 'Z') {
        handleUndo();
      } else if (e.key === 'b' || e.key === 'B') {
        if (currentCard) handleBan(currentCard);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentCard, deck, history]);

  // Main Generator Pipeline: Fetches and interleaves AI + OSM (100% theme-aware from Card #1)
  const replenishDeck = useCallback(
    async (resetDeck = false, overrideArea?: string, overrideVibe?: string) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      setIsLoadingMore(true);

      const targetArea = (overrideArea ?? area).trim() || 'Rochester';
      const targetVibe = (overrideVibe ?? vibe).trim();
      const cacheKey = `${targetArea.toLowerCase()}__${targetVibe.toLowerCase()}__${sourceFilter}`;

      if (resetDeck) {
        seenIdsRef.current.clear();
        event.venues.forEach((v) => seenIdsRef.current.add(normName(v.name)));
        delete deckCacheRef.current[cacheKey];
        setDeck([]);
      } else if (deckCacheRef.current[cacheKey] && deckCacheRef.current[cacheKey].length > 0) {
        setDeck(deckCacheRef.current[cacheKey]);
        setIsLoadingMore(false);
        isFetchingRef.current = false;
        return;
      }

      const newBatch: PintdrCard[] = [];

      try {
        const canUseAI = sourceFilter === 'mixed' || sourceFilter === 'ai';
        const canUseOSM = sourceFilter === 'mixed' || sourceFilter === 'osm';

        // 1. Fetch from OpenStreetMap if enabled
        let osmCards: PintdrCard[] = [];
        if (canUseOSM) {
          try {
            const placesPool = await fetchPlaces(targetArea, vibe, banList, (msg) => {
              setStatusMessage(`🗺️ ${msg}`);
            });

            const center = placesPool.cs[0];
            const seen = new Set<string>();
            const ideas = makeIdeas(placesPool, targetArea, event, seen);

            // Add combo suggestions
            ideas
              .filter((idea) => idea.kind === 'combo')
              .forEach((idea, i) => {
                const id = `osm_combo_${Date.now()}_${i}`;
                if (!seenIdsRef.current.has(normName(idea.name || ''))) {
                  seenIdsRef.current.add(normName(idea.name || ''));
                  osmCards.push({
                    id,
                    name: idea.name || 'Combo Night',
                    loc: idea.loc || targetArea,
                    desc: idea.desc || 'Multi-stop combo plan',
                    kind: 'combo',
                    steps: idea.steps || [],
                    source: 'osm',
                    emoji: '🔀',
                    category: 'Combo Route',
                    url: idea.url,
                  });
                }
              });

            // Add individual places
            placesPool.places
              .filter((p) => !isBanned(p.name, banList))
              .forEach((p) => {
                if (!seenIdsRef.current.has(normName(p.name))) {
                  seenIdsRef.current.add(normName(p.name));
                  const dist = center ? miles(center, p) : undefined;
                  const street = p.t['addr:street'];
                  const town = p.t['addr:town'] || p.t['addr:city'] || targetArea;
                  osmCards.push({
                    id: p.id,
                    name: p.name,
                    loc: street ? `${street}, ${town}` : town,
                    desc: `${p.c.e} ${p.c.l} • Real venue mapped nearby`,
                    category: p.c.l,
                    emoji: p.c.e,
                    distMiles: dist,
                    source: 'osm',
                    url: safeUrl(p.t.website || p.t['contact:website']),
                  });
                }
              });
          } catch (e: any) {
            console.warn('OSM fetch error in Pintdr:', e);
          }
        }

        // 2. Fetch from Gemini / Gerg AI if enabled and key present
        let aiCards: PintdrCard[] = [];
        if (canUseAI) {
          try {
            setStatusMessage(`⚡ Gerg AI is streaming spots for "${targetVibe || 'anti-default'}"...`);
            const handleStreamIdea = (idea: Partial<Venue>, index: number) => {
              if (!idea.name) return;
              const norm = normName(idea.name);
              if (seenIdsRef.current.has(norm)) return;
              seenIdsRef.current.add(norm);

              const card: PintdrCard = {
                id: `ai_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 5)}`,
                name: idea.name,
                loc: idea.loc || targetArea,
                desc: idea.desc || 'Generative tailored idea for the squad',
                kind: idea.kind || 'spot',
                when: idea.when,
                cost: idea.cost,
                url: idea.url,
                steps: idea.steps,
                live: idea.live,
                source: 'ai',
                emoji: idea.kind === 'combo' ? '🔀' : idea.live ? '🎟️' : targetVibe.toLowerCase().includes('wine') ? '🍷' : '🤖',
                category: idea.kind === 'combo' ? 'AI Combo' : idea.live ? 'Live Event' : 'Tailored Spot',
              };

              setDeck((prev) => {
                if (prev.some((c) => normName(c.name) === norm)) return prev;
                const next = [...prev, card];
                deckCacheRef.current[cacheKey] = next;
                return next;
              });
              setIsLoadingMore(false);
              setStatusMessage(`⚡ Card ${index + 1} ready: "${card.name}" – swipe or pitch now!`);
            };

            const aiResult = await askGergAI(
              config,
              aiMode,
              squad,
              event,
              banList,
              targetArea,
              targetVibe,
              event.when || '',
              '',
              (msg) => setStatusMessage(msg),
              handleStreamIdea,
              true, // fastMode: zero delay
              8 // 8 tailored cards for a rich swipe deck
            );

            aiResult.ideas.forEach((idea, i) => {
              if (idea.name && !seenIdsRef.current.has(normName(idea.name))) {
                seenIdsRef.current.add(normName(idea.name));
                aiCards.push({
                  id: `ai_${Date.now()}_${i}`,
                  name: idea.name,
                  loc: idea.loc || targetArea,
                  desc: idea.desc || 'Generative wildcard for the squad',
                  kind: idea.kind || 'spot',
                  when: idea.when,
                  cost: idea.cost,
                  url: idea.url,
                  steps: idea.steps,
                  live: idea.live,
                  source: 'ai',
                  emoji: idea.kind === 'combo' ? '🔀' : idea.live ? '🎟️' : targetVibe.toLowerCase().includes('wine') ? '🍷' : '🤖',
                  category: idea.kind === 'combo' ? 'AI Combo' : 'AI Wildcard',
                });
              }
            });

            // 1-in-8 cheeky trap card for The Greedy Banker (if not banned) to test squad vigilance
            const bankerNorm = normName('The Greedy Banker');
            if (!seenIdsRef.current.has(bankerNorm) && !isBanned('The Greedy Banker', banList) && Math.random() < 0.2) {
              seenIdsRef.current.add(bankerNorm);
              const trapCard: PintdrCard = {
                id: `trap_${Date.now()}`,
                name: 'The Greedy Banker',
                loc: targetArea,
                desc: 'The eternal default pub with sticky carpets and no excitement. Swiping right commits high squad treason!',
                kind: 'spot',
                category: '🚨 Default Inertia Trap',
                emoji: '🐍',
                source: 'ai',
              };
              const insertIdx = Math.min(2, aiCards.length);
              aiCards.splice(insertIdx, 0, trapCard);
            }
          } catch (e: any) {
            console.warn('AI fetch error in Pintdr:', e);
          }
        }

        // 3. Interleave results dynamically: AI, OSM, AI, OSM...
        const maxLen = Math.max(aiCards.length, osmCards.length);
        for (let i = 0; i < maxLen; i++) {
          if (i < aiCards.length) newBatch.push(aiCards[i]);
          if (i < osmCards.length) newBatch.push(osmCards[i]);
        }

        if (newBatch.length === 0 && deck.length === 0) {
          const vLower = targetVibe.toLowerCase();
          let fallbackSpots: PintdrCard[] = [];

          if (vLower.includes('wine') || vLower.includes('vineyard')) {
            fallbackSpots = [
              {
                id: `fallback_wine_1_${Date.now()}`,
                name: `${targetArea} Boutique Wine & Tapas Flight`,
                loc: targetArea,
                desc: 'Sommelier-curated natural wines paired with artisan British charcuterie.',
                kind: 'combo',
                category: 'Wine Flight',
                emoji: '🍷',
                cost: '£30',
                steps: ['6:30pm Sparkling wine flight', '7:45pm Tapas & regional reds', '9:30pm Port & cheese board'],
                source: 'ai',
              },
              {
                id: `fallback_wine_2_${Date.now()}`,
                name: 'The Cellar Vault Tasting Experience',
                loc: targetArea,
                desc: 'Intimate candlelit brick arch vault with over 40 organic wines by the glass.',
                kind: 'spot',
                category: 'Wine Bar',
                emoji: '🍷',
                cost: '£25',
                source: 'ai',
              },
            ];
          } else if (vLower.includes('craft') || vLower.includes('brew') || vLower.includes('taproom')) {
            fallbackSpots = [
              {
                id: `fallback_craft_1_${Date.now()}`,
                name: 'Microbrewery Tank-to-Glass Tour',
                loc: targetArea,
                desc: 'Behind-the-scenes tasting straight from fermentation vessels, then street pizza.',
                kind: 'combo',
                category: 'Taproom Combo',
                emoji: '🍻',
                cost: '£24',
                steps: ['6:00pm Tank sampling', '7:30pm Neapolitan pizza & fresh hazy IPAs'],
                source: 'ai',
              },
            ];
          } else {
            fallbackSpots = [
              {
                id: `fallback_1_${Date.now()}`,
                name: 'Social Darts & Craft Pint Showdown',
                loc: targetArea,
                desc: 'High-tech interactive darts with craft beers and sharing platters. Fast and fun.',
                kind: 'spot',
                category: 'Activity Bar',
                emoji: '🎯',
                source: 'ai',
              },
              {
                id: `fallback_2_${Date.now()}`,
                name: 'Secret Underground Arcade & Pinball',
                loc: targetArea,
                desc: 'Retro Japanese arcade cabinets, multiplayer pinball, and rotating guest taps.',
                kind: 'spot',
                category: 'Retro Gaming',
                emoji: '🕹️',
                source: 'ai',
              },
              {
                id: `fallback_3_${Date.now()}`,
                name: 'Axe Throwing & Smoked BBQ Combo',
                loc: targetArea,
                desc: 'Tournament-style axe throwing followed by pitmaster brisket platters.',
                kind: 'combo',
                category: 'Combo Night',
                emoji: '🔀',
                steps: ['6:30pm Axe throwing tournament', '8:00pm Low-and-slow BBQ platter'],
                source: 'ai',
              },
            ];
          }

          fallbackSpots.forEach((f) => {
            if (!seenIdsRef.current.has(normName(f.name))) {
              newBatch.push(f);
            }
          });
        }

        if (newBatch.length === 0) {
          setDeck((prev) => {
            if (prev.length === 0) {
              setStatusMessage('🤷 No new spots found for this filter – try expanding the area or vibe.');
            }
            return prev;
          });
        } else {
          setDeck((prev) => {
            const existingNames = new Set(prev.map((c) => normName(c.name)));
            const deduplicated = newBatch.filter((c) => !existingNames.has(normName(c.name)));
            const combined = resetDeck && prev.length === 0 ? deduplicated : [...prev, ...deduplicated];
            deckCacheRef.current[cacheKey] = combined;
            setStatusMessage(`✨ Loaded ${combined.length} swipeable venues!`);
            return combined;
          });
        }
      } catch (err: any) {
        setStatusMessage(`❌ Error loading ideas: ${err.message || 'Network error'}`);
      } finally {
        setIsLoadingMore(false);
        isFetchingRef.current = false;
      }
    },
    [area, vibe, sourceFilter, aiMode, banList, config, event, squad]
  );

  // Monitor deck depth and auto-replenish when running low
  useEffect(() => {
    if (isOpen && deck.length > 0 && deck.length < 3 && !isFetchingRef.current && !isLoadingMore) {
      replenishDeck(false);
    }
  }, [deck.length, isOpen, isLoadingMore, replenishDeck]);

  // Swipe Action Handler
  const triggerSwipe = (direction: 'left' | 'right' | 'up') => {
    if (!currentCard || exitDirection) return;

    setExitDirection(direction);

    setTimeout(() => {
      const card = currentCard;
      setHistory((prev) => [card, ...prev]);
      setDeck((prev) => prev.slice(1));
      setSwipedCount((prev) => prev + 1);
      setDragOffset({ x: 0, y: 0 });
      setExitDirection(null);

      if (direction === 'right') {
        // Liked / Pitch
        handlePitch(card, false);
      } else if (direction === 'up') {
        // Superlike / Make Top Pick
        handlePitch(card, true);
      } else {
        // Left: Pass
        onShowToast(`Binned "${card.name}" 🗑️`);
      }
    }, 220);
  };

  const handlePitch = (card: PintdrCard, makeWinner = false) => {
    if (!currentUser) {
      onShowToast('👆 Tap your profile in the squad bar above before pitching!');
      return;
    }

    const isGreedyBanker = /greedy\s*banker/i.test(card.name);

    const newVenue: Partial<Venue> = {
      name: card.name,
      loc: card.loc,
      desc: card.desc,
      kind: card.kind || 'spot',
      when: card.when,
      cost: card.cost,
      url: card.url,
      steps: card.steps,
      live: card.live,
      src: card.source === 'osm' ? 'osm' : undefined,
      votes: { [currentUser.id]: 'k' },
    };

    onAddVenue(newVenue, makeWinner);
    setLikedCount((prev) => prev + 1);

    confetti({
      particleCount: makeWinner ? 75 : 45,
      spread: makeWinner ? 85 : 60,
      origin: { y: 0.6 },
      colors: isGreedyBanker
        ? ['#ef4444', '#dc2626', '#b91c1c']
        : makeWinner
        ? ['#ff6b57', '#ffd700', '#c6ff3d']
        : ['#c6ff3d', '#4ade80', '#ffffff'],
    });

    if (isGreedyBanker) {
      onShowToast(`🚨 TREASON! ${currentUser.name} caved and pitched The Greedy Banker! £5 Traitor Tax logged!`);
    } else {
      onShowToast(
        makeWinner
          ? `⭐ SUPERLIKE! "${card.name}" pitched and marked as winning spot!`
          : `💖 Pitched "${card.name}" to the squad list!`
      );
    }
  };

  const handleBan = (card: PintdrCard) => {
    onAddBan(card.name);
    onShowToast(`🚫 Permanently banned "${card.name}"!`);
    triggerSwipe('left');
  };

  const handleUndo = () => {
    if (history.length === 0) {
      onShowToast('Nothing to undo!');
      return;
    }
    const [lastCard, ...remainingHistory] = history;
    setHistory(remainingHistory);
    setDeck((prev) => [lastCard, ...prev]);
    setSwipedCount((prev) => Math.max(0, prev - 1));
    onShowToast(`↩️ Restored "${lastCard.name}"`);
  };

  // Drag Gesture Physics
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!currentCard || exitDirection) return;
    const t = e.touches[0];
    setDragStart({ x: t.clientX, y: t.clientY });
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const t = e.touches[0];
    setDragOffset({
      x: t.clientX - dragStart.x,
      y: t.clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    if (!isDragging || !currentCard) return;
    setIsDragging(false);

    if (dragOffset.y < -120 && Math.abs(dragOffset.x) < 80) {
      triggerSwipe('up');
    } else if (dragOffset.x > 85) {
      triggerSwipe('right');
    } else if (dragOffset.x < -85) {
      triggerSwipe('left');
    } else {
      setDragOffset({ x: 0, y: 0 });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!currentCard || exitDirection) return;
    setDragStart({ x: e.clientX, y: e.clientY });
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setDragOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    if (!isDragging || !currentCard) return;
    setIsDragging(false);

    if (dragOffset.y < -120 && Math.abs(dragOffset.x) < 80) {
      triggerSwipe('up');
    } else if (dragOffset.x > 85) {
      triggerSwipe('right');
    } else if (dragOffset.x < -85) {
      triggerSwipe('left');
    } else {
      setDragOffset({ x: 0, y: 0 });
    }
  };

  if (!isOpen) return null;

  // Visual dynamic tilt and stamp opacities
  const cardRotation = dragOffset.x / 14;
  const likeOpacity = Math.min(1, Math.max(0, dragOffset.x / 70));
  const passOpacity = Math.min(1, Math.max(0, -dragOffset.x / 70));
  const superOpacity = Math.min(
    1,
    Math.max(0, -dragOffset.y / 90) * (Math.abs(dragOffset.x) < 60 ? 1 : 0)
  );

  // Transition style when flying off
  const getTransform = () => {
    if (exitDirection === 'left') {
      return 'translate(-150%, 20px) rotate(-35deg)';
    }
    if (exitDirection === 'right') {
      return 'translate(150%, 20px) rotate(35deg)';
    }
    if (exitDirection === 'up') {
      return 'translate(0, -150%) scale(1.1)';
    }
    return `translate(${dragOffset.x}px, ${dragOffset.y}px) rotate(${cardRotation}deg)`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#09090b]/85 backdrop-blur-md flex flex-col items-center justify-between p-3 sm:p-5 text-[#f4f4f5] select-none overflow-y-auto animate-in fade-in duration-200">
      {/* Top Bar HUD */}
      <div className="w-full max-w-md flex items-center justify-between gap-2 z-10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#ff6b57] to-[#ff8f7d] flex items-center justify-center text-[#1a0703] shadow-lg shadow-[#ff6b57]/20">
            <Flame className="w-5 h-5 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-display font-black text-base tracking-wide text-[#f4f4f5]">
              <span>PINTDR™</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-[rgba(255,107,87,0.2)] text-[#ff6b57] border border-[#ff6b57]/30">
                Matchmaker
              </span>
            </div>
            <div className="text-[11px] text-[#8d8d94]">Anti-Banker Idea Swiper</div>
          </div>
        </div>

        {/* Fresh Deal, Filter Toggle & Close Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => replenishDeck(true)}
            disabled={isLoadingMore}
            className="px-2.5 py-1.5 rounded-xl border border-[#2b2b2f] bg-[#17171a] text-[#8d8d94] hover:text-[#c6ff3d] hover:border-[#c6ff3d]/50 transition cursor-pointer flex items-center gap-1.5 text-xs"
            title="Deal fresh tailored cards for current theme & area"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMore ? 'animate-spin text-[#c6ff3d]' : ''}`} />
            <span className="text-[11px] font-bold text-[#cfcfd4] hidden sm:inline">Fresh Deal</span>
          </button>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-xl border transition cursor-pointer flex items-center gap-1 text-xs ${
              showFilters
                ? 'border-[#ff6b57] bg-[rgba(255,107,87,0.15)] text-[#ff6b57]'
                : 'border-[#2b2b2f] bg-[#17171a] text-[#8d8d94] hover:text-[#f4f4f5]'
            }`}
            title="Adjust Search & Filters"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl border border-[#2b2b2f] bg-[#17171a] text-[#8d8d94] hover:text-[#ff6b57] hover:border-[#ff6b57]/50 transition cursor-pointer"
            title="Close PINTDR (ESC)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expandable Filter / Generator Config Tray */}
      {showFilters && (
        <div className="w-full max-w-md bg-[#17171a] border border-[#2b2b2f] rounded-2xl p-3.5 my-2 shrink-0 shadow-2xl animate-in slide-in-from-top-3 duration-150">
          <div className="flex items-center justify-between text-xs font-bold text-[#cfcfd4] mb-2">
            <span className="flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#ff6b57]" />
              <span>Radar Settings</span>
            </span>
            <span className="text-[10px] text-[#8d8d94]">Updates generative deck</span>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="text-[10px] text-[#8d8d94] block mb-1">Town / Area</label>
              <div className="relative">
                <MapPin className="w-3.5 h-3.5 text-[#ff6b57] absolute left-2.5 top-2.5" />
                <input
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="e.g. Soho, Rochester"
                  className="w-full bg-[#212124] border border-transparent focus:border-[#ff6b57] text-[#f4f4f5] pl-7 pr-2 py-1.5 rounded-xl text-xs outline-none"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-[#8d8d94] block mb-1">Vibe Filter</label>
              <input
                value={vibe}
                onChange={(e) => setVibe(e.target.value)}
                placeholder="e.g. curry, arcade, craft beer"
                className="w-full bg-[#212124] border border-transparent focus:border-[#ff6b57] text-[#f4f4f5] px-2.5 py-1.5 rounded-xl text-xs outline-none"
              />
            </div>
          </div>

          {/* Source Filter Switcher */}
          <div className="flex items-center gap-1 bg-[#212124] p-1 rounded-xl mb-2 text-xs">
            <button
              type="button"
              onClick={() => setSourceFilter('mixed')}
              className={`flex-1 py-1 rounded-lg font-semibold flex items-center justify-center gap-1 transition cursor-pointer ${
                sourceFilter === 'mixed'
                  ? 'bg-[#ff6b57] text-[#1a0703]'
                  : 'text-[#8d8d94] hover:text-[#f4f4f5]'
              }`}
            >
              <Zap className="w-3 h-3" />
              <span>Mixed (AI + Map)</span>
            </button>
            <button
              type="button"
              onClick={() => setSourceFilter('osm')}
              className={`flex-1 py-1 rounded-lg font-semibold flex items-center justify-center gap-1 transition cursor-pointer ${
                sourceFilter === 'osm'
                  ? 'bg-[#ff6b57] text-[#1a0703]'
                  : 'text-[#8d8d94] hover:text-[#f4f4f5]'
              }`}
            >
              <Compass className="w-3 h-3" />
              <span>Map Only</span>
            </button>
            <button
              type="button"
              onClick={() => setSourceFilter('ai')}
              className={`flex-1 py-1 rounded-lg font-semibold flex items-center justify-center gap-1 transition cursor-pointer ${
                sourceFilter === 'ai'
                  ? 'bg-[#ff6b57] text-[#1a0703]'
                  : 'text-[#8d8d94] hover:text-[#f4f4f5]'
              }`}
            >
              <Bot className="w-3 h-3" />
              <span>Gerg AI Only</span>
            </button>
          </div>

          {/* AI Mode Selector if AI is enabled */}
          {(sourceFilter === 'mixed' || sourceFilter === 'ai') && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] mb-2">
              {Object.entries(MODES).map(([k, m]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setAiMode(k)}
                  className={`shrink-0 px-2 py-1 rounded-lg border transition cursor-pointer ${
                    aiMode === k
                      ? 'border-[#ff6b57] bg-[rgba(255,107,87,0.15)] text-[#f4f4f5] font-semibold'
                      : 'border-[#2b2b2f] bg-[#212124] text-[#8d8d94]'
                  }`}
                >
                  {m.lbl}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              replenishDeck(true);
              setShowFilters(false);
            }}
            className="w-full cursor-pointer bg-[#ff6b57] text-[#1a0703] font-bold text-xs py-2 rounded-xl hover:brightness-105 active:scale-98 transition flex items-center justify-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Apply & Reload Deck</span>
          </button>
        </div>
      )}

      {/* Status Bar */}
      <div className="w-full max-w-md flex items-center justify-between text-[11px] text-[#8d8d94] px-2 py-1 shrink-0">
        <div className="flex items-center gap-2">
          <span>🔥 Swiped: {swipedCount}</span>
          <span>•</span>
          <span className="text-[#c6ff3d]">💖 Pitched: {likedCount}</span>
        </div>
        <div className="flex items-center gap-1">
          {isLoadingMore ? (
            <span className="flex items-center gap-1.5 text-[#c6ff3d] font-semibold animate-pulse text-[10px] bg-[rgba(198,255,61,0.12)] px-2 py-0.5 rounded-full border border-[#c6ff3d]/30">
              <span className="w-1.5 h-1.5 rounded-full bg-[#c6ff3d] animate-ping" />
              <span>⚡ Fast Streaming ({deck.length} in deck)</span>
            </span>
          ) : (
            <span className="text-[10px] bg-[#212124] px-2 py-0.5 rounded-full text-[#8d8d94]">Deck: {deck.length} cards</span>
          )}
        </div>
      </div>

      {/* Swipe Pool Waiting Counter */}
      {(() => {
        const waitingInPool = Object.values(event.swipePool || {}).filter((item) => (item.likes || []).length === 1).length;
        if (waitingInPool <= 0) return null;
        return (
          <div className="w-full max-w-md bg-[#212124]/90 border border-[#ff6b57]/30 rounded-xl px-3 py-1 my-1 text-[11px] text-[#ff8f7d] flex items-center justify-center gap-1.5 shrink-0 shadow-sm animate-in fade-in">
            <span>🕵️</span>
            <span>
              <strong>{waitingInPool} spot{waitingInPool === 1 ? '' : 's'}</strong> in background swipe pool (waiting for a 2nd match)
            </span>
          </div>
        );
      })()}

      {/* Main Tinder Card Deck Area */}
      <div className="w-full max-w-md flex-1 flex flex-col items-center justify-center my-auto min-h-[380px] max-h-[490px] relative">
        {currentCard ? (
          <div
            className="relative w-full h-full max-h-[460px] touch-none select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Next Card in Stack (Preview) */}
            {nextCard && (
              <div className="absolute inset-0 bg-[#17171a] border border-[#2b2b2f] rounded-3xl p-5 scale-[0.93] translate-y-3 opacity-50 shadow-xl pointer-events-none flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#212124] text-[#8d8d94]">
                      {nextCard.source === 'ai' ? '🤖 AI Wildcard' : '🗺️ Map Spot'}
                    </span>
                    <span className="text-xs text-[#8d8d94]">{nextCard.loc}</span>
                  </div>
                  <h4 className="font-display font-black text-lg text-[#f4f4f5] truncate">
                    {nextCard.name}
                  </h4>
                  <p className="text-xs text-[#8d8d94] mt-1 line-clamp-2">{nextCard.desc}</p>
                </div>
              </div>
            )}

            {/* Active Top Card */}
            {(() => {
              const isGreedyBanker = Boolean(currentCard && /greedy\s*banker/i.test(currentCard.name));
              return (
                <div
                  style={{
                    transform: getTransform(),
                    transition: isDragging ? 'none' : 'transform 0.22s ease-out',
                    cursor: isDragging ? 'grabbing' : 'grab',
                  }}
                  className={`absolute inset-0 rounded-3xl p-5 shadow-2xl flex flex-col justify-between overflow-hidden transition-colors ${
                    isGreedyBanker
                      ? 'bg-gradient-to-b from-red-950/80 via-[#1c1214] to-[#141417] border-2 border-red-500 animate-pulse shadow-[0_0_30px_rgba(239,68,68,0.4)]'
                      : 'bg-gradient-to-b from-[#212124] via-[#1a1a1d] to-[#141417] border-2 border-[#3b3b40]'
                  }`}
                >
                  {/* Dynamic Stamps Overlay */}
                  <div
                    style={{ opacity: likeOpacity }}
                    className={`absolute top-5 right-5 border-3 font-display font-black text-sm px-3.5 py-1 rounded-xl rotate-12 bg-black/80 backdrop-blur-md pointer-events-none tracking-wider shadow-lg ${
                      isGreedyBanker ? 'border-red-500 text-red-400' : 'border-[#c6ff3d] text-[#c6ff3d]'
                    }`}
                  >
                    {isGreedyBanker ? '🐍 COMMIT TREASON' : 'KEEN / PITCH'}
                  </div>
                  <div
                    style={{ opacity: passOpacity }}
                    className="absolute top-5 left-5 border-3 border-[#ff6b57] text-[#ff6b57] font-display font-black text-sm px-3.5 py-1 rounded-xl -rotate-12 bg-black/80 backdrop-blur-md pointer-events-none tracking-wider shadow-lg"
                  >
                    PASS / BIN
                  </div>
                  <div
                    style={{ opacity: superOpacity }}
                    className="absolute top-8 inset-x-0 mx-auto w-fit border-3 border-[#ffd700] text-[#ffd700] font-display font-black text-sm px-4 py-1.5 rounded-xl bg-black/80 backdrop-blur-md pointer-events-none tracking-wider shadow-xl"
                  >
                    SUPERLIKE
                  </div>

                  {/* Card Header & Badges */}
                  <div>
                    {/* Treason Alert Hazard Banner */}
                    {isGreedyBanker && (
                      <div className="mb-2 bg-red-950/90 border border-red-500/80 rounded-xl p-2 text-center shadow-md animate-pulse">
                        <div className="text-[10px] font-black uppercase tracking-wider text-red-300 flex items-center justify-center gap-1.5">
                          <span>🚨 HIGH TREASON: DEFAULT PLANNING INERTIA</span>
                        </div>
                        <div className="text-[10px] text-red-200 mt-0.5">
                          ⚠️ Swiping right caves into lazy pub inertia! £5 Traitor Tax + squad public shaming.
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${
                            isGreedyBanker
                              ? 'bg-red-950 text-red-300 border-red-500/60'
                              : currentCard.source === 'ai'
                              ? 'bg-[rgba(255,107,87,0.15)] text-[#ff6b57] border-[#ff6b57]/30'
                              : 'bg-[rgba(198,255,61,0.15)] text-[#c6ff3d] border-[#c6ff3d]/30'
                          }`}
                        >
                          {isGreedyBanker ? (
                            <span>🐍</span>
                          ) : currentCard.source === 'ai' ? (
                            <Sparkles className="w-3 h-3 text-[#ff6b57]" />
                          ) : (
                            <MapIcon className="w-3 h-3 text-[#c6ff3d]" />
                          )}
                          <span>
                            {isGreedyBanker
                              ? 'Treason Hazard'
                              : currentCard.source === 'ai'
                              ? currentCard.category || 'Gerg AI'
                              : currentCard.category || 'Map Spot'}
                          </span>
                        </span>
                        {currentCard.live ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                            Live Event
                          </span>
                        ) : null}
                      </div>

                      {currentCard.distMiles != null && (
                        <span className="text-[11px] font-mono text-[#8d8d94]">
                          {currentCard.distMiles.toFixed(1)} mi away
                        </span>
                      )}
                    </div>

                    {/* Venue Name & Location */}
                    <h3
                      className={`font-display font-black text-xl leading-snug line-clamp-2 mt-1 ${
                        isGreedyBanker ? 'text-red-300' : 'text-[#f4f4f5]'
                      }`}
                    >
                      {currentCard.name}
                    </h3>
                    <div className="text-xs text-[#ff8f7d] font-semibold mt-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#ff6b57] shrink-0" />
                      <span className="truncate">{currentCard.loc}</span>
                    </div>

                    {/* Meta details if available */}
                    {(currentCard.when || currentCard.cost) && (
                      <div className="flex items-center gap-2 text-xs text-[#cfcfd4] mt-2 font-mono">
                        {currentCard.when && <span>{currentCard.when}</span>}
                        {currentCard.cost && <span>{currentCard.cost}</span>}
                      </div>
                    )}

                    {/* Description */}
                    <p className="text-xs text-[#d4d4d8] mt-2.5 leading-relaxed">
                      {currentCard.desc}
                    </p>

                    {/* Multi-step combo preview */}
                    {currentCard.steps && currentCard.steps.length > 0 && (
                      <div className="mt-3 bg-[#17171a]/80 p-2.5 rounded-2xl border border-[#2b2b2f]">
                        <span className="text-[10px] font-bold text-[#ff6b57] block mb-1">
                          COMBO ROUTE:
                        </span>
                        <ul className="text-[11px] text-[#cfcfd4] space-y-1">
                          {currentCard.steps.map((st, i) => (
                            <li key={i} className="truncate">
                              • {st}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Card Footer Links & Navigation Hint */}
                  <div className="pt-3 border-t border-[#2b2b2f] flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      {currentCard.url ? (
                        <a
                          href={currentCard.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#c6ff3d] hover:underline flex items-center gap-1 text-[11px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Official Link</span>
                        </a>
                      ) : (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            `${currentCard.name}, ${currentCard.loc}`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#8d8d94] hover:text-[#f4f4f5] flex items-center gap-1 text-[11px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MapIcon className="w-3 h-3" />
                          <span>Google Maps</span>
                        </a>
                      )}
                    </div>

                    <div className="text-[10px] text-[#8d8d94] font-medium hidden sm:block">
                      {isGreedyBanker
                        ? '🐍 Swipe Right to Commit Treason • Left to Pass'
                        : 'Swipe Right to Pitch • Left to Pass • Up to Star'}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          /* Empty Deck State or Flickering Flame Loader while fetching */
          <div className="w-full bg-[#17171a] border border-[#2b2b2f] rounded-3xl p-6 text-center shadow-2xl flex flex-col items-center justify-center min-h-[340px]">
            {isLoadingMore ? (
              <FlickeringFlameLoader
                statusText={statusMessage || `🔥 Gerg AI is uncorking "${vibe || 'fresh'}" spots near ${area}...`}
                subText="Tailoring ideas directly to your theme & location"
                size="md"
              />
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-[rgba(255,107,87,0.15)] text-[#ff6b57] flex items-center justify-center text-2xl mb-3 shadow-inner">
                  <Flame className="w-7 h-7 fill-current" />
                </div>
                <h4 className="font-display font-black text-lg text-[#f4f4f5]">
                  You've Swiped All Cached Ideas!
                </h4>
                <p className="text-xs text-[#8d8d94] mt-1 mb-4 max-w-xs">
                  Keep the momentum going: roll another batch of AI wildcards and map venues nearby.
                </p>
                <div className="flex flex-col sm:flex-row gap-2 w-full max-w-xs">
                  <button
                    type="button"
                    onClick={() => replenishDeck(true)}
                    disabled={isLoadingMore}
                    className="flex-1 cursor-pointer bg-[#ff6b57] hover:brightness-110 active:scale-95 text-[#1a0703] font-bold text-xs py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-1.5 shadow-lg disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMore ? 'animate-spin' : ''}`} />
                    <span>Roll Fresh Batch</span>
                  </button>
                  {history.length > 0 && (
                    <button
                      type="button"
                      onClick={handleUndo}
                      className="cursor-pointer border border-[#2b2b2f] bg-[#212124] text-[#f4f4f5] font-semibold text-xs py-2.5 px-4 rounded-xl hover:border-[#3b3b40] transition flex items-center justify-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Undo Last Pass</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom Action Controls HUD */}
      <div className="w-full max-w-md flex items-center justify-center gap-3 pt-3 shrink-0">
        {/* Undo Button */}
        <button
          type="button"
          onClick={handleUndo}
          disabled={history.length === 0}
          title="Undo last swipe (Z)"
          className="cursor-pointer p-3 rounded-full bg-[#17171a] border border-[#2b2b2f] text-[#8d8d94] hover:text-[#f4f4f5] hover:border-[#3b3b40] active:scale-95 transition disabled:opacity-30 disabled:pointer-events-none shadow-md"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Ban Button */}
        <button
          type="button"
          onClick={() => currentCard && handleBan(currentCard)}
          disabled={!currentCard}
          title="Permanently Ban Spot (B)"
          className="cursor-pointer p-3 rounded-full bg-[#17171a] border border-[#2b2b2f] text-[#8d8d94] hover:text-[#ff6b57] hover:border-[#ff6b57] active:scale-95 transition disabled:opacity-30 disabled:pointer-events-none shadow-md"
        >
          <Ban className="w-4 h-4" />
        </button>

        {/* Pass (Dislike) Button */}
        <button
          type="button"
          onClick={() => triggerSwipe('left')}
          disabled={!currentCard}
          title="Pass / Bin this idea (Left Arrow / H)"
          className="cursor-pointer p-4 rounded-full bg-[#212124] border-2 border-[#ff6b57]/40 text-[#ff6b57] hover:bg-[rgba(255,107,87,0.15)] hover:border-[#ff6b57] active:scale-95 transition disabled:opacity-30 disabled:pointer-events-none shadow-lg"
        >
          <ThumbsDown className="w-6 h-6" />
        </button>

        {/* Superlike Button */}
        <button
          type="button"
          onClick={() => triggerSwipe('up')}
          disabled={!currentCard}
          title="Superlike & Set as Winning Pick (Up Arrow / K)"
          className="cursor-pointer p-3.5 rounded-full bg-[#212124] border-2 border-[#ffd700]/40 text-[#ffd700] hover:bg-[rgba(255,215,0,0.15)] hover:border-[#ffd700] active:scale-95 transition disabled:opacity-30 disabled:pointer-events-none shadow-lg"
        >
          <Star className="w-5 h-5 fill-current" />
        </button>

        {/* Like (Pitch) Button */}
        {(() => {
          const isGreedy = Boolean(currentCard && /greedy\s*banker/i.test(currentCard.name));
          return (
            <button
              type="button"
              onClick={() => triggerSwipe('right')}
              disabled={!currentCard}
              title={isGreedy ? 'Commit High Treason: £5 Traitor Tax' : 'Pitch to Squad & Vote Keen (Right Arrow / L)'}
              className={`cursor-pointer p-4 rounded-full font-bold active:scale-95 transition disabled:opacity-30 disabled:pointer-events-none shadow-xl ${
                isGreedy
                  ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/40 animate-pulse'
                  : 'bg-[#ff6b57] text-[#1a0703] hover:brightness-110 shadow-[#ff6b57]/20'
              }`}
            >
              {isGreedy ? <span className="text-xl">🐍</span> : <ThumbsUp className="w-6 h-6 fill-current" />}
            </button>
          );
        })()}
      </div>

      {/* Keyboard Helper Hint */}
      <div className="text-[10px] text-[#8d8d94] mt-2 text-center shrink-0 hidden sm:block">
        Keys: <span className="text-[#cfcfd4]">← Left (Pass)</span> •{' '}
        <span className="text-[#cfcfd4]">→ Right (Pitch)</span> •{' '}
        <span className="text-[#cfcfd4]">↑ Up (Superlike)</span> •{' '}
        <span className="text-[#cfcfd4]">B (Ban)</span> •{' '}
        <span className="text-[#cfcfd4]">Z (Undo)</span>
      </div>
    </div>
  );
};
