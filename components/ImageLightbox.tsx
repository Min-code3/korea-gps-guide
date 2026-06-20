'use client';

import { useRef } from 'react';

interface Props {
  images: string[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onImageClick?: () => void;
  imageClickLabel?: string;
}

export default function ImageLightbox({ images, index, onClose, onPrev, onNext, onImageClick, imageClickLabel }: Props) {
  const valid = images.filter(Boolean);
  const safeIndex = valid.length > 0 ? Math.min(index, valid.length - 1) : 0;
  const touchStartX = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 50) {
      delta > 0 ? onNext() : onPrev();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 text-white/70 hover:text-white text-3xl leading-none z-10"
      >
        ×
      </button>

      <p className="absolute top-5 left-1/2 -translate-x-1/2 text-white/60 text-xs z-10">
        {safeIndex + 1} / {valid.length}
      </p>

      {valid.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-4xl px-2 py-4 z-10"
        >
          ‹
        </button>
      )}

      {valid[safeIndex] && (
        <div
          className="relative"
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={valid[safeIndex]}
            alt=""
            className={`max-h-[85vh] max-w-[90vw] object-contain rounded-lg ${onImageClick ? 'cursor-pointer' : ''}`}
            onClick={onImageClick}
          />
          {onImageClick && imageClickLabel && (
            <div
              className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-3 py-1 rounded-full pointer-events-none"
            >
              {imageClickLabel}
            </div>
          )}
        </div>
      )}

      {valid.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-4xl px-2 py-4 z-10"
        >
          ›
        </button>
      )}
    </div>
  );
}
