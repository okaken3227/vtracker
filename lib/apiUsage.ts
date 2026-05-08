import { supabase } from "./supabase/client";

const ENDPOINT_UNITS: Record<string, number> = {
  "channels": 1,
  "videos": 1,
  "playlistItems": 1,
  "liveChat/messages": 5,
  "search": 100,
};

export async function trackApiCall(endpoint: string): Promise<void> {
  const units = ENDPOINT_UNITS[endpoint] ?? 1;
  const date = new Date().toISOString().split("T")[0];
  try {
    const { data } = await supabase
      .from("api_usage_daily")
      .select("units_used, calls_count")
      .eq("date", date)
      .maybeSingle();

    if (data) {
      await supabase
        .from("api_usage_daily")
        .update({ units_used: data.units_used + units, calls_count: data.calls_count + 1 })
        .eq("date", date);
    } else {
      await supabase
        .from("api_usage_daily")
        .insert({ date, units_used: units, calls_count: 1 });
    }
  } catch {
    // tracking failure must not break the main flow
  }
}
