"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function FeedbackUnreadBadge() {
  const [count, setCount] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/feedback/unread")
      .then((r) => r.json())
      .then((d) => setCount(d.count ?? 0))
      .catch(() => {});
  }, [pathname]);

  if (count === 0) return null;
  return (
    <span className="ml-auto flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
      {count > 99 ? "99+" : count}
    </span>
  );
}
