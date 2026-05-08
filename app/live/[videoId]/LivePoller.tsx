"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LivePagePoller({ isLive }: { isLive: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!isLive) return;

    let active = true;
    const poll = async () => {
      if (!active) return;
      const res = await fetch("/api/poll/live", { method: "POST" }).catch(() => null);
      if (res?.ok && active) router.refresh();
    };

    poll();
    const id = setInterval(poll, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [isLive, router]);

  return null;
}
