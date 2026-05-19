import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

export async function GET() {
  const date = new Date().toISOString().split("T")[0];
  const { data } = await supabase
    .from("api_usage_daily")
    .select("units_used, units_used_key2, units_used_key3, calls_count, twitch_calls_count, quota_exceeded_key1, quota_exceeded_key2, quota_exceeded_key3")
    .eq("date", date)
    .maybeSingle();

  const keyCount = [
    process.env.YOUTUBE_API_KEY,
    process.env.YOUTUBE_API_KEY_2,
    process.env.YOUTUBE_API_KEY_3,
  ].filter(Boolean).length;

  const perKeyUnits = [
    data?.units_used ?? 0,
    data?.units_used_key2 ?? 0,
    data?.units_used_key3 ?? 0,
  ];
  const totalUsed = perKeyUnits.slice(0, keyCount).reduce((s, v) => s + v, 0);

  return NextResponse.json({
    date,
    unitsUsed: totalUsed,
    callsCount: data?.calls_count ?? 0,
    quotaLimit: 10000,
    twitchCallsCount: data?.twitch_calls_count ?? 0,
    keyCount,
    perKeyUnits,
    quotaExceededKeys: [
      data?.quota_exceeded_key1 ?? false,
      data?.quota_exceeded_key2 ?? false,
      data?.quota_exceeded_key3 ?? false,
    ],
  });
}
