import type { Metadata } from "next";
import { supabase } from "@/lib/supabase/client";
import type { Channel, Group } from "@/lib/types";
import CompareClient from "./CompareClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "チャンネル比較",
  description: "複数のVTuberチャンネルを比較。同接推移・スパチャ・登録者数を並べてグラフで確認できます。",
};

export default async function ComparePage() {
  const [chRes, grRes, liveRes] = await Promise.all([
    supabase.from("channels").select("*").order("subscriber_count", { ascending: false }),
    supabase
      .from("groups")
      .select("*")
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name"),
    supabase.from("videos").select("channel_id").eq("status", "live"),
  ]);

  const channels = (chRes.data ?? []) as Channel[];
  const groups = (grRes.data ?? []) as Group[];
  const liveChannelIds = [...new Set(
    ((liveRes.data ?? []) as { channel_id: string }[]).map((v) => v.channel_id)
  )];

  return (
    <div>
      <CompareClient channels={channels} groups={groups} liveChannelIds={liveChannelIds} />
    </div>
  );
}
