import { hashPassword, AUTH_COOKIE_NAME } from "@/lib/authToken";

export async function POST(req) {
  const sitePassword = process.env.SITE_PASSWORD;
  if (!sitePassword) {
    return Response.json(
      { error: "서버에 비밀번호가 설정되어 있지 않아요. 관리자에게 문의하세요." },
      { status: 500 }
    );
  }

  const { password } = await req.json().catch(() => ({}));
  if (password !== sitePassword) {
    return Response.json({ error: "비밀번호가 올바르지 않아요." }, { status: 401 });
  }

  const token = await hashPassword(sitePassword);
  const res = Response.json({ ok: true });
  const maxAge = 60 * 60 * 24 * 30; // 30일
  res.headers.set(
    "Set-Cookie",
    `${AUTH_COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
  );
  return res;
}
