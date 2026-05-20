import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { requireAdmin } from "@/lib/admin-auth";
import { getYouTubeApiKeys } from "@/lib/youtube/client";

export async function GET(req: NextRequest) {
  const authError = requireAdmin(req);
  if (authError) return authError;

  const date = new Date().toISOString().split("T")[0];
  const { data } = await supabase
    .from("api_usage_daily")
    .select("key_units, quota_exceeded_keys, calls_count, twitch_calls_count")
    .eq("date", date)
    .maybeSingle();

  const keyCount = getYouTubeApiKeys().length;
  const keyUnits = (data?.key_units ?? {}) as Record<string, number>;
  const quotaExceededKeys = (data?.quota_exceeded_keys ?? {}) as Record<string, boolean>;

  const perKeyUnits = Array.from({ length: keyCount }, (_, i) => keyUnits[String(i + 1)] ?? 0);
  const totalUsed = perKeyUnits.reduce((s, v) => s + v, 0);

  return NextResponse.json({
    date,
    unitsUsed: totalUsed,
    callsCount: data?.calls_count ?? 0,
    quotaLimit: 10000 * keyCount,
    twitchCallsCount: data?.twitch_calls_count ?? 0,
    keyCount,
    perKeyUnits,
    quotaExceededKeys: Array.from({ length: keyCount }, (_, i) => quotaExceededKeys[String(i + 1)] ?? false),
  });
}
