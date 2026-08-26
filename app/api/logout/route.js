import { AUTH_COOKIE_NAME } from "@/lib/authToken";

export async function POST() {
  const res = Response.json({ ok: true });
  res.headers.set(
    "Set-Cookie",
    `${AUTH_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
  );
  return res;
}
