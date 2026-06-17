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
  sectorIds?: string[];
  isSectorMode?: boolean;
  onPinClick: (attractionId: string) => void;
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

export default function TourMap({ attractions, center, defaultZoom, selectedId, sectorIds = [], isSectorMode = false, onPinClick, restaurantPins = [], selectedRestaurantId = null, onRestaurantPinClick, lang = 'ko', showOrder = false }: TourMapProps) {
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
      {attractions.map((attraction) => {
        const isSingle = !isSectorMode && attraction.id === selectedId;
        const isInSector = isSectorMode && sectorIds.includes(attraction.id);
        const isOrange = isSingle || isInSector;
        const hasOrder = showOrder && !!attraction.attractionOrder;
        return (
          <React.Fragment key={attraction.id}>
            <Marker
              position={attraction.center}
              icon={{
                path: CIRCLE,
                scale: isSingle ? 11 : hasOrder ? 11 : 8,
                fillColor: isOrange ? '#f97316' : '#1d4ed8',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
              }}
              label={hasOrder ? {
                text: String(attraction.attractionOrder),
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 'bold',
              } : undefined}
              onClick={() => onPinClick(attraction.id)}
            />
            {attraction.center2 && (
              <Marker
                position={attraction.center2}
                icon={{
                  path: CIRCLE,
                  scale: isSingle ? 11 : 8,
                  fillColor: isOrange ? '#f97316' : '#1d4ed8',
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 2,
                }}
                onClick={() => onPinClick(attraction.id)}
              />
            )}
          </React.Fragment>
        );
      })}
    </GoogleMap>
  );
}
