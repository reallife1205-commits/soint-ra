import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { buildReportHwpx } from "@/lib/hwpxReportBuilder";

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
const MAX_PHOTOS = 9;
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
async function fetchImages(caseId, moduleNumber, limit, category, orderByYear = false) {
  let query = supabaseAdmin
    .from("documents")
    .select("*")
    .eq("case_id", caseId)
    .eq("module_number", moduleNumber);
  if (category === null) query = query.is("category", null);
  else if (category !== undefined) query = query.eq("category", category);
  if (orderByYear) query = query.order("photo_year", { ascending: true, nullsFirst: false });
  const { data: docs } = await query.order("uploaded_at", { ascending: !orderByYear }).limit(limit);

  if (!docs?.length) return [];

  const images = await Promise.all(
    docs.map(async (doc) => {
      const ext = (doc.file_name.match(/\.([^.]+)$/)?.[1] || "").toLowerCase();
      const type = IMAGE_TYPE_BY_EXT[ext];
      if (!type) return null;
      const { data: blob, error } = await supabaseAdmin.storage.from("documents").download(doc.file_path);
      if (error || !blob) return null;
      const buf = Buffer.from(await blob.arrayBuffer());
      return { data: buf, type, caption: doc.photo_note || "" };
    })
  );

  return images.filter(Boolean);
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
    supabaseAdmin.from("module_rows").select("row_data").eq("case_id", caseId).eq("module_number", 1),
    supabaseAdmin.from("module_rows").select("row_data").eq("case_id", caseId).eq("module_number", 2),
    supabaseAdmin.from("module_rows").select("row_data").eq("case_id", caseId).eq("module_number", 3),
    supabaseAdmin.from("module_rows").select("row_data").eq("case_id", caseId).eq("module_number", 5),
    supabaseAdmin.from("field_surveys").select("*").eq("case_id", caseId).maybeSingle(),
    supabaseAdmin.from("module_rows").select("row_data").eq("case_id", caseId).eq("module_number", 8),
  ]);

  if (!caseInfo) return null;

  const m0 = (overviewRows || []).map((r) => r.row_data);
  const m2 = (module2Rows || []).map((r) => r.row_data);
  const m3 = (ownershipRows || []).map((r) => r.row_data);
  const m5 = (factoryHistoryRows || []).map((r) => r.row_data);
  const m8 = (scientificRows || []).map((r) => r.row_data);
  const scientificAnalysis = m8.find((d) => d.category === "scientific_analysis")?.content || "";
  const module2Settings = m2.find((d) => d.category === "settings");
  const selectedSubstances = module2Settings ? module2Settings.selected || [] : null;

  const overviewData = m0.find((d) => d.category === "overview") || {};
  const progressItems = m0
    .filter((d) => d.category === "progress")
    .map((d) => ({ date: d.date, description: d.description }))
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const currentOwners = m3
    .filter((d) => d.category === "ownership" && !d.disposed_date)
    .map((d) => d.owner_name)
    .filter(Boolean);

  const [
    soilDataRows,
    aerialImages,
    fieldPhotoImages,
    samplePointImages,
    pollutionMapImages,
    surroundingImages,
    sitePlanImages,
  ] = await Promise.all([
    fetchReferenceSoilData(caseInfo.lat, caseInfo.lon, DEFAULT_RADIUS_KM),
    // 항공사진은 표에 "오래된 연도부터" 채워지므로 업로드 순서가 아니라 사진마다 지정한
    // photo_year 순으로 가져온다(4번 모듈 태깅 화면에서 연도 입력).
    fetchImages(caseId, 4, 8, undefined, true),
    fetchImages(caseId, 6, MAX_PHOTOS),
    // 2.1 "시료채취지점" 사진(챕터01 이미지 갤러리, category=sample_points)
    fetchImages(caseId, 1, 5, "sample_points"),
    // 2.1에 "오염분포도"로 올린 사진도 있으면 시료채취지점 사진이 없을 때 대신 쓴다
    fetchImages(caseId, 1, 5, "pollution_map"),
    // 2.2 "주변부지 조사 지점" 지도 캡처(챕터02 지도 화면의 "화면 캡처해서 저장" 버튼)
    fetchImages(caseId, 2, 5, "surrounding_map"),
    // 3.4 "배치도 등" 업로드(챕터03 출입가능성 화면)
    fetchImages(caseId, 3, 5, "site_plan"),
  ]);
  const networkRows = soilDataRows.filter((r) => r.source_type === "측정망");
  const surveyRows = soilDataRows.filter((r) => r.source_type === "실태조사");

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
      leaseRows: m3.filter((d) => d.category === "lease"),
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
    // 2.1엔 그림이 두 장 있음: "그림 시료채취지점"엔 sample_points 사진, "[표1] 오염면적"엔
    // pollution_map 사진(둘 중 하나가 비면 서로 대신 쓴다).
    samplePointImages: samplePointImages.length ? samplePointImages : pollutionMapImages,
    pollutionMapImages: pollutionMapImages.length ? pollutionMapImages : samplePointImages,
    surroundingImages,
    sitePlanImages,
    fieldSurvey,
    scientificAnalysis,
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
    const fileName = encodeURIComponent(
      `기술검토보고서_초안_${payload.caseInfo.case_number || caseId}.hwpx`
    );

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${fileName}`,
      },
    });
  } catch (e) {
    return Response.json({ error: e.message || "보고서 생성 중 문제가 발생했어요" }, { status: 500 });
  }
}
