'use client';

import { useEffect, useRef } from 'react';
import { useGuideStore } from '@/lib/store';
import { isWithinRadius, getDistanceMeters } from '@/lib/geofence';
import { getAudio } from '@/lib/audioElement';

export default function AudioEngine() {
  const {
    attraction, status, aBlockIndex, triggeredPinId,
    setUserPosition, setPlayerControls,
    setIsPlaying, setProgress, setDuration,
    onABlockEnd, onBBlockEnd, triggerPin, triggerPinImmediate,
  } = useGuideStore();

  const rafRef = useRef<number>(0);

  // ─── GPS watch ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy, heading } = pos.coords;
        setUserPosition({ lat, lng, accuracy, heading });

        const { status: s, attraction: a, autoPlayEnabled, isPlaying, visitedPinIds } = useGuideStore.getState();
        if (!a) return;
        if (s === 'B_PLAYING') return;

        // Find closest pin within its radius (not yet visited, has audio)
        const closest = a.pins
          .filter((p) => p.bBlock && p.radius > 0 && !visitedPinIds.includes(p.id))
          .map((p) => ({ pin: p, dist: getDistanceMeters(lat, lng, p.lat, p.lng) }))
          .filter(({ pin, dist }) => dist <= pin.radius)
          .sort((a, b) => a.dist - b.dist)[0];

        if (!closest) return;

        if (autoPlayEnabled && s === 'A_PLAYING' && !isPlaying) {
          // Paused + autoPlay ON → immediately jump to B-guide
          triggerPinImmediate(closest.pin.id);
        } else {
          triggerPin(closest.pin.id);
        }
      },
      (err) => console.warn('GPS error:', err.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [setUserPosition, triggerPin]);

  // ─── Audio playback ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!attraction) return;

    cancelAnimationFrame(rafRef.current);
    const audio = getAudio();
    // Do NOT call audio.pause() here — it cancels the iOS unlock initiated in handleStart.
    // Setting audio.src below automatically resets playback without revoking the unlock.

    let src: string | null = null;
    let onEnd: () => void = () => {};

    if (status === 'A_PLAYING') {
      src = attraction.aBlocks[aBlockIndex]?.src ?? null;
      onEnd = onABlockEnd;
    } else if (status === 'B_PLAYING') {
      const pin = attraction.pins.find((p) => p.id === triggeredPinId);
      src = pin?.bBlock?.src ?? null;
      onEnd = onBBlockEnd;
    }

    if (!src) {
      setIsPlaying(false);
      setProgress(0);
      setDuration(0);
      return;
    }

    audio.src = src;
    audio.currentTime = 0;

    audio.onplay = () => {
      setIsPlaying(true);
      // 500ms interval instead of RAF — prevents 60fps re-renders that block iOS taps
      rafRef.current = window.setInterval(() => {
        if (audio.duration > 0) setProgress(audio.currentTime / audio.duration);
      }, 500) as unknown as number;
    };

    audio.onloadedmetadata = () => setDuration(audio.duration);

    audio.onpause = () => {
      setIsPlaying(false);
      clearInterval(rafRef.current);
    };

    audio.onended = () => {
      setIsPlaying(false);
      setProgress(0);
      cancelAnimationFrame(rafRef.current);
      onEnd();
    };

    // Register player controls
    setPlayerControls(
      (ratio) => { audio.currentTime = audio.duration * ratio; },
      () => { audio.paused ? audio.play().catch(console.warn) : audio.pause(); },
    );

    audio.play().catch(console.warn);

    return () => {
      clearInterval(rafRef.current);
      audio.pause();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, aBlockIndex, triggeredPinId, attraction]);

  return null;
}
