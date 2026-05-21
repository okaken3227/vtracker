"use client";

import { useRouter } from "next/navigation";
import type { Group, GroupCategory } from "@/lib/types";

const CATEGORY_LABEL: Record<GroupCategory, string> = {
  vtuber: "VTuber",
  esports: "Eスポーツ",
  indie: "個人勢",
  other: "その他",
};

type Props = { groups: Group[]; selected?: string; onSelect?: (groupId: string | undefined) => void };

export default function GroupTabs({ groups, selected, onSelect }: Props) {
  const router = useRouter();

  function select(groupId: string | undefined) {
    if (onSelect) { onSelect(groupId); return; }
    router.push(groupId ? `/?group=${groupId}` : "/");
  }

  // 親グループ順 → 直後にそのサブグループ の階層順にソート
  function sortHierarchically(gs: Group[]): Group[] {
    const topLevel = gs
      .filter((g) => !g.parent_group_id)
      .sort((a, b) => (a.sort_order ?? 99999) - (b.sort_order ?? 99999));
    const result: Group[] = [];
    for (const parent of topLevel) {
      result.push(parent);
      const children = gs
        .filter((g) => g.parent_group_id === parent.id)
        .sort((a, b) => (a.sort_order ?? 99999) - (b.sort_order ?? 99999));
      result.push(...children);
    }
    // parent が同カテゴリ外にある孤立サブグループは末尾に追加
    const added = new Set(result.map((g) => g.id));
    for (const g of gs) { if (!added.has(g.id)) result.push(g); }
    return result;
  }

  const categories: GroupCategory[] = ["vtuber", "esports", "indie", "other"];
  const byCategory = categories
    .map((cat) => ({ cat, items: sortHierarchically(groups.filter((g) => (g.category ?? "vtuber") === cat)) }))
    .filter((c) => c.items.length > 0);

  return (
    <div className="mb-6 space-y-3">
      {/* すべて */}
      <div
        className="flex gap-1.5 overflow-x-auto pb-0.5"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none", maskImage: "linear-gradient(to right, black 85%, transparent 100%)", WebkitMaskImage: "linear-gradient(to right, black 85%, transparent 100%)" } as React.CSSProperties}
      >
        <button
          onClick={() => select(undefined)}
          className={`inline-flex shrink-0 items-center rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
            !selected
              ? "bg-gray-900 text-white shadow-sm"
              : "border border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-800"
          }`}
        >
          すべて
        </button>
      </div>

      {/* カテゴリ別 */}
      {byCategory.map(({ cat, items }) => (
        <div key={cat}>
          {/* カテゴリラベル */}
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
            {CATEGORY_LABEL[cat]}
          </p>

          {/* 横スクロール pill 列 */}
          <div
            className="flex gap-1.5 overflow-x-auto pb-0.5"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none", maskImage: "linear-gradient(to right, black 85%, transparent 100%)", WebkitMaskImage: "linear-gradient(to right, black 85%, transparent 100%)" } as React.CSSProperties}
          >
            {items.map((g) => {
              const isSelected = selected === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => select(isSelected ? undefined : g.id)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                    isSelected
                      ? "text-white shadow-sm"
                      : "border border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900"
                  }`}
                  style={isSelected ? { backgroundColor: g.color, borderColor: g.color } : undefined}
                >
                  {g.icon_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.icon_url} alt="" className="h-3.5 w-3.5 rounded-full object-cover" />
                  ) : (
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: isSelected ? "rgba(255,255,255,0.6)" : g.color }}
                    />
                  )}
                  {g.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
