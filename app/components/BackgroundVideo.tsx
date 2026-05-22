"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

const STORAGE_KEY = "bgVideoEnabled";

export default function BackgroundVideo({ videoIds }: { videoIds: string[] }) {
  const [mounted, setMounted] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [currentId, setCurrentId] = useState(() =>
    videoIds[Math.floor(Math.random() * videoIds.length)]
  );

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === "false") setEnabled(false);
    setMounted(true);
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const shuffle = useCallback(() => {
    if (videoIds.length <= 1) return;
    setCurrentId((prev) => {
      const pool = videoIds.filter((id) => id !== prev);
      return pool[Math.floor(Math.random() * pool.length)];
    });
  }, [videoIds]);

  if (!mounted) return null;

  return (
    <>
      {/* 動画レイヤー */}
      {createPortal(
        <div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: -1 }}>
          {enabled && currentId && (
            <iframe
              key={currentId}
              src={`https://www.youtube.com/embed/${currentId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${currentId}&modestbranding=1&rel=0&disablekb=1&fs=0&iv_load_policy=3`}
              className="absolute left-1/2 top-1/2 h-[56.25vw] min-h-full w-full min-w-[177.78vh] -translate-x-1/2 -translate-y-1/2"
              style={{ opacity: 0.35 }}
              allow="autoplay; encrypted-media"
              frameBorder="0"
            />
          )}
        </div>,
        document.body
      )}
      {/* ヘッダーエリアのボタン群（header z-30 の上） */}
      {createPortal(
        <div
          className="pointer-events-none fixed inset-x-0 top-0 flex h-14 items-center justify-end gap-1.5 px-4"
          style={{ zIndex: 31 }}
        >
          {/* 非表示 / 背景動画 トグル */}
          <button
            onClick={toggle}
            className="pointer-events-auto flex items-center gap-1 rounded-full bg-black/20 px-2.5 py-1 text-[10px] font-medium text-white/60 backdrop-blur-sm transition-all hover:bg-black/40 hover:text-white"
          >
            {enabled ? (
              <>
                <svg className="h-2.5 w-2.5 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 2l12 12M7 4.5A4 4 0 0 1 12 10M4 7a4 4 0 0 0 5.5 5.5" />
                </svg>
                非表示
              </>
            ) : (
              <>
                <svg className="h-2.5 w-2.5 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                  <polygon points="3 2 13 8 3 14 3 2" />
                </svg>
                再表示
              </>
            )}
          </button>
          {/* 別の動画（複数ある場合のみ） */}
          {enabled && videoIds.length > 1 && (
            <button
              onClick={shuffle}
              className="pointer-events-auto flex items-center gap-1 rounded-full bg-black/20 px-2.5 py-1 text-[10px] font-medium text-white/60 backdrop-blur-sm transition-all hover:bg-black/40 hover:text-white"
            >
              <svg className="h-2.5 w-2.5 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 4h3l2 8h6" /><path d="M7 4h7m0 0-2-2m2 2-2 2" /><path d="M4 12h5m3 0 2-2m-2 2 2 2" />
              </svg>
              別の動画
            </button>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
