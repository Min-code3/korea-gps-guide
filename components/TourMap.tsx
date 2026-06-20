'use client';

import React, { useEffect, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import { Attraction, RestaurantPin } from '@/lib/types';
import { t, type Lang } from '@/lib/i18n';

interface TourMapProps {
  attractions: Attraction[];
  center: { lat: number; lng: number };
  defaultZoom: number;
  selectedId: string | null;
  selectedIds?: string[]; // 좌표 공유 멀티 하이라이트
  sectorIds?: string[];
  isSectorMode?: boolean;
  onPinClick: (attractionId: string, lat?: number, lng?: number) => void;
  restaurantPins?: RestaurantPin[];
  selectedRestaurantId?: string | null;
  onRestaurantPinClick?: (contentid: string) => void;
  lang?: string;
  showOrder?: boolean;
}

const MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#f5f0e8' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9e8f5' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#d4e9c7' }] },
];

const CIRCLE = 0 as unknown as google.maps.SymbolPath;

export default function TourMap({ attractions, center, defaultZoom, selectedId, selectedIds, sectorIds = [], isSectorMode = false, onPinClick, restaurantPins = [], selectedRestaurantId = null, onRestaurantPinClick, lang = 'ko', showOrder = false }: TourMapProps) {
  const l = lang as Lang;
  const mapRef = useRef<google.maps.Map | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
  });

  // Pan to selected attraction
  useEffect(() => {
    if (!mapRef.current || !selectedId) return;
    const attraction = attractions.find((a) => a.id === selectedId);
    if (attraction) {
      mapRef.current.panTo(attraction.center);
    }
  }, [selectedId, attractions]);

  if (loadError) {
    return <div className="w-full h-full bg-stone-100 flex items-center justify-center text-stone-400 text-sm p-4 text-center">{t(l, 'map.loadError')}{loadError.message}</div>;
  }

  if (!isLoaded) {
    return <div className="w-full h-full bg-stone-100 flex items-center justify-center text-stone-400 text-sm">Loading map...</div>;
  }

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%' }}
      center={center}
      zoom={defaultZoom}
      options={{
        styles: MAP_STYLES,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'cooperative',
      }}
      onLoad={(map) => { mapRef.current = map; }}
    >
      {restaurantPins.map((r) => {
        const isSelected = r.contentid === selectedRestaurantId;
        return (
          <Marker
            key={`restaurant-${r.contentid}`}
            position={{ lat: r.lat, lng: r.lng }}
            icon={{
              path: CIRCLE,
              scale: isSelected ? 10 : 7,
              fillColor: isSelected ? '#f97316' : '#16a34a',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            }}
            title={r.title}
            onClick={() => onRestaurantPinClick?.(r.contentid)}
          />
        );
      })}
      {(() => {
        const activeIds = selectedIds ?? (selectedId ? [selectedId] : []);

        // showOrder 모드: routePins를 좌표 기준으로 중복 제거 후 한 번만 렌더링
        // (스카이캡슐·해상열차처럼 같은 좌표를 쓰는 명소가 핀을 공유)
        if (showOrder) {
          const pinMap: Record<string, { lat: number; lng: number; order: string; ids: string[] }> = {};
          for (const a of attractions) {
            for (const p of a.routePins ?? []) {
              const key = `${p.lat},${p.lng}`;
              if (!pinMap[key]) pinMap[key] = { lat: p.lat, lng: p.lng, order: p.order, ids: [] };
              if (!pinMap[key].ids.includes(a.id)) pinMap[key].ids.push(a.id);
            }
          }

          const routePinMarkers = Object.entries(pinMap).map(([key, pin]) => {
            const isOrange = pin.ids.some(id =>
              (!isSectorMode && activeIds.includes(id)) || (isSectorMode && sectorIds.includes(id))
            );
            const isSelected = pin.ids.some(id => activeIds.includes(id));
            return (
              <Marker
                key={`rp-${key}`}
                position={{ lat: pin.lat, lng: pin.lng }}
                icon={{
                  path: CIRCLE,
                  scale: isSelected ? 13 : 11,
                  fillColor: isOrange ? '#f97316' : '#1d4ed8',
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 2,
                }}
                label={{ text: pin.order, color: '#ffffff', fontSize: '11px', fontWeight: 'bold' }}
                onClick={() => onPinClick(pin.ids[0], pin.lat, pin.lng)}
              />
            );
          });

          // routePins 없는 일반 명소는 center 마커로 렌더링
          const centerMarkers = attractions
            .filter(a => !a.routePins || a.routePins.length === 0)
            .map(a => {
              const isSingle = !isSectorMode && activeIds.includes(a.id);
              const isInSector = isSectorMode && sectorIds.includes(a.id);
              const isOrange = isSingle || isInSector;
              const hasOrder = !!a.attractionOrder;
              return (
                <Marker
                  key={a.id}
                  position={a.center}
                  icon={{
                    path: CIRCLE,
                    scale: isSingle ? 13 : hasOrder ? 11 : 8,
                    fillColor: isOrange ? '#f97316' : '#1d4ed8',
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 2,
                  }}
                  label={hasOrder ? { text: a.attractionOrder!, color: '#ffffff', fontSize: '11px', fontWeight: 'bold' } : undefined}
                  onClick={() => onPinClick(a.id, a.center.lat, a.center.lng)}
                />
              );
            });

          return [...routePinMarkers, ...centerMarkers];
        }

        // showOrder 아닌 경우 — 기존 center(+center2) 마커
        return attractions.map((attraction) => {
          const isSingle = !isSectorMode && activeIds.includes(attraction.id);
          const isInSector = isSectorMode && sectorIds.includes(attraction.id);
          const isOrange = isSingle || isInSector;
          return (
            <React.Fragment key={attraction.id}>
              <Marker
                position={attraction.center}
                icon={{
                  path: CIRCLE,
                  scale: isSingle ? 13 : 8,
                  fillColor: isOrange ? '#f97316' : '#1d4ed8',
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 2,
                }}
                onClick={() => onPinClick(attraction.id, attraction.center.lat, attraction.center.lng)}
              />
              {attraction.center2 && (
                <Marker
                  position={attraction.center2}
                  icon={{
                    path: CIRCLE,
                    scale: isSingle ? 13 : 8,
                    fillColor: isOrange ? '#f97316' : '#1d4ed8',
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 2,
                  }}
                  onClick={() => onPinClick(attraction.id, attraction.center2!.lat, attraction.center2!.lng)}
                />
              )}
            </React.Fragment>
          );
        });
      })()}
    </GoogleMap>
  );
}
