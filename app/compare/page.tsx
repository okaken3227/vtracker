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
  const [chRes, grRes] = await Promise.all([
    supabase.from("channels").select("*").order("subscriber_count", { ascending: false }),
    supabase
      .from("groups")
      .select("*")
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name"),
  ]);

  const channels = (chRes.data ?? []) as Channel[];
  const groups = (grRes.data ?? []) as Group[];

  return (
    <div>
      <CompareClient channels={channels} groups={groups} />
    </div>
  );
}
