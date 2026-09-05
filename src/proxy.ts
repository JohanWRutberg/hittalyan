import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Optimistisk kontroll: har användaren ingen sessionscookie skickas den till /login.
// Riktig verifiering sker i server components via requireSession().
export function proxy(request: NextRequest) {
  const cookie = getSessionCookie(request);
  const { pathname } = request.nextUrl;

  // /app (listan) är öppen för alla i begränsat läge; allt under /app/... kräver inloggning
  if (pathname.startsWith("/app/") && !cookie) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }
  if ((pathname === "/login" || pathname === "/register") && cookie) {
    return NextResponse.redirect(new URL("/app", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/login", "/register"],
};
