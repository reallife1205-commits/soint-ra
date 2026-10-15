// 큰 사진은 올리기 전에 브라우저에서 줄인다. 화면 캡처한 항공사진(PNG)은 한 장에 10MB를 넘기도 해서
// 저장소(Supabase) 파일 용량 한도에 걸려 "The object exceeded the maximum allowed size"로 실패했다.
// 긴 변 MAX_SIDE px의 JPG로 바꾸면 보고서에 넣기에 충분한 화질이고 내보낸 한글 파일도 가벼워진다.
// 이미지가 아니거나(문서 등) 이미 작은 사진은 그대로 돌려준다.

const MAX_SIDE = 2400;
const SKIP_BELOW_BYTES = 1.5 * 1024 * 1024;
const RESIZABLE = /^image\/(png|jpeg|webp|bmp)$/;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

export async function shrinkImageForUpload(file) {
  if (!file || !RESIZABLE.test(file.type)) return file;
  let img;
  try {
    img = await loadImage(file);
  } catch {
    return file;
  }
  const longSide = Math.max(img.naturalWidth, img.naturalHeight);
  if (file.size <= SKIP_BELOW_BYTES && longSide <= MAX_SIDE) return file;

  const scale = Math.min(1, MAX_SIDE / longSide);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d");
  // JPG엔 투명이 없어 PNG의 투명 부분이 검게 되지 않도록 흰 바탕을 먼저 깐다
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob || blob.size >= file.size) return file;
  // 보고서 내보내기가 파일 이름의 확장자로 그림 형식을 정하므로 이름도 .jpg로 맞춘다(연도 등 이름은 유지)
  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}

// 올리기 전에 막아야 하는 파일이면 안내 문구를, 아니면 null. TIF(국토정보맵 항공사진)는 수백 MB라
// 저장소 한도를 넘고 브라우저가 열지도 줄이지도 못한다.
export function uploadBlockReason(file) {
  if (/\.tiff?$/i.test(file?.name || "") || file?.type === "image/tiff") {
    return "TIF 파일은 올릴 수 없어요. JPG나 PNG로 바꿔서 올려 주세요(항공사진은 부지 부분을 캡처해서 올리면 좋아요).";
  }
  return null;
}

// 저장소 오류를 알아듣기 쉬운 말로
export function friendlyUploadError(message) {
  if (/maximum allowed size/i.test(message || "")) {
    return "파일이 너무 커서 올리지 못했어요. 사진은 JPG·PNG로, 문서는 필요한 부분만 저장해서 올려 주세요.";
  }
  return `업로드에 실패했어요: ${message}`;
}
