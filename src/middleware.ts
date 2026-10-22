import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(function middleware(req) {
  const url = new URL(req.nextUrl.href);

  // After invite acceptance the accept page redirects to /dashboard?orgId=<id>.
  // Store it in a short-lived cookie so the layout's getDefaultOrgId can pick the right org.
  const preferOrgId = url.searchParams.get("orgId");
  if (url.pathname === "/dashboard" && preferOrgId) {
    const dest = new URL("/dashboard", req.url);
    // Preserve other params (e.g. invite=accepted) but strip orgId to avoid infinite loops.
    url.searchParams.forEach((v, k) => { if (k !== "orgId") dest.searchParams.set(k, v); });
    const res = NextResponse.redirect(dest);
    res.cookies.set("preferOrg", preferOrgId, { path: "/", maxAge: 300, httpOnly: true });
    return res;
  }

  return NextResponse.next();
}, {
  pages: { signIn: "/login" },
});

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*", "/api/safes/:path*", "/api/signer/:path*", "/api/teams", "/api/export/:path*"],
};
