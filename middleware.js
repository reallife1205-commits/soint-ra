import { NextResponse } from "next/server";
import { hashPassword, AUTH_COOKIE_NAME } from "@/lib/authToken";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|login|api/login).*)"],
};

export async function middleware(req) {
  const sitePassword = process.env.SITE_PASSWORD;
  if (!sitePassword) {
    // 비밀번호가 설정 안 됐으면 접근을 막아 미설정 상태로 공개되지 않게 한다.
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  const cookie = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const expectedToken = await hashPassword(sitePassword);
  if (cookie === expectedToken) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}
