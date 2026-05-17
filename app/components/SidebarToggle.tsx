"use client";

import { useSidebar } from "./SidebarProvider";

export default function SidebarToggle() {
  const { open, toggle } = useSidebar();
  return (
    <button
      onClick={toggle}
      aria-label={open ? "サイドバーを閉じる" : "サイドバーを開く"}
      className="hidden lg:flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100/80 hover:text-gray-800"
    >
      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
        <line x1="2" y1="5" x2="18" y2="5" />
        <line x1="2" y1="10" x2="18" y2="10" />
        <line x1="2" y1="15" x2="18" y2="15" />
      </svg>
    </button>
  );
}
