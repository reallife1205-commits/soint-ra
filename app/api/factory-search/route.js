export const maxDuration = 30;
export const dynamic = "force-dynamic";

const BASE_URL =
  "https://apis.data.go.kr/B550624/fctryRegistLndpclInfo/getFctryLndpclService";

function extractTag(text, tag) {
  const re = new RegExp(`<${tag}>([^<]*)<\\/${tag}>`);
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

function extractItemBlocks(xmlText) {
  const blocks = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xmlText))) {
    blocks.push(m[1]);
  }
  return blocks;
}

async function searchOne(apiKey, name) {
  const params = new URLSearchParams({
    serviceKey: apiKey,
    cmpnyNm: name,
    numOfRows: "5",
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${BASE_URL}?${params.toString()}`, {
      signal: controller.signal,
    });
    const text = await res.text();

    if (!res.ok) {
      const err = new Error(`공장등록 조회 서버가 오류를 돌려줬어요 (HTTP ${res.status})`);
      err.debugDetail = text.slice(0, 500);
      throw err;
    }

    // 이 API는 type=json 을 요청해도 XML로 응답할 때가 있어서, XML을 직접 읽어요.
    const resultCode = extractTag(text, "resultCode");
    if (resultCode && resultCode !== "00") {
      const err = new Error(
        `공장등록 조회 API 에러: ${extractTag(text, "resultMsg") || resultCode}`
      );
      err.debugDetail = text.slice(0, 500);
      throw err;
    }

    const itemBlocks = extractItemBlocks(text);

    return itemBlocks.map((block) => ({
      fctry_manage_no: extractTag(block, "fctryManageNo"),
      cmpny_nm: extractTag(block, "cmpnyNm"),
      road_address: extractTag(block, "rnAdres"),
      rprsntv_nm: extractTag(block, "rprsntvNm"),
      org_nm: extractTag(block, "cvplChrgOrgnztNm"),
      tel_no: extractTag(block, "cmpnyTelno"),
      land_area: extractTag(block, "fctryLndpclAr"),
      building_area: extractTag(block, "fctryDongBuldAr"),
      use_area: extractTag(block, "spfcSeCodeNm"),
    }));
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req) {
  const { names } = await req.json();

  if (!names || !Array.isArray(names) || names.length === 0) {
    return Response.json({ error: "검색할 이름이 없어요" }, { status: 400 });
  }

  const apiKey = process.env.FACTORY_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "공장등록 조회 API 키가 설정되지 않았어요" },
      { status: 500 }
    );
  }

  try {
    const results = [];
    for (const rawName of names) {
      const name = rawName.replace(/\s*외\s*\d+\s*인.*$/, "").trim();
      if (!name) {
        results.push({ source_name: rawName, matches: [] });
        continue;
      }
      const matches = await searchOne(apiKey, name);
      results.push({ source_name: rawName, matches });
    }

    return Response.json({ results });
  } catch (e) {
    return Response.json(
      {
        error: e.message || "공장등록 조회 중 문제가 발생했어요",
        debugDetail: e.debugDetail || null,
        debugStack: String(e.stack || "").slice(0, 500),
      },
      { status: 500 }
    );
  }
}
