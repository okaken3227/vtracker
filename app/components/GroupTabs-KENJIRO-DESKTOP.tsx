"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Group, GroupCategory } from "@/lib/types";

type Props = { groups: Group[]; selected?: string; onSelect?: (id: string | undefined) => void };

export default function GroupTabs({ groups, selected, onSelect }: Props) {
  const router = useRouter();

  function select(groupId: string | undefined) {
    if (onSelect) {
      onSelect(groupId);
    } else {
      router.push(groupId ? `/?group=${groupId}` : "/");
    }
  }

  const categories: GroupCategory[] = ["vtuber", "esports", "indie", "other"];
  const byCategory = categories
    .map((cat) => ({
      cat,
      items: groups.filter((g) => (g.category ?? "vtuber") === cat),
    }))
    .filter((c) => c.items.length > 0);

  return (
    <div className="mb-6">
      {/* すべて + グループカード */}
      <div className="flex flex-wrap gap-2">
        {/* すべてカード */}
        <button
          onClick={() => select(undefined)}
          className={`group relative flex h-12 items-center gap-2 rounded-2xl border px-3 text-xs font-semibold transition-all duration-200 sm:h-16 sm:px-4 sm:text-sm ${
            !selected
              ? "border-violet-400 bg-violet-600 text-white shadow-md shadow-violet-200"
              : "border-gray-200 bg-white text-gray-500 hover:border-violet-300 hover:text-violet-600 hover:shadow-sm"
          }`}
        >
          <span className={`flex h-7 w-7 items-center justify-center rounded-xl text-base sm:h-9 sm:w-9 sm:text-lg ${!selected ? "bg-white/20" : "bg-gray-100"}`}>
            🌐
          </span>
          <span>すべて</span>
        </button>

        {byCategory.flatMap(({ items }) =>
          items.map((g) => {
            const isSelected = selected === g.id;
            return (
              <GroupCard
                key={g.id}
                group={g}
                isSelected={isSelected}
                onSelect={() => select(g.id)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

function GroupCard({
  group,
  isSelected,
  onSelect,
}: {
  group: Group;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const color = group.color ?? "#6b7280";

  return (
    <div
      className="relative flex h-12 cursor-pointer items-center gap-2 rounded-2xl border px-3 transition-all duration-200 sm:h-16 sm:gap-2.5 sm:px-4"
      style={
        isSelected
          ? {
              backgroundColor: color,
              borderColor: color,
              boxShadow: `0 4px 16px -4px ${color}80`,
            }
          : {
              backgroundColor: "white",
              borderColor: "#e5e7eb",
            }
      }
      onClick={onSelect}
    >
      {/* アイコン */}
      <div
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl sm:h-9 sm:w-9"
        style={isSelected ? { backgroundColor: "rgba(255,255,255,0.2)" } : { backgroundColor: `${color}18` }}
      >
        {group.icon_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={group.icon_url}
            alt={group.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-base font-bold" style={{ color: isSelected ? "white" : color }}>
            {group.name.slice(0, 1)}
          </span>
        )}
      </div>

      {/* グループ名 */}
      <span
        className="text-xs font-semibold leading-tight sm:text-sm"
        style={{ color: isSelected ? "white" : "#111827" }}
      >
        {group.name}
      </span>

      {/* グループページリンク */}
      <Link
        href={`/group/${group.slug ?? group.id}`}
        className="ml-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-100 sm:ml-1"
        style={{
          backgroundColor: isSelected ? "rgba(255,255,255,0.25)" : `${color}22`,
          color: isSelected ? "white" : color,
          opacity: isSelected ? 1 : 0.7,
        }}
        title={`${group.name}のページへ`}
        onClick={(e) => e.stopPropagation()}
      >
        <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2.5 9.5L9.5 2.5M6 2.5h3.5v3.5" />
        </svg>
      </Link>
    </div>
  );
}
