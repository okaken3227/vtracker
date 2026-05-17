import { createHash } from "crypto";

export const ADMIN_COOKIE = "admin_token";
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export function createAdminToken(password: string): string {
  return createHash("sha256").update("vtracker:" + password).digest("hex");
}

export function verifyAdminToken(token: string, password: string): boolean {
  return token === createAdminToken(password);
}
