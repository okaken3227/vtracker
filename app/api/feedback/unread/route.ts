import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const { count } = await supabase
    .from("feedback")
    .select("*", { count: "exact", head: true })
    .eq("is_read", false)
    .eq("is_deleted", false);
  return NextResponse.json({ count: count ?? 0 });
}
