import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;

  // No password configured → allow through (open during initial setup)
  if (!password) return NextResponse.next();

  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    try {
      const decoded = atob(auth.slice(6));
      const colonIdx = decoded.indexOf(":");
      const entered = colonIdx >= 0 ? decoded.slice(colonIdx + 1) : decoded;
      if (entered === password) return NextResponse.next();
    } catch {
      // malformed base64 → fall through to 401
    }
  }

  return new NextResponse("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Admin"',
      "Content-Type": "text/plain",
    },
  });
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
