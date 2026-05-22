import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

const FRESH_MS = 60 * 1000;

export async function GET() {
  const { data } = await supabase
    .from("live_graph_points")
    .select("recorded_at")
    .order("recorded_at", { ascending: false })
    .limit(1)
    .single();

  const latestAt = data?.recorded_at ?? null;
  const isFresh = latestAt ? Date.now() - new Date(latestAt).getTime() < FRESH_MS : false;

  return NextResponse.json({ isFresh, latestAt });
}
