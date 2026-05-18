import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import type { Group, GroupCategory } from "@/lib/types";

export async function GET() {
  const { data, error } = await supabase
    .from("groups")
    .select("*")
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const { id, name, color, icon_url, keywords, parent_group_id, category } = await req.json();
  if (!id || !name) {
    return NextResponse.json({ error: "id と name は必須です" }, { status: 400 });
  }
  const group: Omit<Group, "created_at"> = {
    id: id.trim().toLowerCase().replace(/\s+/g, "_"),
    name: name.trim(),
    color: color ?? "#8b5cf6",
    category: (category as GroupCategory) ?? "vtuber",
    ...(icon_url ? { icon_url: icon_url.trim() } : {}),
    ...(keywords ? { keywords: keywords.trim() } : {}),
    ...(parent_group_id ? { parent_group_id: parent_group_id.trim() } : {}),
  };
  const { error } = await supabase.from("groups").insert(group);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, group });
}

export async function PATCH(req: NextRequest) {
  const { id, icon_url, keywords, parent_group_id, name, color, category, sort_order } = await req.json();
  if (!id) return NextResponse.json({ error: "id は必須です" }, { status: 400 });
  const updates: Partial<Group> = {};
  if (name !== undefined) updates.name = name.trim();
  if (color !== undefined) updates.color = color;
  if (category !== undefined) updates.category = category as GroupCategory || null;
  if (icon_url !== undefined) updates.icon_url = icon_url || null;
  if (keywords !== undefined) updates.keywords = keywords || null;
  if (parent_group_id !== undefined) updates.parent_group_id = parent_group_id || null;
  if (sort_order !== undefined) updates.sort_order = sort_order;
  const { error } = await supabase.from("groups").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id は必須です" }, { status: 400 });
  const { error } = await supabase.from("groups").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
