"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

export default function BackgroundVideo({ videoIds }: { videoIds: string[] }) {
  const [mounted, setMounted] = useState(false);
  const [currentId, setCurrentId] = useState(() => videoIds[Math.floor(Math.random() * videoIds.length)]);

  useEffect(() => setMounted(true), []);

  const shuffle = useCallback(() => {
    if (videoIds.length <= 1) return;
    setCurrentId((prev) => {
      const pool = videoIds.filter((id) => id !== prev);
      return pool[Math.floor(Math.random() * pool.length)];
    });
  }, [videoIds]);

  if (!mounted || !currentId) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: -1 }}>
      <iframe
        key={currentId}
        src={`https://www.youtube.com/embed/${currentId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${currentId}&modestbranding=1&rel=0&disablekb=1&fs=0&iv_load_policy=3`}
        className="absolute left-1/2 top-1/4 h-[56.25vw] min-h-full w-full min-w-[177.78vh] -translate-x-1/2 -translate-y-1/2"
        style={{ opacity: 0.26 }}
        allow="autoplay; encrypted-media"
        frameBorder="0"
      />
      {videoIds.length > 1 && (
        <button
          onClick={shuffle}
          className="pointer-events-auto absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1.5 text-[11px] font-medium text-white/70 backdrop-blur-sm transition-all hover:bg-black/50 hover:text-white"
        >
          <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 4h3l2 8h6" /><path d="M7 4h7m0 0-2-2m2 2-2 2" /><path d="M4 12h5m3 0 2-2m-2 2 2 2" />
          </svg>
          別の動画
        </button>
      )}
    </div>,
    document.body
  );
}
