import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { buildReportHwpx } from "@/lib/hwpxReportBuilder";
import { currentOwnerNames, isEmptyLeaseRow } from "@/lib/currentOwner";
import { MAX_FIELD_PHOTOS, fieldPhotoCaption, sortFieldPhotos } from "@/lib/fieldPhotos";
import { yearFromFileName } from "@/lib/photoYear";
import {
  SITE_CONTAMINATION_CATEGORY,
  defaultSources,
  sourceCheckboxLine,
  buildSiteContaminationDraft,
} from "@/lib/siteContaminationDraft";
import {
  SURROUNDING_STATUS_CATEGORY,
  defaultSurroundingSources,
  surroundingCheckboxLine,
  buildSurroundingDraft,
} from "@/lib/surroundingContaminationDraft";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Next.js App Router가 supabase-js 내부 fetch 호출까지 캐시해버려서(라우트의
// dynamic = "force-dynamic"이 SDK 내부 fetch에는 적용되지 않음), 오래된 데이터 스냅샷이
// 배포가 바뀌어도 계속 서빙되는 문제가 있었다. fetch를 명시적으로 no-store로 강제한다.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { global: { fetch: (url, options) => fetch(url, { ...options, cache: "no-store" }) } }
);

const DEFAULT_RADIUS_KM = 4;
const IMAGE_TYPE_BY_EXT = { png: "png", jpg: "jpg", jpeg: "jpg", gif: "gif", bmp: "bmp" };

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchReferenceSoilData(lat, lon, radiusKm) {
  if (lat == null || lon == null) return [];
  const latDelta = radiusKm / 111;
  const lonDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  const { data, error } = await supabaseAdmin
    .from("reference_soil_data")
    .select("*")
    .gte("lat", lat - latDelta)
    .lte("lat", lat + latDelta)
    .gte("lon", lon - lonDelta)
    .lte("lon", lon + lonDelta)
    .limit(1000);
  if (error) return [];
  return (data || [])
    .map((row) => ({ ...row, distance: haversineKm(lat, lon, row.lat, row.lon) }))
    .filter((row) => row.distance <= radiusKm);
}

function judgmentByCategory(rowDataList, category) {
  return rowDataList.find((d) => d.category === category) || null;
}

// category: 생략하면 카테고리 무관하게(현장사진처럼 photo_note를 자유 캡션으로 쓰는 경우),
// null이면 category가 비어있는 문서만(사이드바 "참고 문서" 업로드), 문자열이면 그 카테고리만
// (예: 1번 모듈의 "sample_points") 가져온다. orderByYear를 켜면 업로드 순서 대신 사진마다
// 지정한 photo_year(오래된 연도부터)로 정렬한다 — 항공사진처럼 "표에 넣는 순서 = 촬영 연도
// 순서"라 업로드한 순서(uploaded_at)와는 무관해야 하는 경우에 씀. 연도를 안 지정한 사진은
// 뒤로 밀려 남은 칸에 채워진다.
// 사진 제목·현장 사진 순서 규칙은 4장 화면과 같이 쓰도록 lib/fieldPhotos.js에 있다.

// latest: 사진 한 장만 들어가는 자리(배치도·오염분포도 등)용. 오래된 것부터 limit장을 자르면
// limit장보다 많이 올렸을 때 최근 사진이 잘려나가 엉뚱한 사진이 들어갔다 — 최근 limit장을 가져와
// 오래된 순으로 돌려준다(latestImage가 배열의 마지막을 씀).
async function fetchImages(caseId, moduleNumber, limit, category, orderByYear = false, latest = false) {
  let query = supabaseAdmin
    .from("documents")
    .select("*")
    .eq("case_id", caseId)
    .eq("module_number", moduleNumber);
  if (category === null) query = query.is("category", null);
  else if (category !== undefined) query = query.eq("category", category);
  if (orderByYear) query = query.order("photo_year", { ascending: true, nullsFirst: false });
  query = query.order("uploaded_at", { ascending: !orderByYear && !latest });
  // 현장 사진(6번)은 4장 화면과 같은 순서로 정렬한 뒤 앞에서부터 자른다 — 올린 순서로 먼저 자르면
  // 예전 항목 칸 사진이 잘려나갈 수 있다.
  let { data: docs } = await (moduleNumber === 6 ? query : query.limit(limit));

  if (!docs?.length) return [];
  if (latest) docs.reverse();
  if (moduleNumber === 6) docs = sortFieldPhotos(docs).slice(0, limit);

  const images = await Promise.all(docs.map(downloadImage));
  return images.filter(Boolean);
}

