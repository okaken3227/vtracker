import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

export async function GET() {
  const date = new Date().toISOString().split("T")[0];
  const { data } = await supabase
    .from("api_usage_daily")
    .select("units_used, calls_count, twitch_calls_count")
    .eq("date", date)
    .maybeSingle();

  return NextResponse.json({
    date,
    unitsUsed: data?.units_used ?? 0,
    callsCount: data?.calls_count ?? 0,
    quotaLimit: 10000,
    twitchCallsCount: data?.twitch_calls_count ?? 0,
  });
}
