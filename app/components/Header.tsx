"use client";

import { useState } from "react";
import Link from "next/link";
import SearchBar from "./SearchBar";
import NavDrawer from "./NavDrawer";
import SidebarToggle from "./SidebarToggle";
import { usePathname } from "next/navigation";

export default function Header() {
  const [mobileSearch, setMobileSearch] = useState(false);
  const pathname = usePathname();

  return (
    <header className="shrink-0 bg-white/30 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-full items-center gap-3 px-4">

        {/* ── モバイル検索モード ── */}
        {mobileSearch && (
          <div className="flex flex-1 items-center gap-2 lg:hidden">
            {/* 戻るボタン */}
            <button
              onClick={() => setMobileSearch(false)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100/80"
              aria-label="検索を閉じる"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5l-5 5 5 5" />
              </svg>
            </button>
            <div className="flex-1">
              <SearchBar autoFocus onClose={() => setMobileSearch(false)} />
            </div>
          </div>
        )}

        {/* ── 通常ヘッダー（モバイル検索中は非表示） ── */}
        <div className={`flex w-full items-center gap-3 ${mobileSearch ? "hidden lg:flex" : "flex"}`}>
          {/* 左: PCサイドバートグル + ロゴ */}
          <div className="flex shrink-0 items-center gap-2">
            <SidebarToggle />
            <Link href="/" className="text-xl font-bold tracking-tight text-gray-900">
              v<span className="text-violet-600">tracker</span>
            </Link>
          </div>

          {/* 中央: 検索バー（PCのみ） */}
          <div className="hidden flex-1 justify-center lg:flex">
            <SearchBar />
          </div>

          {/* 右: 利用規約リンク（PCのみ） */}
          <div className="hidden lg:flex items-center">
            <Link
              href="/terms"
              className={`text-xs transition-colors ${
                pathname === "/terms" ? "text-violet-600" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              利用規約
            </Link>
          </div>

          {/* 右: モバイル用ボタン群 */}
          <div className="ml-auto flex items-center gap-1 lg:hidden">
            {/* 虫眼鏡ボタン */}
            <button
              onClick={() => setMobileSearch(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100/80"
              aria-label="検索"
            >
              <svg className="h-4.5 w-4.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                <circle cx="8.5" cy="8.5" r="5.5" />
                <path d="m13.5 13.5 3 3" />
              </svg>
            </button>
            <NavDrawer />
          </div>
        </div>

      </div>
    </header>
  );
}
