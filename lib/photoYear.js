// 항공사진 파일 이름에 촬영연도가 들어 있으면(예: "2024년.png", "항공_1996.jpg") 그 연도를 돌려준다.
// 1900~2099의 네 자리 숫자만 본다(날짜 형식 "2024-05-01"이면 앞의 연도). 없으면 null.
export function yearFromFileName(name) {
  const m = String(name || "").match(/(?:^|\D)((?:19|20)\d{2})(?!\d)/);
  return m ? parseInt(m[1], 10) : null;
}
