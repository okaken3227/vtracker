"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LivePoller({ hasLive }: { hasLive: boolean }) {
  const router = useRouter();

  // 5秒ごとに同接数を保存してページを更新（ライブ中のみ）
  useEffect(() => {
    if (!hasLive) return;

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
