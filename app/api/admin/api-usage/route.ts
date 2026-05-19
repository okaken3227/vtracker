import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

export async function GET() {
  const date = new Date().toISOString().split("T")[0];
  const { data } = await supabase
    .from("api_usage_daily")
    .select("units_used, calls_count, twitch_calls_count, quota_exceeded_key1, quota_exceeded_key2, quota_exceeded_key3")
    .eq("date", date)
    .maybeSingle();

  const keyCount = [
    process.env.YOUTUBE_API_KEY,
    process.env.YOUTUBE_API_KEY_2,
    process.env.YOUTUBE_API_KEY_3,
  ].filter(Boolean).length;

  return NextResponse.json({
    date,
    unitsUsed: data?.units_used ?? 0,
    callsCount: data?.calls_count ?? 0,
    quotaLimit: 10000 * Math.max(1, keyCount),
    twitchCallsCount: data?.twitch_calls_count ?? 0,
    keyCount,
    quotaExceededKeys: [
      data?.quota_exceeded_key1 ?? false,
      data?.quota_exceeded_key2 ?? false,
      data?.quota_exceeded_key3 ?? false,
    ],
  });
}
