import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

export async function GET() {
  const { data, error } = await supabase
    .from("channels")
    .select("channel_id, name, group_id")
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function PATCH(req: NextRequest) {
  const { channelId, groupId } = await req.json();
  if (!channelId) {
    return NextResponse.json({ error: "channelId は必須です" }, { status: 400 });
  }
  const { error } = await supabase
    .from("channels")
    .update({ group_id: groupId ?? null })
    .eq("channel_id", channelId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
