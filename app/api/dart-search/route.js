import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

// corpCode 목록은 자주 안 바뀌니까, 서버가 켜져있는 동안은 메모리에 캐싱해서 재사용해요.
let cachedCorpList = null;
let cachedAt = 0;
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6시간

async function getCorpList(apiKey) {
  const now = Date.now();
  if (cachedCorpList && now - cachedAt < CACHE_TTL_MS) {
    return cachedCorpList;
  }

  const res = await fetch(
    `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${apiKey}`
  );
  if (!res.ok) {
    throw new Error("DART 회사 목록을 받아오지 못했어요 (인증키를 확인해주세요).");
  }

  const arrayBuffer = await res.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  const xmlFile = Object.values(zip.files)[0];
  if (!xmlFile) throw new Error("DART 회사 목록 파일 형식이 예상과 달라요.");

  const xmlText = await xmlFile.async("text");
  const parser = new XMLParser();
  const parsed = parser.parse(xmlText);

  const list = parsed?.result?.list;
  const corpList = Array.isArray(list) ? list : list ? [list] : [];

  cachedCorpList = corpList;
  cachedAt = now;
  return corpList;
}

// "곽경수 외 1인" -> "곽경수" 처럼, DART에서 찾을 수 있는 형태로 이름을 정리해요.
function normalizeName(name) {
  return name.replace(/\s*외\s*\d+\s*인.*$/, "").trim();
}

async function fetchCompanyOverview(apiKey, corpCode) {
  const res = await fetch(
    `https://opendart.fss.or.kr/api/company.json?crtfc_key=${apiKey}&corp_code=${corpCode}`
  );
  const data = await res.json();
  if (data.status !== "000") return null;
  return data;
}

export async function POST(req) {
  const { names } = await req.json();

  if (!names || !Array.isArray(names) || names.length === 0) {
    return Response.json({ error: "검색할 이름이 없어요" }, { status: 400 });
  }

  const apiKey = process.env.DART_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "DART API 키가 설정되지 않았어요" },
      { status: 500 }
    );
  }

  try {
    const corpList = await getCorpList(apiKey);

    const results = [];

    for (const rawName of names) {
      const name = normalizeName(rawName);
      if (!name) {
        results.push({ source_name: rawName, matches: [] });
        continue;
      }

      const candidates = corpList
        .filter((c) => c.corp_name && c.corp_name.includes(name))
        .slice(0, 3);

      const matches = [];
      for (const c of candidates) {
        const overview = await fetchCompanyOverview(apiKey, c.corp_code);
        matches.push({
          corp_code: c.corp_code,
          corp_name: c.corp_name,
          ceo_name: overview?.ceo_nm || null,
          biz_no: overview?.bizr_no || null,
          address: overview?.adres || null,
          corp_cls: overview?.corp_cls || null,
        });
      }

      results.push({ source_name: rawName, matches });
    }

    return Response.json({ results });
  } catch (e) {
    return Response.json(
      { error: e.message || "DART 검색 중 문제가 발생했어요" },
      { status: 500 }
    );
  }
}
