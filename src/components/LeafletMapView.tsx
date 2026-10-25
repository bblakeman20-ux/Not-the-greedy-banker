import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import { ExternalLink, MapPin, Navigation, Star, Compass, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import { safeUrl } from '../utils/storage';

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
  distMiles?: number;
  url?: string;
}

interface LeafletMapViewProps {
  items: MapItem[];
  center?: { lat: number; lon: number; name?: string } | null;
  onPitchItem?: (item: MapItem) => void;
  className?: string;
}

export const LeafletMapView: React.FC<LeafletMapViewProps> = ({
  items,
  center,
  onPitchItem,
  className = '',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [id: string]: L.Marker }>({});
  const [activeId, setActiveId] = useState<string | null>(() => items[0]?.id || null);

  // Filter items with valid coordinates
  const validItems = useMemo(() => {
    return items.filter((it) => it.lat != null && it.lon != null && !isNaN(it.lat) && !isNaN(it.lon));
  }, [items]);

  const activeItem = useMemo(() => {
    return items.find((it) => it.id === activeId) || validItems[0] || items[0] || null;
  }, [items, activeId, validItems]);

  // Compute default center
  const defaultCenter = useMemo<[number, number]>(() => {
    if (center && center.lat && center.lon) return [center.lat, center.lon];
    if (validItems.length > 0 && validItems[0].lat != null && validItems[0].lon != null) {
      return [validItems[0].lat, validItems[0].lon];
    }
    return [51.3889, 0.5056]; // Rochester / Medway default UK coordinates
  }, [center, validItems]);

  // Create custom marker icon
  const createMarkerIcon = (item: MapItem, isSelected: boolean) => {
    const emoji = item.emoji || '📍';
    const bgClass = isSelected
      ? 'bg-[#ff6b57] text-[#1a0703] border-white scale-125 shadow-[0_0_16px_rgba(255,107,87,0.8)] z-[999]'
      : 'bg-[#17171a] text-[#f4f4f5] border-[#ff6b57]/60 hover:scale-110 shadow-md';

    const html = `
      <div class="relative flex items-center justify-center transition-transform duration-200 cursor-pointer">
        <div class="w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold ${bgClass}">
          ${emoji}
        </div>
        ${
          isSelected
            ? '<span class="absolute -bottom-1 w-2 h-2 rounded-full bg-[#ff6b57] animate-ping"></span>'
            : ''
        }
      </div>
    `;

    return L.divIcon({
      html,
      className: 'custom-leaflet-marker',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -18],
    });
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 14,
        zoomControl: false,
        attributionControl: true,
      });

      // Add OpenStreetMap raster tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      // Add zoom control in top right
      L.control.zoom({ position: 'topright' }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Clear old markers
    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    if (validItems.length > 0) {
      const bounds = L.latLngBounds([]);

      validItems.forEach((item) => {
        if (item.lat == null || item.lon == null) return;
        const latLng: [number, number] = [item.lat, item.lon];
        bounds.extend(latLng);

        const isSelected = item.id === activeId;
        const icon = createMarkerIcon(item, isSelected);

        const marker = L.marker(latLng, { icon }).addTo(map);

        // Marker click handler
        marker.on('click', () => {
          setActiveId(item.id);
          map.flyTo(latLng, 16, { duration: 0.6 });
        });

        markersRef.current[item.id] = marker;
      });

      // Fit bounds with padding if multiple items, or center on single item
      if (validItems.length > 1) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      } else if (validItems.length === 1 && validItems[0].lat && validItems[0].lon) {
        map.setView([validItems[0].lat, validItems[0].lon], 15);
      }
    } else {
      map.setView(defaultCenter, 14);
    }

    return () => {
      // Keep map alive across standard re-renders, destroy only when container unmounts
    };
  }, [validItems]);

  // Update marker icons when activeId changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    validItems.forEach((item) => {
      const marker = markersRef.current[item.id];
      if (marker) {
        const isSelected = item.id === activeId;
        marker.setIcon(createMarkerIcon(item, isSelected));
      }
    });

    // Fly to active item if valid
    if (activeItem && activeItem.lat != null && activeItem.lon != null) {
      map.flyTo([activeItem.lat, activeItem.lon], Math.max(map.getZoom(), 15), {
        duration: 0.6,
      });
    }
  }, [activeId]);

  // Reset/fit view to all venues
  const handleFitAll = () => {
    const map = mapInstanceRef.current;
    if (!map || validItems.length === 0) return;

    const bounds = L.latLngBounds(
      validItems.map((it) => [it.lat!, it.lon!] as [number, number])
    );
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  };

  const googleMapsUrl = activeItem
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${activeItem.name}, ${activeItem.loc}`
      )}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        center?.name || 'Local'
      )}`;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Map Bar Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
        <div className="flex items-center gap-1.5 font-bold text-[#f4f4f5]">
          <MapPin className="w-4 h-4 text-[#ff6b57]" />
          <span>Interactive Map ({validItems.length} verified venue pins)</span>
        </div>
        <div className="flex items-center gap-2">
          {validItems.length > 1 && (
            <button
              type="button"
              onClick={handleFitAll}
              className="cursor-pointer text-[11px] font-semibold text-[#cfcfd4] hover:text-[#ffffff] bg-[#212124] border border-[#2b2b2f] px-2.5 py-1 rounded-lg flex items-center gap-1 transition"
              title="Show all venue pins in view"
            >
              <Maximize2 className="w-3 h-3 text-[#c6ff3d]" />
              <span>Fit All Pins</span>
            </button>
          )}
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-[#ff6b57] hover:underline flex items-center gap-1 text-[11px]"
          >
            <span>Open in Google Maps</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Interactive Leaflet Map Container */}
      <div className="relative rounded-2xl overflow-hidden border border-[#2b2b2f] h-80 sm:h-96 w-full bg-[#17171a] shadow-inner">
        <div
          ref={mapContainerRef}
          className="w-full h-full z-0 leaflet-container-custom"
          style={{ minHeight: '100%' }}
        />

        {/* Floating Active Spot Details Badge */}
        {activeItem && (
          <div className="absolute bottom-3 left-3 right-3 sm:left-4 sm:right-auto sm:max-w-md bg-[#17171a]/95 backdrop-blur-md border border-[#2b2b2f] p-3.5 rounded-xl shadow-2xl z-[1000] space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-extrabold text-sm sm:text-base text-[#ffffff] flex items-center gap-1.5 truncate">
                  <span>{activeItem.emoji || '📍'}</span>
                  <span className="truncate">{activeItem.name}</span>
                </div>
                <div className="text-xs text-[#a1a1aa] truncate mt-0.5">
                  📍 {activeItem.loc}
                </div>
                {activeItem.desc && (
                  <p className="text-[11px] text-[#cfcfd4] line-clamp-1 mt-1 font-normal">
                    {activeItem.desc}
                  </p>
                )}
              </div>
              {onPitchItem && (
                <button
                  type="button"
                  onClick={() => onPitchItem(activeItem)}
                  className="cursor-pointer bg-[#ff6b57] text-[#1a0703] font-bold text-xs h-8 px-3 rounded-lg hover:brightness-105 active:scale-95 transition whitespace-nowrap shrink-0 shadow-md flex items-center gap-1"
                >
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <span>Pitch</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Horizontal Carousel of all Pinned Venues */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold text-[#8d8d94] px-1">
          Tap any venue below to fly map directly to its pin:
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {items.map((item) => {
            const isSelected = activeItem?.id === item.id;
            return (
              <div
                key={item.id}
                onClick={() => {
                  setActiveId(item.id);
                  const map = mapInstanceRef.current;
                  if (map && item.lat != null && item.lon != null) {
                    map.flyTo([item.lat, item.lon], 16, { duration: 0.6 });
                  }
                }}
                className={`min-w-[210px] max-w-[230px] p-3 rounded-xl border transition cursor-pointer flex flex-col justify-between gap-2 shrink-0 ${
                  isSelected
                    ? 'border-[#ff6b57] bg-[#212124] shadow-[0_0_14px_rgba(255,107,87,0.25)] ring-1 ring-[#ff6b57]/50'
                    : 'border-[#2b2b2f] bg-[#17171a] hover:border-[#3b3b40]'
                }`}
              >
                <div>
                  <div className="font-bold text-xs text-[#ffffff] flex items-center gap-1.5 truncate">
                    <span>{item.emoji || '📍'}</span>
                    <span className="truncate">{item.name}</span>
                  </div>
                  <div className="text-[11px] text-[#a1a1aa] truncate mt-0.5">
                    📍 {item.loc}
                  </div>
                  {item.distMiles != null && (
                    <div className="text-[10px] font-medium text-[#c6ff3d] mt-1">
                      🚗 {item.distMiles.toFixed(1)} miles away
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#2b2b2f]/60">
                  <span className="text-[10px] text-[#8d8d94] truncate">
                    {item.category || 'Venue'}
                  </span>
                  {onPitchItem && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPitchItem(item);
                      }}
                      className="cursor-pointer bg-[#ff6b57] text-[#1a0703] font-bold text-[11px] px-2.5 py-1 rounded-md hover:brightness-105 active:scale-95 transition whitespace-nowrap"
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
