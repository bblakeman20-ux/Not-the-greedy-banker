import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BanItem, OutingEvent, User, Venue, VenueStop } from '../types';
import { fetchPlaces, makeIdeas, PlacesPool, CATS, miles, placeName } from '../utils/osm';
import { isBanned, normName, safeUrl } from '../utils/storage';
import { LeafletMapView } from './LeafletMapView';
import { FlickeringFlameLoader } from './FlickeringFlameLoader';
import {
  Search,
  MapPin,
  Flame,
  Map as MapIcon,
  List,
  ThumbsUp,
  ThumbsDown,
  Ban,
  ExternalLink,
  RotateCw,
  Sparkles,
  Check,
  Compass,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface VenueExplorerProps {
  event: OutingEvent;
  squad: User[];
  currentUser: User | null;
  banList: BanItem[];
  defaultArea: string;
  defaultVibe: string;
  onAddVenue: (venue: Partial<Venue>) => void;
  onAddBan: (name: string) => void;
  onShowToast: (msg: string) => void;
  onOpenPintdr?: () => void;
}

export interface DiscoveredCard {
  id: string;
  name: string;
  loc: string;
  desc: string;
  kind?: 'spot' | 'combo';
  steps?: string[];
  stops?: VenueStop[];
  url?: string;
  category?: string;
  emoji?: string;
  lat?: number;
  lon?: number;
  distMiles?: number;
}

const CATEGORY_CHIPS = [
  { label: 'All', vibe: '' },
  { label: 'Wine & Vineyard', vibe: 'wine bar vineyard tasting cellar bistro' },
  { label: 'Axe & Darts', vibe: 'axe throwing darts competitive' },
  { label: 'Craft Beer', vibe: 'craft beer taproom brewery microbrewery' },
  { label: 'Curry & Spice', vibe: 'curry indian grill smokehouse' },
  { label: 'Arcade & Games', vibe: 'arcade retro gaming pinball bowling' },
  { label: 'Burgers & BBQ', vibe: 'burger bbq wings steak ribs' },
  { label: 'Escape Rooms', vibe: 'escape room puzzle challenge' },
  { label: 'Cocktails & Bars', vibe: 'cocktail bar speakeasy gin lounge' },
  { label: 'Live Music', vibe: 'live music gig comedy club band' },
  { label: 'Pizza & Italian', vibe: 'pizza sourdough italian neapolitan' },
  { label: 'Asian & Street Food', vibe: 'asian ramen korean bao street food thai' },
];

export const VenueExplorer: React.FC<VenueExplorerProps> = ({
  event,
  squad,
  currentUser,
  banList,
  defaultArea,
  defaultVibe,
  onAddVenue,
  onAddBan,
  onShowToast,
  onOpenPintdr,
}) => {
  const [areaInput, setAreaInput] = useState(defaultArea || 'Rochester');
  const [queryInput, setQueryInput] = useState(defaultVibe || '');
  const [selectedChip, setSelectedChip] = useState('All');
  const [viewMode, setViewMode] = useState<'swipe' | 'grid' | 'map'>('swipe');

  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [pool, setPool] = useState<PlacesPool | null>(null);
  const [cards, setCards] = useState<DiscoveredCard[]>([]);
  const [cardIndex, setCardIndex] = useState(0);

  // Drag state for Tinder card swipe
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  // Map center coordinates
  const mapCenter = pool?.cs?.[0] || null;

  // Perform search with fetchPlaces
  const executeSearch = async (areaToSearch: string, vibeToSearch: string) => {
    const cleanArea = areaToSearch.trim();
    if (!cleanArea) {
      onShowToast('📍 Enter a town or area to search (e.g. Rochester, Soho)');
      return;
    }

    setLoading(true);
    setProgressMsg(`🗺️ Exploring places in ${cleanArea}...`);
    try {
      const placesPool = await fetchPlaces(cleanArea, vibeToSearch, banList, (msg) => {
        setProgressMsg(msg);
      });
      setPool(placesPool);

      const center = placesPool.cs[0];

      // Strictly parse standalone real venues with accurate street-level locations
      const standaloneCards: DiscoveredCard[] = placesPool.places
        .filter((p) => p.name && !isBanned(p.name, banList))
        .map((p) => {
          const dist = center ? miles(center, p) : undefined;
          const street = p.t['addr:street'];
          const house = p.t['addr:housenumber'] || p.t['addr:housename'];
          const postcode = p.t['addr:postcode'];
          const town = p.t['addr:town'] || p.t['addr:city'] || p.t['addr:suburb'] || cleanArea;
          const streetPart = house && street ? `${house} ${street}` : (street || '');
          const fullLoc = [streetPart, town, postcode].filter(Boolean).join(', ') || cleanArea;

          const details = [
            p.c.l,
            p.t.brewery ? `Brewery: ${p.t.brewery}` : '',
            p.t.cuisine ? `Cuisine: ${p.t.cuisine.replace(/;/g, ', ')}` : '',
            p.t.outdoor_seating === 'yes' ? 'Beer garden' : '',
            dist != null ? `${dist.toFixed(1)} mi from ${cleanArea}` : '',
          ]
            .filter(Boolean)
            .join(' • ');

          return {
            id: p.id,
            name: p.name,
            loc: fullLoc,
            desc: `${p.c.e} ${details}`,
            kind: 'spot' as const,
            category: p.c.l,
            emoji: p.c.e,
            lat: p.lat,
            lon: p.lon,
            distMiles: dist,
            url: safeUrl(p.t.website || p.t['contact:website']),
          };
        });

      // Strictly standalone individual venues for map explorer
      setCards(standaloneCards);
      setCardIndex(0);
      setProgressMsg(`✨ Found ${standaloneCards.length} verified venues in ${cleanArea}!`);
    } catch (err: any) {
      setProgressMsg(`❌ ${err.message || "Couldn't reach map servers"}`);
      onShowToast(`Map lookup error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Synchronize inputs when parent updates location or vibe
  useEffect(() => {
    if (defaultArea && defaultArea !== areaInput) {
      setAreaInput(defaultArea);
    }
  }, [defaultArea]);

  useEffect(() => {
    if (defaultVibe !== undefined && defaultVibe !== queryInput) {
      setQueryInput(defaultVibe);
    }
  }, [defaultVibe]);

  // Initial load if area is provided and no cards yet
  useEffect(() => {
    if (cards.length === 0 && (defaultArea || areaInput)) {
      executeSearch(areaInput || defaultArea, queryInput);
    }
  }, []);

  const currentCard = cards[cardIndex] || null;

  // Swipe Action Handlers
  const handlePitchCard = (card: DiscoveredCard) => {
    if (!currentUser) {
      onShowToast('👆 Tap your profile in the top bar before pitching!');
      return;
    }

    const newVenue: Partial<Venue> = {
      name: card.name,
      loc: card.loc,
      desc: card.desc,
      kind: card.kind || 'spot',
      steps: card.steps,
      stops: card.stops,
      lat: card.lat,
      lon: card.lon,
      url: card.url,
      src: 'osm',
      votes: { [currentUser.id]: 'k' },
    };

    onAddVenue(newVenue);
    onShowToast(`🎉 Pitched "${card.name}" to the squad list!`);
    confetti({ particleCount: 45, spread: 60, origin: { y: 0.6 } });
    nextCard();
  };

  const handlePassCard = (card: DiscoveredCard) => {
    onShowToast(`Skipped "${card.name}"`);
    nextCard();
  };

  const handleBanCard = (card: DiscoveredCard) => {
    onAddBan(card.name);
    onShowToast(`🚫 "${card.name}" added to the Ban List!`);
    nextCard();
  };

  const nextCard = () => {
    setDragOffset({ x: 0, y: 0 });
    setCardIndex((prev) => prev + 1);
  };

  // Touch and Mouse Drag Gestures for Tinder swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!currentCard) return;
    const touch = e.touches[0];
    setDragStart({ x: touch.clientX, y: touch.clientY });
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    setDragOffset({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    if (!isDragging || !currentCard) return;
    setIsDragging(false);
    if (dragOffset.x > 90) {
      handlePitchCard(currentCard);
    } else if (dragOffset.x < -90) {
      handlePassCard(currentCard);
    } else {
      setDragOffset({ x: 0, y: 0 });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!currentCard) return;
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
    if (dragOffset.x > 90) {
      handlePitchCard(currentCard);
    } else if (dragOffset.x < -90) {
      handlePassCard(currentCard);
    } else {
      setDragOffset({ x: 0, y: 0 });
    }
  };

  // Card rotation calculation
  const cardRotation = dragOffset.x / 14;
  const likeOpacity = Math.min(1, Math.max(0, dragOffset.x / 75));
  const passOpacity = Math.min(1, Math.max(0, -dragOffset.x / 75));

  const handleSelectChip = (chip: (typeof CATEGORY_CHIPS)[0]) => {
    setSelectedChip(chip.label);
    const combinedQuery = [queryInput.trim(), chip.vibe].filter(Boolean).join(' ');
    executeSearch(areaInput, combinedQuery);
  };

  const handleManualSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(areaInput, queryInput);
  };

  return (
    <div className="bg-[#17171a] border border-[#2b2b2f] rounded-2xl p-4 my-3 text-left">
      {/* Header with Title & Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-1.5 font-display font-extrabold text-sm text-[#f4f4f5]">
            <Compass className="w-4 h-4 text-[#ff6b57]" />
            <span>Map Venue Discovery & Swiper</span>
          </div>
          <div className="text-[11px] text-[#8d8d94]">
            Search real pubs, activities & combos directly from OpenStreetMap
          </div>
        </div>

        {/* View Mode Buttons & PINTDR Launcher */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {onOpenPintdr && (
            <button
              type="button"
              onClick={onOpenPintdr}
              className="px-2.5 py-1.5 rounded-xl font-bold flex items-center gap-1 cursor-pointer bg-gradient-to-r from-[#ff6b57] to-[#ff8f7d] text-[#1a0703] hover:brightness-110 active:scale-95 transition text-xs shadow-md shadow-[#ff6b57]/20"
            >
              <Flame className="w-3.5 h-3.5 fill-current" />
              <span>PINTDR™ Swiper</span>
            </button>
          )}

          <div className="flex items-center bg-[#212124] border border-[#2b2b2f] p-0.5 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setViewMode('swipe')}
              className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 cursor-pointer transition ${
                viewMode === 'swipe'
                  ? 'bg-[#ff6b57] text-[#1a0703] shadow'
                  : 'text-[#8d8d94] hover:text-[#f4f4f5]'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 cursor-pointer transition ${
                viewMode === 'grid'
                  ? 'bg-[#ff6b57] text-[#1a0703] shadow'
                  : 'text-[#8d8d94] hover:text-[#f4f4f5]'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List ({cards.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 cursor-pointer transition ${
                viewMode === 'map'
                  ? 'bg-[#ff6b57] text-[#1a0703] shadow'
                  : 'text-[#8d8d94] hover:text-[#f4f4f5]'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>Map</span>
            </button>
          </div>
        </div>
      </div>

      {/* Manual Search Form */}
      <form onSubmit={handleManualSearchSubmit} className="space-y-2 mb-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Area Input */}
          <div className="relative">
            <MapPin className="w-3.5 h-3.5 text-[#ff6b57] absolute left-3 top-3 pointer-events-none" />
            <input
              value={areaInput}
              onChange={(e) => setAreaInput(e.target.value)}
              placeholder="Area or town (e.g. Rochester, Soho)"
              className="w-full bg-[#212124] border border-transparent focus:border-[#ff6b57] text-[#f4f4f5] pl-8 pr-3 py-2 rounded-xl text-xs outline-none transition"
            />
          </div>

          {/* Keyword / Vibe Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#8d8d94] absolute left-3 top-3 pointer-events-none" />
            <input
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="Search activity, food or pub (e.g. Axe, Curry, Taproom)"
              className="w-full bg-[#212124] border border-transparent focus:border-[#ff6b57] text-[#f4f4f5] pl-8 pr-3 py-2 rounded-xl text-xs outline-none transition"
            />
          </div>
        </div>

        {/* Quick Category Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
          {CATEGORY_CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => handleSelectChip(chip)}
              className={`shrink-0 px-2.5 py-1 rounded-lg border transition cursor-pointer flex items-center gap-1 ${
                selectedChip === chip.label
                  ? 'border-[#ff6b57] bg-[rgba(255,107,87,0.15)] text-[#f4f4f5] font-semibold'
                  : 'border-[#2b2b2f] bg-[#212124] text-[#8d8d94] hover:text-[#f4f4f5]'
              }`}
            >
              <span>{chip.label}</span>
            </button>
          ))}
        </div>

        {/* Search Submit Button */}
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 cursor-pointer bg-[#ff6b57] hover:brightness-105 active:scale-98 text-[#1a0703] font-bold text-xs py-2 px-4 rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {loading ? (
              <>
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                <span>Searching OpenStreetMap...</span>
              </>
            ) : (
              <>
                <Search className="w-3.5 h-3.5" />
                <span>Find Places in {areaInput || 'Area'}</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Progress Feedback */}
      {progressMsg && (
        <div className="text-[11px] text-[#cfcfd4] mb-3 bg-[#212124] px-3 py-1.5 rounded-lg border border-[#2b2b2f] flex items-center justify-between">
          <span>{progressMsg}</span>
          {cards.length > 0 && (
            <span className="text-[#8d8d94] font-mono">
              Card {Math.min(cardIndex + 1, cards.length)}/{cards.length}
            </span>
          )}
        </div>
      )}

      {/* SWIPE DECK MODE */}
      {viewMode === 'swipe' && (
        <div className="mt-2">
          {currentCard ? (
            <div className="flex flex-col items-center">
              {/* Tinder Card Container */}
              <div
                className="relative w-full max-w-sm h-[320px] select-none touch-pan-y"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {/* Background Next Card Preview */}
                {cards[cardIndex + 1] && (
                  <div className="absolute inset-0 bg-[#212124] border border-[#2b2b2f] rounded-2xl p-4 scale-95 translate-y-3 opacity-60 pointer-events-none shadow-lg">
                    <div className="text-xs text-[#8d8d94]">Up Next:</div>
                    <div className="font-bold text-sm text-[#f4f4f5] truncate mt-1">
                      {cards[cardIndex + 1].name}
                    </div>
                  </div>
                )}

                {/* Active Swiping Card */}
                <div
                  ref={cardRef}
                  style={{
                    transform: `translate(${dragOffset.x}px, ${dragOffset.y}px) rotate(${cardRotation}deg)`,
                    transition: isDragging ? 'none' : 'transform 0.25s ease, opacity 0.25s ease',
                    cursor: isDragging ? 'grabbing' : 'grab',
                  }}
                  className="absolute inset-0 bg-gradient-to-b from-[#212124] to-[#1a1a1d] border-2 border-[#3b3b40] rounded-2xl p-5 shadow-2xl flex flex-col justify-between overflow-hidden"
                >
                  {/* Swipe Feedback Badges */}
                  <div
                    style={{ opacity: likeOpacity }}
                    className="absolute top-4 right-4 border-2 border-[#c6ff3d] text-[#c6ff3d] font-display font-black text-xs px-2.5 py-1 rounded-lg rotate-12 bg-black/40 backdrop-blur-sm pointer-events-none tracking-wider"
                  >
                    PITCH (KEEN)
                  </div>
                  <div
                    style={{ opacity: passOpacity }}
                    className="absolute top-4 left-4 border-2 border-[#ff6b57] text-[#ff6b57] font-display font-black text-xs px-2.5 py-1 rounded-lg -rotate-12 bg-black/40 backdrop-blur-sm pointer-events-none tracking-wider"
                  >
                    PASS
                  </div>

                  {/* Card Content Top */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#17171a] border border-[#2b2b2f] text-[#ff6b57] flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#ff6b57]" />
                        <span>{currentCard.category || 'Spot'}</span>
                      </span>
                      {currentCard.distMiles != null && (
                        <span className="text-[10px] font-mono text-[#8d8d94]">
                          {currentCard.distMiles.toFixed(1)} miles away
                        </span>
                      )}
                    </div>

                    <h3 className="font-display font-black text-lg text-[#f4f4f5] leading-snug line-clamp-2 mt-1">
                      {currentCard.name}
                    </h3>
                    <div className="text-xs text-[#8d8d94] mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#ff6b57] shrink-0" />
                      <span className="truncate">{currentCard.loc}</span>
                    </div>

                    <p className="text-xs text-[#cfcfd4] mt-2 line-clamp-3 leading-relaxed">
                      {currentCard.desc}
                    </p>

                    {/* Multi-step combo preview */}
                    {currentCard.steps && currentCard.steps.length > 0 && (
                      <div className="mt-2.5 bg-[#17171a] p-2.5 rounded-xl border border-[#2b2b2f]">
                        <span className="text-[10px] font-bold text-[#c6ff3d] block mb-1">
                          COMBO ROUTE:
                        </span>
                        <ul className="text-[11px] text-[#cfcfd4] space-y-1">
                          {currentCard.steps.slice(0, 3).map((s, idx) => (
                            <li key={idx} className="truncate">
                              • {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Card Bottom Meta */}
                  <div className="pt-2 border-t border-[#2b2b2f] flex items-center justify-between text-[11px]">
                    {currentCard.url ? (
                      <a
                        href={currentCard.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#c6ff3d] hover:underline flex items-center gap-1 cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Website</span>
                      </a>
                    ) : (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          `${currentCard.name}, ${currentCard.loc}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#8d8d94] hover:text-[#f4f4f5] flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MapIcon className="w-3 h-3" />
                        <span>Google Maps</span>
                      </a>
                    )}
                    <span className="text-[#8d8d94] text-[10px]">
                      Swipe Right to Pitch
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons for Mobile/Click */}
              <div className="flex items-center justify-center gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => handleBanCard(currentCard)}
                  title="Ban this venue permanently"
                  className="cursor-pointer p-3 rounded-full bg-[#212124] border border-[#2b2b2f] text-[#8d8d94] hover:text-[#ff6b57] hover:border-[#ff6b57] transition active:scale-95 shadow"
                >
                  <Ban className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handlePassCard(currentCard)}
                  title="Pass to next idea"
                  className="cursor-pointer p-3.5 rounded-full bg-[#212124] border border-[#2b2b2f] text-[#cfcfd4] hover:text-[#ff6b57] hover:border-[#ff6b57] transition active:scale-95 shadow"
                >
                  <ThumbsDown className="w-5 h-5 text-[#ff6b57]" />
                </button>
                <button
                  type="button"
                  onClick={() => handlePitchCard(currentCard)}
                  title="Pitch to squad & add to list"
                  className="cursor-pointer p-3.5 rounded-full bg-[#ff6b57] hover:brightness-110 text-[#1a0703] font-bold transition active:scale-95 shadow-xl flex items-center justify-center"
                >
                  <ThumbsUp className="w-5 h-5" />
                </button>
              </div>
            </div>
          ) : loading ? (
            <div className="text-center py-8 px-4 bg-[#212124] rounded-2xl border border-[#2b2b2f]">
              <FlickeringFlameLoader
                statusText={`🗺️ Searching "${queryInput || 'venues'}" in ${areaInput}...`}
                subText="Filtering real OpenStreetMap pins matching your vibe"
                size="sm"
              />
            </div>
          ) : (
            /* Empty Deck State */
            <div className="text-center py-8 px-4 bg-[#212124] rounded-2xl border border-[#2b2b2f]">
              <Sparkles className="w-6 h-6 text-[#ff6b57] mx-auto mb-1.5" />
              <h4 className="font-bold text-sm text-[#f4f4f5]">
                You've swiped all nearby ideas!
              </h4>
              <p className="text-xs text-[#8d8d94] mt-1 mb-4 max-w-xs mx-auto">
                Search a neighbouring town or tap below to shuffle fresh ideas from the map.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setCardIndex(0)}
                  className="cursor-pointer text-xs font-semibold px-3 py-2 rounded-xl bg-[#ff6b57] text-[#1a0703] hover:brightness-105 transition flex items-center gap-1.5"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Re-swipe Deck</span>
                </button>
                <button
                  type="button"
                  onClick={() => executeSearch(areaInput, queryInput)}
                  className="cursor-pointer text-xs font-semibold px-3 py-2 rounded-xl border border-[#2b2b2f] bg-[#17171a] text-[#f4f4f5] hover:border-[#3b3b40] transition flex items-center gap-1.5"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Roll Wider Map Search</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* GRID LIST MODE */}
      {viewMode === 'grid' && (
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {cards.map((card) => {
            const isAlreadyOnList = event.venues.some(
              (v) => normName(v.name) === normName(card.name)
            );

            return (
              <div
                key={card.id}
                className="bg-[#212124] border border-[#2b2b2f] rounded-xl p-3 flex items-start justify-between gap-2 hover:border-[#3b3b40] transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-[#f4f4f5] truncate">
                    <MapPin className="w-3.5 h-3.5 text-[#ff6b57] shrink-0" />
                    <span className="truncate">{card.name}</span>
                    {card.distMiles != null && (
                      <span className="text-[10px] font-normal text-[#8d8d94]">
                        • {card.distMiles.toFixed(1)} mi
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#8d8d94] truncate mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-[#a1a1aa] shrink-0" />
                    <span>{card.loc}</span>
                  </div>
                  <div className="text-[11px] text-[#cfcfd4] mt-1 line-clamp-2">
                    {card.desc}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={isAlreadyOnList}
                    onClick={() => handlePitchCard(card)}
                    className={`cursor-pointer px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                      isAlreadyOnList
                        ? 'bg-[#17171a] text-[#8d8d94] border border-[#2b2b2f] cursor-default'
                        : 'bg-[#ff6b57] text-[#1a0703] hover:brightness-105 active:scale-95'
                    }`}
                  >
                    <span>{isAlreadyOnList ? 'On List' : 'Pitch'}</span>
                  </button>
                  {card.url && (
                    <a
                      href={card.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-[#c6ff3d] hover:underline flex items-center gap-0.5"
                    >
                      <ExternalLink className="w-2.5 h-2.5" />
                      <span>Link</span>
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* INTERACTIVE LEAFLET MAP MODE */}
      {viewMode === 'map' && (
        <div className="pt-1">
          {cards.length > 0 ? (
            <LeafletMapView
              items={cards}
              center={mapCenter}
              onPitchItem={(item) => {
                const matchingCard = cards.find((c) => c.id === item.id);
                if (matchingCard) {
                  handlePitchCard(matchingCard);
                } else {
                  handlePitchCard({
                    id: item.id,
                    name: item.name,
                    loc: item.loc,
                    desc: item.desc || '',
                    kind: 'spot',
                    lat: item.lat,
                    lon: item.lon,
                    url: item.url,
                  });
                }
              }}
            />
          ) : (
            <div className="text-center py-8 text-xs text-[#8d8d94]">
              Search an area above to view pinned places on the interactive map.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
