import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await supabase
    .from("feedback")
    .select("id, message, public_answer, name, created_at, is_admin_post")
    .eq("is_public", true)
    .eq("is_deleted", false)
    .not("public_answer", "is", null)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
