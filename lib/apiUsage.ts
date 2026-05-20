import { supabase } from "./supabase/client";

const ENDPOINT_UNITS: Record<string, number> = {
  "channels": 1,
  "videos": 1,
  "playlistItems": 1,
  "liveChat/messages": 5,
  "search": 100,
};

export async function trackApiCall(endpoint: string, keyIndex: number = 1): Promise<void> {
  const units = ENDPOINT_UNITS[endpoint] ?? 1;
  const date = new Date().toISOString().split("T")[0];
  try {
    await supabase.rpc("increment_api_usage", {
      p_date: date,
      p_key_index: keyIndex,
      p_units: units,
    });
  } catch {
    // tracking failure must not break the main flow
  }
}

export async function trackQuotaExceeded(keyIndex: number): Promise<void> {
  const date = new Date().toISOString().split("T")[0];
  try {
    await supabase.rpc("mark_quota_exceeded", {
      p_date: date,
      p_key_index: keyIndex,
    });
  } catch {
    // tracking failure must not break the main flow
  }
}

export async function trackTwitchApiCall(): Promise<void> {
  const date = new Date().toISOString().split("T")[0];
  try {
    const { data } = await supabase
      .from("api_usage_daily")
      .select("twitch_calls_count")
      .eq("date", date)
      .maybeSingle();

    if (data) {
      await supabase
        .from("api_usage_daily")
        .update({ twitch_calls_count: (data.twitch_calls_count ?? 0) + 1 })
        .eq("date", date);
    } else {
      await supabase
        .from("api_usage_daily")
        .insert({ date, units_used: 0, calls_count: 0, twitch_calls_count: 1 });
    }
  } catch {
    // tracking failure must not break the main flow
  }
}