async function downloadImage(doc) {
  const ext = (doc.file_name.match(/\.([^.]+)$/)?.[1] || "").toLowerCase();
  const type = IMAGE_TYPE_BY_EXT[ext];
  if (!type) return null;
  const { data: blob, error } = await supabaseAdmin.storage.from("documents").download(doc.file_path);
  if (error || !blob) return null;
  const buf = Buffer.from(await blob.arrayBuffer());
  // year: 항공사진 칸 아래 "OOOO년" 글자용 — 화면에서 지정한 연도, 없으면 파일 이름의 연도
  return { data: buf, type, caption: fieldPhotoCaption(doc), year: doc.photo_year || yearFromFileName(doc.file_name) };
}

// 3.4 "<그림> 배치도면" 자리에 넣을 사진 한 장. 우선순위(화면 Module3Panel 안내문과 같게):
// ① 챕터03 "배치도 등"에 올린 사진 중 이름에 "배치도"가 들어간 것 → ② "부지전경"이 들어간 것
// → ③ 항공사진 중 가장 최근 연도(연도 안 적은 사진은 뒤로, 같은 연도면 나중에 올린 것).
// 같은 이름이 여러 장이면 가장 최근에 올린 것. 이름은 띄어쓰기 무시("부지 전경"도 인정).
const SITE_PLAN_NAME_PRIORITY = ["배치도", "부지전경"];

async function fetchSitePlanImage(caseId) {
  const { data: plans } = await supabaseAdmin
    .from("documents")
    .select("*")
    .eq("case_id", caseId)
    .eq("module_number", 3)
    .eq("category", "site_plan")
    .order("uploaded_at", { ascending: false });
  const nameOf = (doc) => doc.file_name.replace(/\.[^.]+$/, "").replace(/\s/g, "");
  for (const keyword of SITE_PLAN_NAME_PRIORITY) {
    for (const doc of (plans || []).filter((d) => nameOf(d).includes(keyword))) {
      const img = await downloadImage(doc);
      if (img) return [img];
    }
  }

  const { data: aerials } = await supabaseAdmin
    .from("documents")
    .select("*")
    .eq("case_id", caseId)
    .eq("module_number", 4)
    .order("photo_year", { ascending: false, nullsFirst: false })
    .order("uploaded_at", { ascending: false })
    .limit(5);
  for (const doc of aerials || []) {
    const img = await downloadImage(doc);
    if (img) return [img];
  }
  return [];
}

