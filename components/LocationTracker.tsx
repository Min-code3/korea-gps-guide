'use client';

import { useEffect, useRef } from 'react';
import { track } from '@/lib/posthog';
import { markInField } from '@/lib/analytics';

const INTERVAL_MS = 5 * 60 * 1000;

function getSessionId(): string {
  const key = 'gps_session_id';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = Math.random().toString(36).slice(2);
    sessionStorage.setItem(key, id);
  }
  return id;
}

function ping(sessionId: string) {
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      markInField();
      track('location_ping', {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        session_id: sessionId,
      });
    },
    () => {},
    { timeout: 5000, maximumAge: 60000 },
  );
}

export default function LocationTracker() {
  const sessionId = useRef('');

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    sessionId.current = getSessionId();
    ping(sessionId.current);
    const id = setInterval(() => ping(sessionId.current), INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return null;
}
