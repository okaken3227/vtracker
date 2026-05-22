"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

export default function BackgroundVideo({ videoId }: { videoId: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: -1 }}>
      <iframe
        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${videoId}&modestbranding=1&rel=0&disablekb=1&fs=0&iv_load_policy=3`}
        className="absolute left-1/2 top-1/2 h-[56.25vw] min-h-full w-full min-w-[177.78vh] -translate-x-1/2 -translate-y-1/2"
        style={{ opacity: 0.09 }}
        allow="autoplay; encrypted-media"
        frameBorder="0"
      />
    </div>,
    document.body
  );
}
