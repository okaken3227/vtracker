"use client";

import { useEffect, useState } from "react";

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function LiveTimer({
  startTime,
  className = "font-mono text-xs font-semibold tabular-nums text-red-500",
}: {
  startTime: string;
  className?: string;
}) {
  const [elapsed, setElapsed] = useState(Date.now() - new Date(startTime).getTime());

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Date.now() - new Date(startTime).getTime());
    }, 1000);
    return () => clearInterval(id);
  }, [startTime]);

  return <span className={className} suppressHydrationWarning>{formatElapsed(elapsed)}</span>;
}
