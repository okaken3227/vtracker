import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { requireAdmin } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  const authError = requireAdmin(req);
  if (authError) return authError;
  // グループのキーワード一覧を取得
  const { data: groups, error: gErr } = await supabase
    .from("groups")
    .select("id, keywords")
    .not("keywords", "is", null);
  if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 });

  const groupRules = ((groups ?? []) as { id: string; keywords: string }[])
    .map((g) => ({
      id: g.id,
      kws: g.keywords.split(",").map((k) => k.trim()).filter(Boolean),
    }))
    .filter((g) => g.kws.length > 0);

  // indie グループが存在するか確認
  const { data: indieGroup } = await supabase.from("groups").select("id").eq("id", "indie").maybeSingle();
  const indieId = indieGroup ? "indie" : null;

  // group_id が null のチャンネルを全件取得
  const { data: channels, error: cErr } = await supabase
    .from("channels")
    .select("channel_id, description")
    .is("group_id", null);
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

  let matched = 0;
  let indie = 0;

  for (const ch of (channels ?? []) as { channel_id: string; description: string }[]) {
    const desc = ch.description ?? "";

    const descLower = desc.toLowerCase();
    let matchedId: string | null = null;
    for (const rule of groupRules) {
      if (rule.kws.some((kw) => descLower.includes(kw.toLowerCase()))) {
        matchedId = rule.id;
        break;
      }
    }

    if (!matchedId && indieId) matchedId = indieId;

    if (matchedId) {
      await supabase.from("channels").update({ group_id: matchedId }).eq("channel_id", ch.channel_id);
      if (matchedId === indieId) indie++;
      else matched++;
    }
  }

  return NextResponse.json({ ok: true, matched, indie, total: (channels ?? []).length });
}
