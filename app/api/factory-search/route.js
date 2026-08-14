export const maxDuration = 30;
export const dynamic = "force-dynamic";

const BASE_URL =
  "https://apis.data.go.kr/B550624/fctryRegistLndpclInfo/getFctryLndpclService";

async function searchOne(apiKey, name) {
  const params = new URLSearchParams({
    serviceKey: apiKey,
    cmpnyNm: name,
    type: "json",
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

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      const err = new Error(
        "공장등록 조회 응답을 이해하지 못했어요 (인증키를 확인해주세요)."
      );
      err.debugDetail = text.slice(0, 500);
      throw err;
    }

    const resultCode = data?.response?.header?.resultCode;
    if (resultCode && resultCode !== "00") {
      const err = new Error(
        `공장등록 조회 API 에러: ${data.response.header.resultMsg || resultCode}`
      );
      err.debugDetail = JSON.stringify(data.response.header);
      throw err;
    }

    const body = data?.response?.body;
    const rawItems = body?.items?.item;
    const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

    return items.map((item) => ({
      fctry_manage_no: item.fctryManageNo || null,
      cmpny_nm: item.cmpnyNm || null,
      road_address: item.rnAdres || null,
      rprsntv_nm: item.rprsntvNm || null,
      org_nm: item.cvplChrgOrgnztNm || null,
      tel_no: item.cmpnyTelno || null,
      land_area: item.fctryLndpclAr || null,
      building_area: item.fctryDongBuldAr || null,
      use_area: item.spfcSeCodeNm || null,
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
