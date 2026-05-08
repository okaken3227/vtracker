import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

export async function GET() {
  try {
    const { data: channels, error: chErr } = await supabase
      .from("channels")
      .select("*")
      .order("subscriber_count", { ascending: false });

    if (chErr) throw chErr;

    const { data: videos, error: vErr } = await supabase
      .from("videos")
      .select("*")
      .order("start_time", { ascending: false });

    if (vErr) throw vErr;

    const { data: superchats, error: scErr } = await supabase
      .from("superchats")
      .select("id, video_id, amount, currency, tier");

    if (scErr) throw scErr;

    return NextResponse.json({ channels, videos, superchats });
  } catch (err) {
    const detail = err instanceof Error ? err.message : JSON.stringify(err);
    console.error("[GET /api/channels]", detail);
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
