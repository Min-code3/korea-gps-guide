'use client';

import { useState } from 'react';
import { useGuideStore } from '@/lib/store';
import { Attraction } from '@/lib/types';

interface PlayerBarProps {
  attraction: Attraction;
  onStart: () => void;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function PlayPauseButton() {
  const { isPlaying, togglePause } = useGuideStore();
  return (
    <button
      onClick={togglePause}
      className="w-14 h-14 rounded-full bg-amber-600 text-white flex items-center justify-center active:bg-amber-700 transition-colors"
      aria-label={isPlaying ? 'Pause' : 'Play'}
    >
      {isPlaying ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="4" width="4" height="16" rx="1" />
          <rect x="14" y="4" width="4" height="16" rx="1" />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5.14v14l11-7-11-7z" />
        </svg>
      )}
    </button>
  );
}

function PrevNextButtons() {
  const { prevBlock, nextBlock, aBlockIndex, attraction } = useGuideStore();
  if (!attraction) return null;
  const isFirst = aBlockIndex === 0;
  const isLast = aBlockIndex >= attraction.aBlocks.length - 1;

  return (
    <div className="flex items-center gap-6">
      <button onClick={prevBlock} disabled={isFirst}
        className="w-10 h-10 flex items-center justify-center text-stone-400 disabled:opacity-30"
        aria-label="Previous block">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
        </svg>
      </button>
      <PlayPauseButton />
      <button onClick={nextBlock} disabled={isLast}
        className="w-10 h-10 flex items-center justify-center text-stone-400 disabled:opacity-30"
        aria-label="Next block">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 18l8.5-6L6 6v12zm10-12v12h2V6h-2z" />
        </svg>
      </button>
    </div>
  );
}