async function fetchCaseData(caseId) {
  const [
    { data: caseInfo },
    { data: overviewRows },
    { data: contaminationRows },
    { data: module2Rows },
    { data: ownershipRows },
    { data: factoryHistoryRows },
    { data: fieldSurvey },
    { data: scientificRows },
  ] = await Promise.all([
    supabaseAdmin.from("cases").select("*").eq("id", caseId).single(),
    supabaseAdmin.from("module_rows").select("row_data").eq("case_id", caseId).eq("module_number", 0),
    supabaseAdmin.from("module_rows").select("row_data").eq("case_id", caseId).eq("module_number", 1).order("row_order", { ascending: true }), // 2.1 본문의 물질 순서를 표와 같게
    supabaseAdmin.from("module_rows").select("row_data").eq("case_id", caseId).eq("module_number", 2),
    supabaseAdmin.from("module_rows").select("row_data").eq("case_id", caseId).eq("module_number", 3).order("row_order", { ascending: true }),
    supabaseAdmin.from("module_rows").select("row_data").eq("case_id", caseId).eq("module_number", 5),
    supabaseAdmin.from("field_surveys").select("*").eq("case_id", caseId).maybeSingle(),
    supabaseAdmin.from("module_rows").select("row_data").eq("case_id", caseId).eq("module_number", 8).order("updated_at", { ascending: false, nullsFirst: false }), // 행이 여러 개면 가장 최근 것
  ]);

  if (!caseInfo) return null;

  const m0 = (overviewRows || []).map((r) => r.row_data);
  const m2 = (module2Rows || []).map((r) => r.row_data);
  const m3 = (ownershipRows || []).map((r) => r.row_data);
  const m5 = (factoryHistoryRows || []).map((r) => r.row_data);
  const m8 = (scientificRows || []).map((r) => r.row_data);
  const scientificAnalysis = m8.find((d) => d.category === "scientific_analysis")?.content || "";
  const module2Settings = m2.find((d) => d.category === "settings");
  const surroundingRadius =
    typeof module2Settings?.radius === "number" ? module2Settings.radius : DEFAULT_RADIUS_KM;
  const selectedSubstances = module2Settings ? module2Settings.selected || [] : null;

  const overviewData = m0.find((d) => d.category === "overview") || {};
  // 2.1 본문: 저장된 게 없거나 내용이 비어 있으면 표 내용으로 초안을 만들어 넣는다(화면의 "초안 만들기"와 같은 규칙).
  const siteStatusSaved = m0.find((d) => d.category === SITE_CONTAMINATION_CATEGORY);
  const siteSources = siteStatusSaved ? siteStatusSaved.sources || [] : defaultSources(overviewData);
  const siteContamination = {
    checkboxLine: sourceCheckboxLine(siteSources, siteStatusSaved?.other_text),
    content:
      (siteStatusSaved?.content || "").trim() ||
      buildSiteContaminationDraft({
        contaminationRows: (contaminationRows || []).map((r) => r.row_data),
        overview: overviewData,
        sources: siteSources,
      }),
  };
  const progressItems = m0
    .filter((d) => d.category === "progress")
    .map((d) => ({ date: d.date, description: d.description }))
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const currentOwners = currentOwnerNames(m3);

  const [
    soilDataRows,
    aerialImages,
    fieldPhotoImages,
    samplePointImages,
    pollutionMapImages,
    surroundingImages,
    sitePlanImages,
  ] = await Promise.all([
    // 2.2 화면에서 검색한 반경(설정에 저장됨)을 쓴다 — 예전엔 늘 4km라 화면·본문과 [표 2]/[표 3]이 달랐다.
    fetchReferenceSoilData(caseInfo.lat, caseInfo.lon, surroundingRadius),
    // 항공사진은 표에 "오래된 연도부터" 채워지므로 업로드 순서가 아니라 사진마다 지정한
    // photo_year 순으로 가져온다(4번 모듈 태깅 화면에서 연도 입력).
    fetchImages(caseId, 4, 8, undefined, true),
    fetchImages(caseId, 6, MAX_FIELD_PHOTOS),
    // "그림 시료채취지점" 자리의 대체용(오염분포도가 없을 때만 씀) — category=sample_points
    fetchImages(caseId, 1, 5, "sample_points", false, true),
    // 2.1 "<그림> 토양시료 채취 지점 및 기준 초과 현황"엔 오염분포도가 들어간다(챕터01
    // "오염분포도" 탭 업로드, category=pollution_map)
    fetchImages(caseId, 1, 5, "pollution_map", false, true),
    // 2.2 "주변부지 조사 지점" 지도 캡처(챕터02 지도 화면의 "화면 캡처해서 저장" 버튼)
    fetchImages(caseId, 2, 5, "surrounding_map", false, true),
    // 3.4 배치도면: 이름 "배치도" → "부지전경" → 최근 연도 항공사진 순(fetchSitePlanImage 주석)
    fetchSitePlanImage(caseId),
  ]);
  const networkRows = soilDataRows.filter((r) => r.source_type === "측정망");
  const surveyRows = soilDataRows.filter((r) => r.source_type === "실태조사");

  // 2.2 본문: 화면 입력이 비어 있으면 검색 결과로 초안을 만들어 넣는다(화면의 "초안 만들기"와 같은 규칙).
  const surroundingSaved = m2.find((d) => d.category === SURROUNDING_STATUS_CATEGORY);
  const surroundingSources = surroundingSaved
    ? surroundingSaved.sources || []
    : defaultSurroundingSources(networkRows, surveyRows);
  const surroundingContamination = {
    checkboxLine: surroundingCheckboxLine(surroundingSources),
    content:
      (surroundingSaved?.content || "").trim() ||
      buildSurroundingDraft({
        networkRows,
        surveyRows,
        radius: surroundingRadius,
        selectedSubstances,
        regionGrade: caseInfo.region_grade,
      }),
  };

  const legalJudgment = judgmentByCategory(m3, "legal");

  return {
    caseInfo,
    overview: {
      advisory_subject: overviewData.advisory_subject || "",
      application_number: overviewData.application_number || "",
      investigation_start: overviewData.investigation_start || "",
      investigation_end: overviewData.investigation_end || "",
      sido_opinion: overviewData.sido_opinion || "",
      responsible_party_opinion_type: overviewData.responsible_party_opinion_type || "의견서",
      responsible_party_opinion_other: overviewData.responsible_party_opinion_other || "",
      responsible_party_opinion_text: overviewData.responsible_party_opinion_text || "",
      progressItems,
      currentOwners,
    },
    contaminationRows: (contaminationRows || []).map((r) => r.row_data).filter((d) => d.contaminant),
    networkRows,
    surveyRows,
    selectedSubstances,
    ownership: {
      ownershipRows: m3.filter((d) => d.category === "ownership"),
      leaseRows: m3.filter((d) => d.category === "lease" && !isEmptyLeaseRow(d)),
    },
    factoryHistoryItems: m5.filter((d) => d.category === "factory_history_item"),
    judgments: {
      ownership_lease: judgmentByCategory(m3, "ownership_lease"),
      soil_assessment: judgmentByCategory(m3, "soil_assessment"),
      cost_capacity: judgmentByCategory(m3, "cost_capacity"),
      access: judgmentByCategory(m3, "access"),
      agreement: judgmentByCategory(m3, "agreement"),
      management_history: judgmentByCategory(m3, "management_history"),
    },
    legalSummary: legalJudgment?.summary || "",
    costCapacityItems: m3.filter((d) => d.category === "cost_capacity_item"),
    aerialImages,
    fieldPhotoImages,
    // 2.1 "<그림> 토양시료 채취 지점 및 기준 초과 현황"엔 오염분포도(pollution_map, 없으면
    // 시료채취지점 사진으로 대체)가 들어간다. "[표 1] 오염면적 및 오염범위(총괄)"은 화면 캡처가
    // 아니라 contaminationRows 데이터로 만든 네이티브 표라 별도 이미지가 필요 없다.
    samplePointImages,
    pollutionMapImages: pollutionMapImages.length ? pollutionMapImages : samplePointImages,
    surroundingImages,
    sitePlanImages,
    fieldSurvey,
    scientificAnalysis,
    siteContamination,
    surroundingContamination,
  };
}

export async function GET(req, { params }) {
  const { id: caseId } = await params;
  if (!caseId) {
    return Response.json({ error: "caseId가 필요해요" }, { status: 400 });
  }

  try {
    const payload = await fetchCaseData(caseId);
    if (!payload) {
      return Response.json({ error: "해당 안건을 찾을 수 없어요" }, { status: 404 });
    }

    const templatePath = path.join(process.cwd(), "templates", "report-template.hwpx");
    const templateBuffer = fs.readFileSync(templatePath);
    const buffer = await buildReportHwpx(templateBuffer, payload);
    // 안건 번호 뒤에 업체명을 붙인다. 윈도우 파일 이름에 못 쓰는 글자는 뺀다.
    const company = String(payload.caseInfo.company_name || "").replace(/[\\/:*?"<>|]/g, "").trim();
    const fileName = encodeURIComponent(
      `기술검토보고서_초안_${payload.caseInfo.case_number || caseId}${company ? `_${company}` : ""}.hwpx`
    );

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${fileName}`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (e) {
    return Response.json({ error: e.message || "보고서 생성 중 문제가 발생했어요" }, { status: 500 });
  }
}
