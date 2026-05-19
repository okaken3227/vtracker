import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const ADMIN_COOKIE = "admin_token";
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export function createAdminToken(password: string): string {
  return createHash("sha256").update("vtracker:" + password).digest("hex");
}

export function verifyAdminToken(token: string, password: string): boolean {
  return token === createAdminToken(password);
}

export function requireAdmin(req: NextRequest): NextResponse | null {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null; // dev mode: no password set
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!token || !verifyAdminToken(token, password)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