// ── Playlist panel ─────────────────────────────────────────────────────────
function PlaylistPanel({ attraction, onClose }: { attraction: Attraction; onClose: () => void }) {
  const { aBlockIndex, status, visitedPinIds, triggerPinManual, goToABlock } = useGuideStore();

  const goToBlock = (idx: number) => {
    goToABlock(idx);
    onClose();
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-t-3xl px-5 pt-5 pb-10 max-h-[60vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-bold text-stone-800">Guide List</p>
          <button onClick={onClose} className="text-stone-400 text-xs">Close</button>
        </div>

        {/* A-guide blocks */}
        {attraction.aBlocks.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-stone-400 uppercase tracking-wide mb-2">Audio Segments</p>
            {attraction.aBlocks.map((block, idx) => (
              <button key={block.id} onClick={() => goToBlock(idx)}
                className={`w-full text-left px-3 py-2.5 rounded-xl mb-1 flex items-center gap-3 ${
                  idx === aBlockIndex && (status === 'A_PLAYING') ? 'bg-amber-50' : 'active:bg-stone-50'
                }`}>
                <span className={`text-xs w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                  idx === aBlockIndex && status === 'A_PLAYING'
                    ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-400'
                }`}>{idx + 1}</span>
                <span className="text-sm text-stone-700">{block.title ?? `Segment ${idx + 1}`}</span>
              </button>
            ))}
          </div>
        )}

        {/* Pins with audio */}
        {attraction.pins.filter(p => p.bBlock).length > 0 && (
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-wide mb-2">Spots</p>
            {attraction.pins.filter(p => p.bBlock).map((pin) => {
              const visited = visitedPinIds.includes(pin.id);
              return (
                <button key={pin.id}
                  onClick={() => { triggerPinManual(pin.id); onClose(); }}
                  className="w-full text-left px-3 py-2.5 rounded-xl mb-1 flex items-center gap-3 active:bg-stone-50">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${visited ? 'bg-stone-300' : 'bg-amber-500'}`} />
                  <span className={`text-sm ${visited ? 'text-stone-400' : 'text-stone-700'}`}>{pin.bBlock?.title ?? pin.name}</span>
                  {visited && <span className="text-xs text-stone-300 ml-auto">Visited</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PlayerBar({ attraction, onStart }: PlayerBarProps) {
  const { status, aBlockIndex, triggeredPinId, progress, duration, seekTo } = useGuideStore();
  const [showPlaylist, setShowPlaylist] = useState(false);

  const displayName = attraction.guideTitle ?? attraction.name;
  const triggeredPin = attraction.pins.find((p) => p.id === triggeredPinId);
  const elapsed = duration * progress;

  // ── IDLE ───────────────────────────────────────────────────────────────────
  if (status === 'IDLE') {
    return (
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-xl px-6 pt-5 pb-10">
        <p className="text-xs text-stone-400 uppercase tracking-widest mb-1">Audio Guide</p>
        <p className="text-lg font-bold text-stone-800 mb-1">{displayName}</p>
        <p className="text-sm text-stone-400">{attraction.description}</p>
        {(attraction.admission || attraction.hours) && (
          <div className="text-xs text-stone-400 mt-1 mb-6">
            {attraction.admission && <p className="whitespace-pre-line">🎫 {attraction.admission}</p>}
            {attraction.hours && <p className="whitespace-pre-line">⏰ {attraction.hours}</p>}
          </div>
        )}
        {!(attraction.admission || attraction.hours) && <div className="mb-6" />}
        <button onClick={onStart}
          className="w-full bg-amber-600 text-white rounded-2xl py-4 font-semibold text-base active:bg-amber-700 transition-colors">
          Start Audio Guide
        </button>
      </div>
    );
  }

  // ── GUIDE_ENDED ────────────────────────────────────────────────────────────
  if (status === 'GUIDE_ENDED') {
    const hasABlocks = attraction.aBlocks.length > 0;
    return (
      <>
        {showPlaylist && <PlaylistPanel attraction={attraction} onClose={() => setShowPlaylist(false)} />}
        <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-xl px-6 pt-5 pb-10">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-stone-400 uppercase tracking-widest">
              {hasABlocks ? 'Guide complete' : 'Explore'}
            </p>
            <button onClick={() => setShowPlaylist(true)} className="text-stone-400 p-1">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
              </svg>
            </button>
          </div>
          <p className="text-base font-bold text-stone-800 mb-1">{displayName}</p>
          <p className="text-sm text-stone-400 mb-4">Tap a pin on the map to hear its guide.</p>
          {hasABlocks && <div className="flex items-center justify-center"><PrevNextButtons /></div>}
        </div>
      </>
    );
  }

  // ── ACTIVE ─────────────────────────────────────────────────────────────────
  const currentTitle = status === 'B_PLAYING'
    ? (triggeredPin?.bBlock?.title ?? triggeredPin?.name ?? displayName)
    : (attraction.aBlocks[aBlockIndex]?.title ?? displayName);

  return (
    <>
      {showPlaylist && <PlaylistPanel attraction={attraction} onClose={() => setShowPlaylist(false)} />}
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-xl px-5 pt-4 pb-10">
        <div className="flex items-center justify-between mb-3">
          <div className="min-w-0 flex-1 pr-2">
            <p className="text-base font-bold text-stone-800 truncate">{currentTitle}</p>
          </div>
          <button onClick={() => setShowPlaylist(true)} className="text-stone-400 p-1 shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
            </svg>
          </button>
        </div>

        <div className="mb-2">
          <input type="range" min={0} max={1} step={0.001} value={progress}
            onChange={(e) => seekTo(parseFloat(e.target.value))}
            className="w-full h-1 accent-amber-600 cursor-pointer" />
          <div className="flex justify-between text-xs text-stone-400 mt-0.5">
            <span>{formatTime(elapsed)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center justify-center mb-4">
          {status === 'A_PLAYING' ? <PrevNextButtons /> : <PlayPauseButton />}
        </div>
      </div>
    </>
  );
}
