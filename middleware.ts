// middleware.ts
// Next.js middleware — auth check + tenant isolation
import { NextRequest, NextResponse } from "next/server";

// Public routes yang tidak perlu auth
const PUBLIC_ROUTES = [
  "/login",
  "/register",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/sso-verify",
  "/api/health",
  "/api/admin/cross-app",
  "/sso",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip public routes
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  // Skip static files & Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Cek session cookie
  const sessionId = req.cookies.get("session_id")?.value;

  if (!sessionId) {
    // Redirect ke login
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Add session_id ke header untuk backend
  const headers = new Headers(req.headers);
  headers.set("x-session-id", sessionId);

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
