import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, verifySessionToken } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  const session = await verifySessionToken(req.cookies.get(AUTH_COOKIE)?.value);

  // 1) Login/logout endpoints must be reachable without a session
  const openAuthPaths = ["/admin/login", "/api/auth/login", "/api/auth/logout"];
  if (openAuthPaths.includes(pathname)) {
    return NextResponse.next();
  }

  // 2) Authenticated requests go through
  if (session) return NextResponse.next();

  // 3) Dashboard without session → redirect to login page
  if (pathname.startsWith("/admin")) {
    const url = new URL("/admin/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // 4) Write/admin APIs without session → 401. Public GET reads stay open:
  //    /api/albums/* and published /api/sites/*/content (no draft flag)
  if (pathname.startsWith("/api")) {
    const method = req.method.toUpperCase();
    const publicRead =
      method === "GET" && (pathname.startsWith("/api/albums/") || !pathname.startsWith("/api/sites/"));
    if (publicRead) return NextResponse.next();
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 5) Draft preview on site pages requires a session
  if (searchParams.get("draft") === "1") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*", "/api/:path*", "/((?!_next|favicon|images|reels).*)"],
};
