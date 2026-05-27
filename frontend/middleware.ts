import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public routes that don't need auth
const PUBLIC_PATHS = [
  "/",
  "/auth/login",
  "/auth/register",
  "/api/",
  "/_next/",
  "/favicon.ico",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  for (const path of PUBLIC_PATHS) {
    if (pathname.startsWith(path)) {
      return NextResponse.next();
    }
  }

  // Check auth token
  const token = request.cookies.get("aisb-auth");
  if (!token) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};