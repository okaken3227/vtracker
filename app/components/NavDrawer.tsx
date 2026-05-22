"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useGroups } from "./GroupsProvider";
import FeedbackUnreadBadge from "./FeedbackUnreadBadge";

const NAV = [
  {
    href: "/",
    label: "ホーム",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: "/today",
    label: "タイムライン",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    href: "/ranking",
    label: "ランキング",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
    ),
  },
  {
    href: "/compare",
    label: "比較",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="6" height="18" rx="1" />
        <rect x="9" y="8" width="6" height="13" rx="1" />
        <rect x="16" y="5" width="6" height="16" rx="1" />
      </svg>
    ),
  },
  {
    href: "/feedback",
    label: "要望・質問",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
];

export default function NavDrawer() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const groups = useGroups();

  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  const topLevelGroups = groups.filter((g) => !g.parent_group_id);
  const childrenByParent = new Map<string, typeof groups>();
  for (const g of groups) {
    if (g.parent_group_id) {
      const arr = childrenByParent.get(g.parent_group_id) ?? [];
      arr.push(g);
      childrenByParent.set(g.parent_group_id, arr);
    }
  }

  function toggleParent(id: string) {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setOpen(false); }, [pathname]);

  const drawer = (
    <>
      {/* オーバーレイ */}
      <div
        className={`fixed inset-0 z-[998] bg-black/30 backdrop-blur-[3px] transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setOpen(false)}
      />

      {/* ドロワーパネル（右からスライドイン・スマホは全幅） */}
      <div
        className={`fixed right-0 top-0 z-[999] flex h-screen w-full sm:w-72 flex-col bg-white/90 backdrop-blur-2xl shadow-[-8px_0_40px_-8px_rgba(109,40,217,0.18)] transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* ヘッダー */}
        <div className="relative flex items-center justify-between px-5 py-4">
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-violet-400/50 via-purple-300/25 to-pink-400/40" />
          <Link href="/" className="text-lg font-bold tracking-tight">
            <span className="text-gradient">v</span><span className="text-gray-800">tracker</span>
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-gray-100/80 text-gray-500 transition-colors hover:bg-violet-50 hover:text-violet-600"
            aria-label="閉じる"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {/* メインナビ */}
          <div className="space-y-0.5">
            {NAV.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                    active
                      ? "bg-gradient-to-r from-violet-500/12 to-purple-400/8 text-violet-700 shadow-[inset_0_0_0_1px_rgba(124,58,237,0.2),0_2px_8px_-2px_rgba(124,58,237,0.12)]"
                      : "text-gray-500 hover:bg-white/70 hover:text-gray-800"
                  }`}
                >
                  <span className={`flex-shrink-0 transition-colors ${active ? "text-violet-600" : "text-gray-400 group-hover:text-gray-600"}`}>
                    {item.icon}
                  </span>
                  <span className="flex-1">{item.label}</span>
                  {active && <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />}
                </Link>
              );
            })}
          </div>

          {/* 管理サブナビ（/admin/* のときだけ表示） */}
          {pathname.startsWith("/admin") && (
            <div className="mt-5">
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                管理メニュー
              </p>
              <div className="space-y-0.5">
                {[
                  {
                    href: "/admin",
                    label: "管理トップ",
                    icon: (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" /><path d="M19.07 4.93l-1.41 1.41M5.34 18.66l-1.41 1.41M21 12h-2M5 12H3M18.66 18.66l-1.41-1.41M6.75 6.75L5.34 5.34M12 21v-2M12 5V3" />
                      </svg>
                    ),
                    badge: null,
                  },
                  {
                    href: "/admin/feedback",
                    label: "要望・質問",
                    icon: (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    ),
                    badge: <FeedbackUnreadBadge />,
                  },
                ].map((item) => {
                  const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                        active
                          ? "bg-gradient-to-r from-violet-500/12 to-purple-400/8 text-violet-700 shadow-[inset_0_0_0_1px_rgba(124,58,237,0.2)]"
                          : "text-gray-500 hover:bg-white/70 hover:text-gray-800"
                      }`}
                    >
                      <span className={`flex-shrink-0 transition-colors ${active ? "text-violet-600" : "text-gray-400 group-hover:text-gray-600"}`}>
                        {item.icon}
                      </span>
                      <span className="flex-1">{item.label}</span>
                      {item.badge ?? (active && <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />)}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* グループセクション */}
          {groups.length > 0 && (
            <div className="mt-5">
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                グループ
              </p>
              <div className="space-y-0.5">
                {topLevelGroups.map((g) => {
                  const children = childrenByParent.get(g.id) ?? [];
                  const hasChildren = children.length > 0;
                  const isExpanded = expandedParents.has(g.id);
                  const active = pathname === `/group/${g.id}`;
                  const anyChildActive = children.some((c) => pathname === `/group/${c.id}`);

                  const icon = g.icon_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.icon_url} alt={g.name} className="h-6 w-6 flex-shrink-0 rounded-full object-cover" />
                  ) : (
                    <span
                      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ backgroundColor: g.color }}
                    >
                      {g.name[0]}
                    </span>
                  );

                  return (
                    <div key={g.id}>
                      <div className={`flex items-center rounded-xl transition-all duration-150 ${
                        active || anyChildActive
                          ? "bg-gradient-to-r from-violet-500/12 to-purple-400/8 shadow-[inset_0_0_0_1px_rgba(124,58,237,0.15)]"
                          : "hover:bg-white/70"
                      }`}>
                        <Link
                          href={`/group/${g.id}`}
                          className={`flex flex-1 items-center gap-3 px-3 py-2 text-sm font-medium transition-colors ${
                            active || anyChildActive ? "text-violet-700" : "text-gray-500 hover:text-gray-800"
                          }`}
                        >
                          {icon}
                          <span className="text-xs">{g.name}</span>
                          {!hasChildren && active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-violet-500" />}
                        </Link>
                        {hasChildren && (
                          <button
                            onClick={() => toggleParent(g.id)}
                            className="shrink-0 px-3 py-2 text-[9px] text-gray-400 hover:text-violet-600 transition-colors"
                          >
                            {isExpanded ? "▼" : "▶"}
                          </button>
                        )}
                      </div>

                      {hasChildren && isExpanded && (
                        <div className="ml-4 mt-0.5 space-y-0.5 border-l-2 border-violet-100/60 pl-3">
                          {children.map((child) => {
                            const childActive = pathname === `/group/${child.id}`;
                            return (
                              <Link
                                key={child.id}
                                href={`/group/${child.id}`}
                                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                                  childActive
                                    ? "bg-gradient-to-r from-violet-500/12 to-purple-400/8 text-violet-700"
                                    : "text-gray-500 hover:bg-white/70 hover:text-gray-800"
                                }`}
                              >
                                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: child.color }} />
                                <span className="truncate">{child.name}</span>
                                {childActive && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </nav>

        <div className="relative px-5 py-3 flex items-center justify-between">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-violet-400/30 via-purple-300/15 to-pink-400/25" />
          <p className="text-[11px] text-gray-300">vtracker</p>
          <Link href="/terms" className="text-[11px] text-gray-400 hover:text-violet-600 transition-colors">
            利用規約
          </Link>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* ハンバーガーボタン */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "メニューを閉じる" : "メニューを開く"}
        className={`relative flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200 ${
          open ? "bg-violet-50 text-violet-600 ring-1 ring-violet-200" : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
        }`}
      >
        <div className="relative h-3.5 w-5">
          <span className={`absolute left-0 h-[1.5px] w-full rounded-full bg-current transition-all duration-300 ease-in-out ${open ? "top-[6px] rotate-45" : "top-0 rotate-0"}`} />
          <span className={`absolute left-0 top-[6px] h-[1.5px] rounded-full bg-current transition-all duration-300 ease-in-out ${open ? "w-0 opacity-0" : "w-full opacity-100"}`} />
          <span className={`absolute left-0 h-[1.5px] w-full rounded-full bg-current transition-all duration-300 ease-in-out ${open ? "top-[6px] -rotate-45" : "top-[13px] rotate-0"}`} />
        </div>
      </button>

      {mounted && createPortal(drawer, document.body)}
    </>
  );
}
