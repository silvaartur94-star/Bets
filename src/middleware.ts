import { NextResponse, type NextRequest } from "next/server";

// Optional HTTP Basic Auth for the whole dashboard (any username, DASHBOARD_PASSWORD).
export function middleware(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password || req.nextUrl.pathname.startsWith("/api/cron")) return NextResponse.next();
  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    const [, pass] = atob(header.slice(6)).split(/:(.*)/s);
    if (pass === password) return NextResponse.next();
  }
  return new NextResponse("Autenticação necessária", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Apostas do Dia"' },
  });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
