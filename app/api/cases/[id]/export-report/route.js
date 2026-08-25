import { createClient } from "@supabase/supabase-js";
import { buildReportDocx } from "@/lib/reportExport";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const DEFAULT_RADIUS_KM = 4;
const MAX_AERIAL_IMAGES = 4;
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

async function fetchAerialImages(caseId) {
  const { data: docs } = await supabaseAdmin
    .from("documents")
    .select("*")
    .eq("case_id", caseId)
    .eq("module_number", 4)
    .order("uploaded_at", { ascending: false })
    .limit(MAX_AERIAL_IMAGES);

  if (!docs?.length) return [];

  const images = await Promise.all(
    docs.map(async (doc) => {
      const ext = (doc.file_name.match(/\.([^.]+)$/)?.[1] || "").toLowerCase();
      const type = IMAGE_TYPE_BY_EXT[ext];
      if (!type) return null;
      const { data: blob, error } = await supabaseAdmin.storage.from("documents").download(doc.file_path);
      if (error || !blob) return null;
      const buf = Buffer.from(await blob.arrayBuffer());
      return { data: buf, type };
    })
  );

  return images.filter(Boolean);
}

async function fetchCaseData(caseId) {
  const [
    { data: caseInfo },
    { data: overviewRows },
    { data: contaminationRows },
    { data: ownershipRows },
    { data: fieldSurvey },
    { data: reviewOpinion },
  ] = await Promise.all([
    supabaseAdmin.from("cases").select("*").eq("id", caseId).single(),
    supabaseAdmin.from("module_rows").select("row_data").eq("case_id", caseId).eq("module_number", 0),
    supabaseAdmin.from("module_rows").select("row_data").eq("case_id", caseId).eq("module_number", 1),
    supabaseAdmin.from("module_rows").select("row_data").eq("case_id", caseId).eq("module_number", 3),
    supabaseAdmin.from("field_surveys").select("*").eq("case_id", caseId).maybeSingle(),
    supabaseAdmin.from("review_opinions").select("content").eq("case_id", caseId).maybeSingle(),
  ]);

  if (!caseInfo) return null;

  const m0 = (overviewRows || []).map((r) => r.row_data);
  const m3 = (ownershipRows || []).map((r) => r.row_data);

  const overviewData = m0.find((d) => d.category === "overview") || {};
  const progressItems = m0
    .filter((d) => d.category === "progress")
    .map((d) => ({ date: d.date, description: d.description }))
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const currentOwners = m3
    .filter((d) => d.category === "ownership" && !d.disposed_date)
    .map((d) => d.owner_name)
    .filter(Boolean);

  const [soilDataRows, aerialImages] = await Promise.all([
    fetchReferenceSoilData(caseInfo.lat, caseInfo.lon, DEFAULT_RADIUS_KM),
    fetchAerialImages(caseId),
  ]);
  const networkRows = soilDataRows.filter((r) => r.source_type === "측정망");
  const surveyRows = soilDataRows.filter((r) => r.source_type === "실태조사");

  return {
    caseInfo,
    overview: {
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
    ownership: {
      ownershipRows: m3.filter((d) => d.category === "ownership"),
      leaseRows: m3.filter((d) => d.category === "lease"),
    },
    judgments: {
      soil_assessment: judgmentByCategory(m3, "soil_assessment"),
      cost_capacity: judgmentByCategory(m3, "cost_capacity"),
      access: judgmentByCategory(m3, "access"),
      agreement: judgmentByCategory(m3, "agreement"),
      management_history: judgmentByCategory(m3, "management_history"),
    },
    costCapacityItems: m3.filter((d) => d.category === "cost_capacity_item"),
    aerialImages,
    fieldSurvey,
    reviewOpinion: reviewOpinion?.content || null,
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

    const buffer = await buildReportDocx(payload);
    const fileName = encodeURIComponent(
      `기술검토보고서_초안_${payload.caseInfo.case_number || caseId}.docx`
    );

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename*=UTF-8''${fileName}`,
      },
    });
  } catch (e) {
    return Response.json({ error: e.message || "보고서 생성 중 문제가 발생했어요" }, { status: 500 });
  }
}
