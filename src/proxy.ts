import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/** Sidor som kräver inloggning. /lagenheter är öppen i begränsat läge. */
const PROTECTED = ["/bevakningar", "/konto", "/pro", "/admin", "/kontakt"];

// Optimistisk kontroll: saknas sessionscookie skickas man till /login.
// Riktig verifiering sker i server components via requireSession().
export function proxy(request: NextRequest) {
  const cookie = getSessionCookie(request);
  const { pathname } = request.nextUrl;

  if (!cookie && PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (cookie && (pathname === "/login" || pathname === "/register" || pathname === "/glomt-losenord")) {
    return NextResponse.redirect(new URL("/lagenheter", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/bevakningar/:path*", "/konto/:path*", "/pro/:path*", "/admin/:path*", "/kontakt/:path*", "/login", "/register", "/glomt-losenord"],
};
