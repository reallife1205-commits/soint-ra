// 공유 비밀번호를 쿠키에 그대로 저장하지 않기 위한 해시. Edge(middleware)와
// Node(API route) 양쪽에서 동작해야 해서 Web Crypto(crypto.subtle)를 사용한다.
export async function hashPassword(password) {
  const enc = new TextEncoder();
  const data = enc.encode(`${password}:todam-site-gate`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const AUTH_COOKIE_NAME = "todam_auth";

// 공유 비밀번호(누구나 아는 것)와 별개로, 배정 현황 편집·공지사항 작성처럼 "관리자만" 손대야
// 하는 몇몇 기능을 잠그는 두 번째 비밀번호용 쿠키.
export const ADMIN_AUTH_COOKIE_NAME = "todam_admin_auth";
