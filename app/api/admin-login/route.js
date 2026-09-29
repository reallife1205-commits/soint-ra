import { hashPassword, ADMIN_AUTH_COOKIE_NAME } from "@/lib/authToken";

// 공유 사이트 비밀번호와 별개인 두 번째 비밀번호(ADMIN_PASSWORD) — 배정 현황 편집·공지사항
// 작성처럼 관리자만 해야 하는 기능을 잠그는 용도. 로그인 방식은 /api/login과 동일하게
// HttpOnly 쿠키에 해시만 저장한다.
export async function POST(req) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return Response.json(
      { error: "서버에 관리자 비밀번호가 설정되어 있지 않아요." },
      { status: 500 }
    );
  }

  const { password } = await req.json().catch(() => ({}));
  if (password !== adminPassword) {
    return Response.json({ error: "비밀번호가 올바르지 않아요." }, { status: 401 });
  }

  const token = await hashPassword(adminPassword);
  const res = Response.json({ ok: true });
  const maxAge = 60 * 60 * 24 * 30; // 30일
  res.headers.set(
    "Set-Cookie",
    `${ADMIN_AUTH_COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
  );
  return res;
}

// 클라이언트(공유 컴포넌트)에서 새로고침 후에도 관리자 상태를 알 수 있어야 해서, 쿠키를
// 서버에서 검증한 결과만 내려준다(HttpOnly라 클라이언트 JS는 쿠키 값 자체를 못 읽음).
export async function GET(req) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return Response.json({ isAdmin: false });

  const cookie = req.cookies.get(ADMIN_AUTH_COOKIE_NAME)?.value;
  const expectedToken = await hashPassword(adminPassword);
  return Response.json({ isAdmin: cookie === expectedToken });
}
