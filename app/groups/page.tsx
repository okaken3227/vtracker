import type { Metadata } from "next";
import { supabase } from "@/lib/supabase/client";
import type { Group, GroupCategory } from "@/lib/types";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "VTuber事務所・グループ一覧 | にじさんじ・ホロライブ・ぶいすぽっ！ほか",
  description:
    "にじさんじ・ホロライブ・ぶいすぽっ！・あおぎり高校など、国内外のVTuber事務所・グループ一覧。各グループの所属チャンネル、ライブ状況、合計登録者数をまとめて確認できます。",
  alternates: { canonical: "/groups" },
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
        <h1 className="text-xl font-bold text-gray-900">VTuberグループ・事務所一覧</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          にじさんじ・ホロライブ・ぶいすぽっ！など、VTuber事務所・グループの一覧です。
          各グループをクリックすると、所属チャンネルの一覧や配信状況、合計同接・スパチャ統計を確認できます。
        </p>
      </div>

      <div className="mb-8 rounded-xl border border-violet-100/60 bg-violet-50/40 p-4 text-xs leading-relaxed text-gray-600">
        <p className="mb-1.5"><span className="font-semibold text-gray-800">VTuber事務所・グループとは</span></p>
        <p>
          複数のVTuberが所属する運営会社や集団のことです。
          代表的な事務所として、にじさんじ（運営：ANYCOLOR株式会社）、ホロライブ（運営：カバー株式会社）、
          ぶいすぽっ！（運営：株式会社ブイラスト）などがあります。
          各グループには日本人VTuberだけでなく、英語圏（EN）・インドネシア（ID）・中華圏など、
          海外向けに展開しているサブグループも含まれます。事務所に所属しない「個人勢」も
          このページから一覧でき、それぞれのページから所属チャンネル一覧やライブ状況にアクセスできます。
        </p>
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

      <section className="mt-12 border-t border-gray-100 pt-10 text-sm leading-relaxed text-gray-600">
        <h2 className="mb-3 text-lg font-bold text-gray-900">VTuber事務所の主なカテゴリ</h2>
        <div className="space-y-4">
          <div>
            <h3 className="mb-1 font-semibold text-gray-800">大手VTuber事務所</h3>
            <p>
              数十名〜100名以上のVTuberが所属する大規模事務所。日本国内向けのレギュラーグループに加え、
              英語圏（EN）・インドネシア（ID）など海外展開を行っているケースも多く、
              にじさんじ（ANYCOLOR）・ホロライブ（カバー）が代表例です。
            </p>
          </div>
          <div>
            <h3 className="mb-1 font-semibold text-gray-800">ゲーミング系VTuber事務所</h3>
            <p>
              ゲーム配信・eスポーツ寄りのコンテンツを中心に展開するVTuber事務所。
              ぶいすぽっ！（ブイラスト）・REJECT・あおぎり高校などが知られています。
              FPSや格闘ゲームの大会への参加・コラボ配信も多く、競技性の高い配信を好むファン層に支持されています。
            </p>
          </div>
          <div>
            <h3 className="mb-1 font-semibold text-gray-800">個人勢・小規模グループ</h3>
            <p>
              事務所に所属せず個人で活動するVTuber、または数名規模で活動する小規模グループ。
              企画の自由度や運営との距離感の近さが特徴で、独自のファンコミュニティを築いているケースが多く見られます。
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className="text-violet-600 hover:underline">ホーム</Link>
          <span className="text-gray-200">·</span>
          <Link href="/ranking" className="text-violet-600 hover:underline">ランキング</Link>
          <span className="text-gray-200">·</span>
          <Link href="/compare" className="text-violet-600 hover:underline">配信比較</Link>
          <span className="text-gray-200">·</span>
          <Link href="/about" className="text-violet-600 hover:underline">サービスについて</Link>
        </div>
      </section>
    </div>
  );
}
