import type { Role } from "@prisma/client";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { isBossIdentity, navigation } from "@/lib/rbac";

export default async function middleware(req: NextRequest) {
  const isAuthRoute = req.nextUrl.pathname.startsWith("/api/auth") || req.nextUrl.pathname === "/login" || req.nextUrl.pathname.startsWith("/invite/");
  const token = await getToken({ req, secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET });

  if (!token && !isAuthRoute) {
    const publicOrigin = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? req.nextUrl.origin;
    const login = new URL("/login", publicOrigin);
    const callback = new URL(`${req.nextUrl.pathname}${req.nextUrl.search}`, publicOrigin);
    login.searchParams.set("callbackUrl", callback.href);
    return Response.redirect(login);
  }

  const role = token?.role as Role | undefined;
  const email = typeof token?.email === "string" ? token.email : undefined;

  if (role) {
    if (req.nextUrl.pathname === "/boss-room" || req.nextUrl.pathname.startsWith("/boss-room/")) {
      if (!isBossIdentity(role, email)) {
        return new Response("Not found", { status: 404 });
      }
    }
    const protectedItem = navigation.find((item) => req.nextUrl.pathname === item.href || req.nextUrl.pathname.startsWith(`${item.href}/`));
    if (protectedItem && !protectedItem.roles.includes(role)) {
      return Response.redirect(new URL("/dashboard", req.nextUrl.origin));
    }
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icon-192.png|icon-512.png|scadacom-logo.png).*)"]
};
