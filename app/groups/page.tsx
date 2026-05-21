import type { Metadata } from "next";
import { supabase } from "@/lib/supabase/client";
import type { Group, GroupCategory } from "@/lib/types";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "グループ一覧",
  description: "VTuberグループ・事務所の一覧。各グループのチャンネルや配信状況を確認できます。",
};

const CATEGORY_LABEL: Record<GroupCategory, string> = {
  vtuber: "VTuber",
  esports: "Eスポーツ",
  indie: "個人勢",
  other: "その他",
};

const CATEGORY_STYLE: Record<GroupCategory, string> = {
  vtuber: "bg-violet-100 text-violet-700",
  esports: "bg-cyan-100 text-cyan-700",
  indie: "bg-amber-100 text-amber-700",
  other: "bg-gray-100 text-gray-600",
};

export default async function GroupsPage() {
  const { data } = await supabase
    .from("groups")
    .select("*")
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name");

  const allGroups = (data ?? []) as Group[];
  const topGroups = allGroups.filter((g) => !g.parent_group_id);
  const childMap = new Map<string, Group[]>();
  for (const g of allGroups) {
    if (g.parent_group_id) {
      if (!childMap.has(g.parent_group_id)) childMap.set(g.parent_group_id, []);
      childMap.get(g.parent_group_id)!.push(g);
    }
  }

  const categories: GroupCategory[] = ["vtuber", "esports", "indie", "other"];
  const byCategory = categories
    .map((cat) => ({
      cat,
      groups: topGroups.filter((g) => (g.category ?? "vtuber") === cat),
    }))
    .filter((c) => c.groups.length > 0);

  return (
    <div>
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-2 text-xs text-gray-400">
          <Link href="/" className="hover:text-violet-600 transition-colors">ホーム</Link>
          <span>›</span>
          <span>グループ</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900">グループ一覧</h1>
      </div>

      <div className="space-y-10">
        {byCategory.map(({ cat, groups }) => (
          <section key={cat}>
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-base font-semibold text-gray-900">{CATEGORY_LABEL[cat]}</h2>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_STYLE[cat]}`}>
                {groups.length}グループ
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map((g) => {
                const children = childMap.get(g.id) ?? [];
                return (
                  <Link
                    key={g.id}
                    href={`/group/${g.id}`}
                    className="group flex items-start gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-violet-200 hover:shadow-md"
                  >
                    {g.icon_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={g.icon_url} alt={g.name} className="h-10 w-10 flex-shrink-0 rounded-full object-cover" />
                    ) : (
                      <div
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-base font-bold text-white"
                        style={{ backgroundColor: g.color }}
                      >
                        {g.name[0]}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 group-hover:text-violet-600 transition-colors">{g.name}</p>
                      {children.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {children.map((c) => (
                            <span
                              key={c.id}
                              className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                              style={{ backgroundColor: c.color }}
                            >
                              {c.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
