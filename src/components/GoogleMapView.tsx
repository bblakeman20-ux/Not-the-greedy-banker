import React, { useState, useMemo } from 'react';
import { ExternalLink, MapPin, Navigation, Star, Compass, Layers } from 'lucide-react';
import { VenueStop } from '../types';

export interface MapItem {
  id: string;
  name: string;
  loc: string;
  lat?: number;
  lon?: number;
  emoji?: string;
  category?: string;
  desc?: string;
  kind?: string;
  stops?: VenueStop[];
}

interface GoogleMapViewProps {
  items: MapItem[];
  center?: { lat: number; lon: number; name?: string } | null;
  onPitchItem?: (item: MapItem) => void;
  className?: string;
}

export const GoogleMapView: React.FC<GoogleMapViewProps> = ({
  items,
  center,
  onPitchItem,
  className = '',
}) => {
  const [activeItem, setActiveItem] = useState<MapItem | null>(() => items[0] || null);
  const [zoomLevel, setZoomLevel] = useState<number>(14);

  // Filter items that have coordinates or derive from center
  const validItems = useMemo(() => {
    return items.filter((it) => it.lat != null && it.lon != null);
  }, [items]);

  // Compute bounding box and center
  const computedCenter = useMemo(() => {
    if (center && center.lat && center.lon) return center;
    if (validItems.length > 0) {
      const avgLat = validItems.reduce((acc, it) => acc + (it.lat || 0), 0) / validItems.length;
      const avgLon = validItems.reduce((acc, it) => acc + (it.lon || 0), 0) / validItems.length;
      return { lat: avgLat, lon: avgLon, name: validItems[0].loc || 'Area' };
    }
    return { lat: 51.3889, lon: 0.5056, name: 'Medway' };
  }, [center, validItems]);

  const active = activeItem || validItems[0] || items[0] || null;

  // Direct Google Maps multi-point search / directions URL
  const googleMapsUrl = useMemo(() => {
    if (active) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${active.name}, ${active.loc}`
      )}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      computedCenter.name || 'Venues'
    )}`;
  }, [active, computedCenter]);

  // Multi-stop directions URL if combo route
  const comboDirectionsUrl = useMemo(() => {
    if (active?.stops && active.stops.length > 1) {
      const origin = encodeURIComponent(`${active.stops[0].name}, ${active.stops[0].loc}`);
      const destination = encodeURIComponent(
        `${active.stops[active.stops.length - 1].name}, ${active.stops[active.stops.length - 1].loc}`
      );
      const waypoints = active.stops
        .slice(1, -1)
        .map((s) => encodeURIComponent(`${s.name}, ${s.loc}`))
        .join('|');
      return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${
        waypoints ? `&waypoints=${waypoints}` : ''
      }&travelmode=walking`;
    }
    return null;
  }, [active]);

  // Google Maps dynamic embed query
  const embedQuery = useMemo(() => {
    if (active?.lat && active?.lon) {
      return `${active.lat},${active.lon}`;
    }
    if (active) {
      return encodeURIComponent(`${active.name}, ${active.loc}`);
    }
    return `${computedCenter.lat},${computedCenter.lon}`;
  }, [active, computedCenter]);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Map Canvas Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
        <div className="flex items-center gap-1.5 font-bold text-ink">
          <MapPin className="w-4 h-4 text-primary" />
          <span>Google Map Interactive View ({items.length} pinned places)</span>
        </div>
        <div className="flex items-center gap-2">
          {comboDirectionsUrl && (
            <a
              href={comboDirectionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-secondary hover:underline flex items-center gap-1 bg-secondary/10 border border-secondary/30 px-2 py-0.5 rounded-lg text-[11px]"
            >
              <Navigation className="w-3 h-3" />
              <span>Full Route on Google Maps</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-primary hover:underline flex items-center gap-1 text-[11px]"
          >
            <span>Open in Google Maps</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Main Interactive Map Container */}
      <div className="relative rounded-2xl overflow-hidden border border-line h-80 sm:h-96 w-full bg-card shadow-inner group">
        {/* Google Maps Embed iframe */}
        <iframe
          title="Google Maps Interactive Explorer"
          width="100%"
          height="100%"
          style={{ border: 0 }}
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          src={`https://maps.google.com/maps?q=${embedQuery}&t=&z=${zoomLevel}&ie=UTF8&iwloc=&output=embed`}
          className="w-full h-full filter contrast-105"
        />

        {/* Floating Quick Action Overlay with active spot details */}
        {active && (
          <div className="absolute bottom-3 left-3 right-3 sm:left-4 sm:right-auto sm:max-w-md bg-card/95 backdrop-blur-md border border-line p-3.5 rounded-xl shadow-2xl z-10 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-extrabold text-sm sm:text-base text-ink flex items-center gap-1.5 truncate">
                  <span>{active.emoji || '📍'}</span>
                  <span className="truncate">{active.name}</span>
                </div>
                <div className="text-xs text-muted truncate mt-0.5">
                  📍 {active.loc}
                </div>
              </div>
              {onPitchItem && (
                <button
                  type="button"
                  onClick={() => onPitchItem(active)}
                  className="cursor-pointer bg-primary text-primary-ink font-bold text-xs h-8 px-3 rounded-lg hover:brightness-105 active:scale-95 transition whitespace-nowrap shrink-0 shadow-md flex items-center gap-1"
                >
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <span>Pitch</span>
                </button>
              )}
            </div>

            {/* Individual combo stops breakdown if present */}
            {active.stops && active.stops.length > 0 && (
              <div className="space-y-1 pt-1.5 border-t border-line/60 max-h-32 overflow-y-auto pr-1">
                <div className="text-[11px] font-bold text-secondary flex items-center gap-1">
                  <span>🔀 Multi-Stop Route ({active.stops.length} stops):</span>
                </div>
                {active.stops.map((st, i) => (
                  <div
                    key={i}
                    className="flex items-start justify-between gap-1 text-[11px] text-ink2 bg-card2/80 px-2 py-1 rounded"
                  >
                    <span className="font-semibold truncate">
                      {i + 1}. {st.name}
                    </span>
                    <span className="text-muted text-[10px] shrink-0 truncate max-w-[120px]">
                      {st.loc}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Horizontal Carousel of all Pinned Venues for 1-Tap Center & Pitch */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold text-muted px-1">
          Select any spot below to highlight pin on the map:
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {items.map((item) => {
            const isSelected = active?.id === item.id;
            return (
              <div
                key={item.id}
                onClick={() => setActiveItem(item)}
                className={`min-w-[210px] max-w-[230px] p-3 rounded-xl border transition cursor-pointer flex flex-col justify-between gap-2 shrink-0 ${
                  isSelected
                    ? 'border-primary bg-card2 shadow-[0_0_14px_color-mix(in_oklab,var(--accent)_20%,transparent)] ring-1 ring-primary/40'
                    : 'border-line bg-card hover:border-line2'
                }`}
              >
                <div>
                  <div className="font-bold text-xs text-ink flex items-center gap-1.5 truncate">
                    <span>{item.emoji || '📍'}</span>
                    <span className="truncate">{item.name}</span>
                  </div>
                  <div className="text-[11px] text-muted truncate mt-0.5">
                    📍 {item.loc}
                  </div>
                  {item.stops && item.stops.length > 0 && (
                    <div className="text-[10px] font-semibold text-secondary mt-1">
                      🔀 {item.stops.length} stops included
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-line/60">
                  <span className="text-[10px] text-muted truncate">
                    {item.category || (item.kind === 'combo' ? 'Combo Route' : 'Spot')}
                  </span>
                  {onPitchItem && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPitchItem(item);
                      }}
                      className="cursor-pointer bg-primary text-primary-ink font-bold text-[11px] px-2.5 py-1 rounded-md hover:brightness-105 active:scale-95 transition whitespace-nowrap"
                    >
                      + Pitch
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
