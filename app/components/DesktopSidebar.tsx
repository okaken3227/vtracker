"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSidebar } from "./SidebarProvider";
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
    href: "/feedback",
    label: "要望・質問",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
];

export default function DesktopSidebar() {
  const pathname = usePathname();
  const { open } = useSidebar();
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

  return (
    <aside
      className={`hidden lg:flex h-full shrink-0 flex-col overflow-hidden bg-white/20 backdrop-blur-xl transition-[width] duration-200 ${
        open ? "w-48" : "w-14"
      }`}
    >
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <div className="space-y-0.5">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={open ? undefined : item.label}
                className={`group flex items-center rounded-xl text-sm font-medium transition-all duration-150 ${
                  active
                    ? "bg-violet-50 text-violet-700"
                    : "text-gray-500 hover:bg-gray-100/70 hover:text-gray-800"
                } ${
                  open
                    ? "w-full gap-3 px-2.5 py-2.5"
                    : "mx-auto h-9 w-9 justify-center"
                }`}
              >
                <span className={`shrink-0 transition-colors ${active ? "text-violet-500" : "text-gray-400 group-hover:text-gray-600"}`}>
                  {item.icon}
                </span>
                <span
                  className="overflow-hidden whitespace-nowrap transition-[opacity] duration-150"
                  style={{ opacity: open ? 1 : 0, width: open ? "auto" : 0 }}
                >
                  {item.label}
                </span>
                {open && active && (
                  <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                )}
              </Link>
            );
          })}
        </div>

        {/* 管理サブナビ（/admin/* のときだけ表示） */}
        {pathname.startsWith("/admin") && (
          <div className="mt-4">
            {open && (
              <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                管理メニュー
              </p>
            )}
            {!open && <div className="mb-1 mx-auto h-px w-6 bg-gray-200" />}
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
                    title={open ? undefined : item.label}
                    className={`group flex items-center rounded-xl text-sm font-medium transition-all duration-150 ${
                      active ? "bg-violet-50 text-violet-700" : "text-gray-500 hover:bg-gray-100/70 hover:text-gray-800"
                    } ${open ? "w-full gap-3 px-2.5 py-2.5" : "mx-auto h-9 w-9 justify-center"}`}
                  >
                    <span className={`shrink-0 transition-colors ${active ? "text-violet-500" : "text-gray-400 group-hover:text-gray-600"}`}>
                      {item.icon}
                    </span>
                    <span
                      className="overflow-hidden whitespace-nowrap transition-[opacity] duration-150"
                      style={{ opacity: open ? 1 : 0, width: open ? "auto" : 0 }}
                    >
                      {item.label}
                    </span>
                    {open && item.badge}
                    {open && active && !item.badge && (
                      <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* グループセクション */}
        {groups.length > 0 && (
          <div className="mt-4">
            {open && (
              <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                グループ
              </p>
            )}
            {!open && <div className="mb-1 mx-auto h-px w-6 bg-gray-200" />}
            <div className="space-y-0.5">
              {topLevelGroups.map((g) => {
                const children = childrenByParent.get(g.id) ?? [];
                const hasChildren = children.length > 0;
                const isExpanded = expandedParents.has(g.id);
                const active = pathname === `/group/${g.id}`;
                const anyChildActive = children.some((c) => pathname === `/group/${c.id}`);

                const icon = g.icon_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={g.icon_url} alt={g.name} className="h-6 w-6 shrink-0 rounded-full object-cover" />
                ) : (
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: g.color }}
                  >
                    {g.name[0]}
                  </span>
                );

                return (
                  <div key={g.id}>
                    {/* 親グループ行: リンク + 子がある場合は右端にシェブロンボタン */}
                    <div className={`flex items-center rounded-xl transition-all duration-150 ${
                      active || anyChildActive ? "bg-violet-50" : "hover:bg-gray-100/70"
                    } ${open ? "w-full" : "mx-auto w-9"}`}>
                      <Link
                        href={`/group/${g.id}`}
                        title={open ? undefined : g.name}
                        className={`flex flex-1 items-center text-sm font-medium transition-colors ${
                          active || anyChildActive ? "text-violet-700" : "text-gray-500 hover:text-gray-800"
                        } ${open ? "gap-3 px-2.5 py-2" : "h-9 justify-center"}`}
                      >
                        {icon}
                        <span
                          className="overflow-hidden whitespace-nowrap transition-[opacity] duration-150 text-xs"
                          style={{ opacity: open ? 1 : 0, width: open ? "auto" : 0 }}
                        >
                          {g.name}
                        </span>
                        {open && !hasChildren && active && (
                          <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                        )}
                      </Link>
                      {/* 子グループのアコーディオントグル（サイドバー展開中のみ） */}
                      {open && hasChildren && (
                        <button
                          onClick={() => toggleParent(g.id)}
                          className="shrink-0 px-2 py-2 text-[9px] text-gray-400 hover:text-violet-600 transition-colors"
                        >
                          {isExpanded ? "▼" : "▶"}
                        </button>
                      )}
                    </div>

                    {/* 子グループ（サイドバー展開中かつ親が開いているとき） */}
                    {open && hasChildren && isExpanded && (
                      <div className="ml-3 mt-0.5 space-y-0.5 border-l-2 border-gray-100 pl-2">
                        {children.map((child) => {
                          const childActive = pathname === `/group/${child.id}`;
                          return (
                            <Link
                              key={child.id}
                              href={`/group/${child.id}`}
                              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                                childActive ? "bg-violet-50 text-violet-700" : "text-gray-500 hover:bg-gray-100/70 hover:text-gray-800"
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
    </aside>
  );
}
