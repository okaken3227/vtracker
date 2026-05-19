"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LivePoller({ hasLive }: { hasLive: boolean }) {
  const router = useRouter();

  // 5秒ごとに同接数を保存してページを更新（ライブ中のみ）
  useEffect(() => {
    if (!hasLive) return;

    let active = true;
    let retryDelay = 5000;

    const poll = async () => {
      if (!active) return;
      try {
        const res = await fetch("/api/poll/live", { method: "POST" });
        if (res.ok) {
          retryDelay = 5000;
          if (active) router.refresh();
        } else {
          retryDelay = Math.min(retryDelay * 2, 60000);
        }
      } catch {
        retryDelay = Math.min(retryDelay * 2, 60000);
      }
      if (active) setTimeout(poll, retryDelay);
    };

    poll();
    return () => { active = false; };
  }, [hasLive, router]);

  // 1時間ごとにチャンネル情報を更新
  useEffect(() => {
    let active = true;
    const poll = async () => {
      if (!active) return;
      await fetch("/api/poll/channels", { method: "POST" }).catch(() => {});
    };

    poll();
    const id = setInterval(poll, 60 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  return null;
}
