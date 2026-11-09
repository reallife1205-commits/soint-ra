import { supabase } from "@/lib/supabaseClient";

// Vercel cron이 매일 호출 — Supabase 무료 프로젝트가 오래 안 쓰여 겨울잠에 빠지지 않게 DB에 작은 조회를 보낸다.
// 로그인 없이 열려 있으므로 데이터는 돌려주지 않고 성공 여부만 알린다.
export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await supabase.from("cases").select("id").limit(1);
  if (error) {
    return Response.json({ ok: false }, { status: 500 });
  }
  return Response.json({ ok: true });
}
