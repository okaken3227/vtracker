import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { type, message, name, public_answer, is_admin_post } = await req.json();
  if (!message?.trim()) {
    return NextResponse.json({ error: "メッセージは必須です" }, { status: 400 });
  }

  const { error } = await supabase.from("feedback").insert({
    type: type ?? "question",
    message: message.trim(),
    name: name?.trim() || null,
    public_answer: public_answer?.trim() || null,
    is_admin_post: is_admin_post ?? false,
    is_public: is_admin_post ? true : false,
    is_read: is_admin_post ? true : false,
  });

  if (error) {
    console.error("[feedback POST]", error);
    return NextResponse.json({ error: error.message, code: error.code, details: error.details }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const deleted = searchParams.get("deleted") === "true";

  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .eq("is_deleted", deleted)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function PATCH(req: NextRequest) {
  const { id, is_read, admin_reply, is_deleted, is_public, public_answer } = await req.json();
  if (!id) return NextResponse.json({ error: "id は必須です" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (is_read !== undefined) updates.is_read = is_read;
  if (admin_reply !== undefined) updates.admin_reply = admin_reply ?? null;
  if (is_deleted !== undefined) updates.is_deleted = is_deleted;
  if (is_public !== undefined) updates.is_public = is_public;
  if (public_answer !== undefined) updates.public_answer = public_answer ?? null;

  const { error } = await supabase.from("feedback").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id は必須です" }, { status: 400 });
  const { error } = await supabase.from("feedback").update({ is_deleted: true }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
