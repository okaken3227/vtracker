"use client";

import { useEffect } from "react";
import { toPastelBg } from "@/lib/colorUtils";

export default function PageBackground({ color }: { color?: string | null }) {
  useEffect(() => {
    const el = document.getElementById("main-scroll");
    if (!el) return;
    const top = toPastelBg(color, 90, 65);
    const bottom = toPastelBg(color, 97, 30);
    el.style.background = top
      ? `linear-gradient(to bottom, ${top} 0%, ${bottom} 100%)`
      : "";
    return () => {
      el.style.background = "";
    };
  }, [color]);

  return null;
}
