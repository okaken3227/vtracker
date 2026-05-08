"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Group, GroupCategory } from "@/lib/types";

const CATEGORY_LABEL: Record<GroupCategory, string> = {
  vtuber: "VTuber",
  esports: "Eスポーツ",
  indie: "個人勢",
  other: "その他",
};

type Props = { groups: Group[]; selected?: string };

export default function GroupTabs({ groups, selected }: Props) {
  const router = useRouter();

  function select(groupId: string | undefined) {
    router.push(groupId ? `/?group=${groupId}` : "/");
  }

  // カテゴリ順にグループを分類
  const categories: GroupCategory[] = ["vtuber", "esports", "indie", "other"];
  const byCategory = categories
    .map((cat) => ({
      cat,
      items: groups.filter((g) => (g.category ?? "vtuber") === cat),
    }))
    .filter((c) => c.items.length > 0);

  return (
    <div className="mb-6 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => select(undefined)}
          className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
            !selected
              ? "bg-violet-600 text-white shadow-sm"
              : "border border-gray-200 bg-white text-gray-500 hover:border-violet-300 hover:text-violet-600"
          }`}
        >
          すべて
        </button>
      </div>

      {byCategory.map(({ cat, items }) => (
        <div key={cat} className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-400 w-16 flex-shrink-0">{CATEGORY_LABEL[cat]}</span>
          {items.map((g) => (
            <div key={g.id} className="flex items-center gap-0.5">
              <button
                onClick={() => select(g.id)}
                className={`rounded-l-full px-3 py-1 text-sm font-medium transition-colors ${
                  selected === g.id
                    ? "text-white shadow-sm"
                    : "border border-gray-200 bg-white text-gray-500 hover:text-gray-900"
                }`}
                style={selected === g.id ? { backgroundColor: g.color } : undefined}
              >
                {g.name}
              </button>
              <Link
                href={`/group/${g.id}`}
                className={`rounded-r-full px-1.5 py-1 text-xs transition-colors ${
                  selected === g.id
                    ? "text-white/70 shadow-sm hover:text-white"
                    : "border border-l-0 border-gray-200 bg-white text-gray-300 hover:text-violet-500"
                }`}
                style={selected === g.id ? { backgroundColor: g.color } : undefined}
                title={`${g.name}のページへ`}
              >
                ↗
              </Link>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
