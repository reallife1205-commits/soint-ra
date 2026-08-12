import JSZip from "jszip";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// corpCode 원문(xml 텍스트)은 자주 안 바뀌니까, 서버가 켜져있는 동안은
// 메모리에 캐싱해서 재사용해요. 매번 10만 건 전체를 객체로 만들지 않고,
// 필요한 이름만 텍스트에서 직접 찾아서 훨씬 가볍게 처리해요.
let cachedXmlText = null;
let cachedAt = 0;
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6시간

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getCorpXmlText(apiKey) {
  const now = Date.now();
  if (cachedXmlText && now - cachedAt < CACHE_TTL_MS) {
    return cachedXmlText;
  }

  const res = await fetchWithTimeout(
    `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${apiKey}`,
    {},
    15000
  );
  if (!res.ok) {
    throw new Error("DART 회사 목록을 받아오지 못했어요 (인증키를 확인해주세요).");
  }

  const arrayBuffer = await res.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  const xmlFile = Object.values(zip.files)[0];
  if (!xmlFile) throw new Error("DART 회사 목록 파일 형식이 예상과 달라요.");

  const xmlText = await xmlFile.async("text");

  cachedXmlText = xmlText;
  cachedAt = now;
  return xmlText;
}

function extractBlock(xmlText, idx) {
  const start = xmlText.lastIndexOf("<list>", idx);
  const end = xmlText.indexOf("</list>", idx);
  if (start === -1 || end === -1) return null;
  return xmlText.slice(start, end);
}

function parseBlock(block) {
  const codeMatch = block.match(/<corp_code>([^<]*)<\/corp_code>/);
  const nameMatch = block.match(/<corp_name>([^<]*)<\/corp_name>/);
  return {
    corp_code: codeMatch ? codeMatch[1].trim() : null,
    corp_name: nameMatch ? nameMatch[1].trim() : null,
  };
}

// 텍스트 안에서 이름이 등장하는 곳을 찾아 그 주변 <list> 블록만 읽어요.
// 10만 건을 전부 훑지 않아서 훨씬 빨라요.
function findCandidates(xmlText, name, maxResults = 2) {
  const results = [];
  const seen = new Set();
  let searchFrom = 0;

  while (results.length < maxResults) {
    const idx = xmlText.indexOf(name, searchFrom);
    if (idx === -1) break;

    const block = extractBlock(xmlText, idx);
    if (block) {
      const parsed = parseBlock(block);
      if (parsed.corp_code && parsed.corp_name && !seen.has(parsed.corp_code)) {
        seen.add(parsed.corp_code);
        results.push(parsed);
      }
    }
    searchFrom = idx + name.length;
  }

  return results;
}

// "곽경수 외 1인" -> "곽경수" 처럼, DART에서 찾을 수 있는 형태로 이름을 정리해요.
function normalizeName(name) {
  return name.replace(/\s*외\s*\d+\s*인.*$/, "").trim();
}

async function fetchCompanyOverview(apiKey, corpCode) {
  try {
    const res = await fetchWithTimeout(
      `https://opendart.fss.or.kr/api/company.json?crtfc_key=${apiKey}&corp_code=${corpCode}`,
      {},
      5000
    );
    const data = await res.json();
    if (data.status !== "000") return null;
    return data;
  } catch {
    return null;
  }
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
    const xmlText = await getCorpXmlText(apiKey);

    const results = [];

    for (const rawName of names) {
      const name = normalizeName(rawName);
      if (!name) {
        results.push({ source_name: rawName, matches: [] });
        continue;
      }

      const candidates = findCandidates(xmlText, name, 2);

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
