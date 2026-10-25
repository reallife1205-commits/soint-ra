// 4장 현장 사진. 예전 화면은 항목 칸(아래 이름)마다 사진을 한 장씩 올리고 documents.photo_note에 칸 이름을 넣었다.
// 지금은 한 목록으로 올리지만, 예전에 칸으로 올린 사진은 photo_note에 칸 이름이 남아 있어 순서·제목 판단에 쓴다.
// 보고서 사진 제목은 칸 이름이 아니라 사용자가 적은 documents.caption을 쓴다(sql/027).
export const PHOTO_CATEGORIES = [
  "특정토양오염관리대상시설",
  "토양 표면상태, 식물 생장상태",
  "지하수 관측시설 설치 및 사용",
  "오염지역의 누출흔적",
  "각종 폐기물의 매립 또는 방치",
  "기타",
];

// 보고서에 싣는 현장 사진 수(템플릿 사진 표 칸 수)
export const MAX_FIELD_PHOTOS = 9;

// 현장 사진 제목은 사용자가 적은 것만 쓴다. caption이 우선이고, 예전 추가 사진은 올릴 때 적은 설명(photo_note)이 제목이다.
// 칸 이름(photo_note = "특정토양오염관리대상시설" 등)은 칸 구분용이라 제목으로 쓰지 않는다. 설명 없이 올리면
// 화면이 파일 이름을 대신 넣어 두므로(IMG_1234.jpg, 캡처_2026-… 등) 그것도 빈칸으로 둔다.
export function fieldPhotoCaption(doc) {
  const caption = (doc.caption || "").trim();
  if (caption) return caption;
  const note = (doc.photo_note || "").trim();
  if (!note || PHOTO_CATEGORIES.includes(note)) return "";
  if (note === doc.file_name || /^캡처_\d{4}-\d{2}-\d{2}_\d{6}(\.\w+)?$/.test(note)) return "";
  return note;
}

// 예전 항목 칸 사진이 칸 순서대로 앞에 오고, 나머지는 올린 순서대로. 화면과 보고서가 같은 순서를 쓴다.
export function sortFieldPhotos(docs) {
  const rank = (d) => {
    const i = PHOTO_CATEGORIES.indexOf(d.photo_note);
    return i === -1 ? PHOTO_CATEGORIES.length : i;
  };
  return [...docs].sort(
    (a, b) => rank(a) - rank(b) || String(a.uploaded_at).localeCompare(String(b.uploaded_at))
  );
}
