import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;

    if (pathname === "/login" && token) {
      const nextUrl = req.nextUrl.clone();
      nextUrl.pathname = token.role === "ADMIN" ? "/admin" : "/";
      return NextResponse.redirect(nextUrl);
    }

    if (pathname.startsWith("/admin") && token?.role !== "ADMIN") {
      const nextUrl = req.nextUrl.clone();
      nextUrl.pathname = "/";
      return NextResponse.redirect(nextUrl);
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        if (pathname === "/login") return true;

        if (
          pathname.startsWith("/dashboard")
          || pathname.startsWith("/cases")
          || pathname.startsWith("/admin")
        ) {
          return Boolean(token);
        }

        return true;
      },
    },
  },
);

export const config = {
  matcher: ["/login", "/dashboard/:path*", "/cases/:path*", "/admin/:path*"],
};