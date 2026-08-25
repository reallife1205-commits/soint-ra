import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  VerticalAlign,
  ImageRun,
} from "docx";
import { SUBSTANCE_LABELS, findSubstanceKey } from "./substances.js";
import { CONCERN_STANDARDS, ACTION_STANDARDS, parseRegionGrade } from "./soilStandards.js";

const HEADER_SHADING = { fill: "F6F8F4" };

function toNum(v) {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function toNumOrNull(v) {
  const n = parseFloat(v);
  return v === null || v === undefined || v === "" || isNaN(n) ? null : n;
}

function formatSum(n) {
  return Number(Math.round(n * 100) / 100).toLocaleString("ko-KR", { maximumFractionDigits: 2 });
}

function cellText(text, { bold = false, align = AlignmentType.CENTER } = {}) {
  return new TableCell({
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: align,
        children: [new TextRun({ text: text ?? "", bold, size: 20 })],
      }),
    ],
  });
}

function headerCell(text) {
  return new TableCell({
    shading: HEADER_SHADING,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, bold: true, size: 20 })],
      }),
    ],
  });
}

function fullWidthTable(rows) {
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
}

function heading(text, level = HeadingLevel.HEADING_2) {
  return new Paragraph({ text, heading: level, spacing: { before: 200, after: 120 } });
}

function body(text) {
  return new Paragraph({ children: [new TextRun({ text: text ?? "", size: 22 })], spacing: { after: 120 } });
}

function noteBody(text) {
  return new Paragraph({
    children: [new TextRun({ text: text ?? "", size: 20, color: "666666" })],
    spacing: { after: 160 },
  });
}

// ---- 챕터01: 대상부지 오염현황 ----

function summarizeContamination(items) {
  let concern = 0;
  let action = 0;
  let area = 0;
  let volume = 0;
  let maxConc = null;
  items.forEach((d) => {
    concern += toNum(d.concern_standard);
    action += toNum(d.action_standard);
    area += toNum(d.area);
    volume += toNum(d.volume);
    const c = toNumOrNull(d.max_concentration);
    if (c !== null && (maxConc === null || c > maxConc)) maxConc = c;
  });
  return { concern, action, area, volume, maxConc };
}

function buildContaminationSection(contaminationRows, regionGrade) {
  const zone = parseRegionGrade(regionGrade);
  const grandTotal = summarizeContamination(contaminationRows);

  const groups = [];
  const groupIndex = {};
  contaminationRows.forEach((d) => {
    const name = d.contaminant || "";
    if (!(name in groupIndex)) {
      groupIndex[name] = groups.length;
      groups.push({ name, items: [] });
    }
    groups[groupIndex[name]].items.push(d);
  });

  const headerRow = new TableRow({
    children: [
      headerCell("오염물질"),
      headerCell("심도"),
      headerCell("최고농도\n(mg/kg)"),
      headerCell("오염면적\n(m²)"),
      headerCell("오염량\n(m³)"),
    ],
  });

  const dataRows = groups.map((g) => {
    const s = summarizeContamination(g.items);
    const exceeded =
      zone && g.name
        ? (() => {
            const key = findSubstanceKey(g.name);
            if (!key || s.maxConc === null) return "";
            if (ACTION_STANDARDS[key]?.[zone] !== undefined && s.maxConc > ACTION_STANDARDS[key][zone]) return " (대책기준 초과)";
            if (CONCERN_STANDARDS[key]?.[zone] !== undefined && s.maxConc > CONCERN_STANDARDS[key][zone]) return " (우려기준 초과)";
            return "";
          })()
        : "";
    return new TableRow({
      children: [
        cellText(g.name || "-"),
        cellText(g.items.map((d) => d.depth).filter(Boolean).join(", ") || "-"),
        cellText(s.maxConc !== null ? formatSum(s.maxConc) + exceeded : "-"),
        cellText(formatSum(s.area)),
        cellText(formatSum(s.volume)),
      ],
    });
  });

  const totalRow = new TableRow({
    children: [
      headerCell("종합"),
      cellText(""),
      cellText(""),
      cellText(formatSum(grandTotal.area), { bold: true }),
      cellText(formatSum(grandTotal.volume), { bold: true }),
    ],
  });

  return [
    heading("2.1 대상부지 토양오염 현황"),
    contaminationRows.length
      ? fullWidthTable([headerRow, ...dataRows, totalRow])
      : noteBody("※ 등록된 오염현황 자료 없음"),
  ];
}

// ---- 챕터02: 주변부지 오염현황 ----

const NETWORK_SUBSTANCE_LABEL = {
  cadmium: "카드뮴", copper: "구리", arsenic: "비소", mercury: "수은", lead: "납",
  chromium6: "6가크롬", zinc: "아연", nickel: "니켈", organophosphorus: "유기인",
  cyanide: "시안", ph: "pH", fluorine: "불소", pcb: "PCB", phenol: "페놀류",
  benzene: "벤젠", toluene: "톨루엔", ethylbenzene: "에틸벤젠", xylene: "크실렌",
  tph: "TPH", tce: "TCE", pce: "PCE", benzoapyrene: "벤조(a)피렌",
};
const NETWORK_SUBSTANCE_KEYS = Object.keys(NETWORK_SUBSTANCE_LABEL);

function buildNetworkTable(networkRows, regionGrade) {
  const zone = parseRegionGrade(regionGrade);
  if (!networkRows.length) return noteBody("※ 반경 내 토양측정망 자료 없음");

  const stats = {};
  NETWORK_SUBSTANCE_KEYS.forEach((key) => {
    const values = networkRows.map((r) => toNumOrNull(r[key])).filter((v) => v !== null);
    stats[key] = {
      max: values.length ? Math.max(...values) : null,
      avg: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null,
    };
  });

  const blocks = [NETWORK_SUBSTANCE_KEYS.slice(0, 11), NETWORK_SUBSTANCE_KEYS.slice(11)];
  const rows = [];
  blocks.forEach((keys) => {
    rows.push(new TableRow({ children: [headerCell("측정항목"), ...keys.map((k) => headerCell(NETWORK_SUBSTANCE_LABEL[k]))] }));
    rows.push(
      new TableRow({
        children: [
          cellText(zone ? `${zone}지역(우려기준)` : "우려기준", { bold: true }),
          ...keys.map((k) => cellText(zone && CONCERN_STANDARDS[k]?.[zone] !== undefined ? formatSum(CONCERN_STANDARDS[k][zone]) : "-")),
        ],
      })
    );
    rows.push(
      new TableRow({
        children: [
          cellText("최고농도", { bold: true }),
          ...keys.map((k) => cellText(stats[k].max !== null ? formatSum(stats[k].max) : "-")),
        ],
      })
    );
    rows.push(
      new TableRow({
        children: [
          cellText("평균농도", { bold: true }),
          ...keys.map((k) => cellText(stats[k].avg !== null ? formatSum(stats[k].avg) : "-")),
        ],
      })
    );
  });

  return fullWidthTable(rows);
}

function buildSurveyTable(surveyRows) {
  if (!surveyRows.length) return noteBody("※ 반경 내 토양오염실태조사 자료 없음");

  const years = Array.from(new Set(surveyRows.map((r) => r.survey_year).filter((y) => y != null))).sort(
    (a, b) => Number(a) - Number(b)
  );
  if (!years.length) return noteBody("※ 반경 내 토양오염실태조사 자료 없음");

  const presentKeys = NETWORK_SUBSTANCE_KEYS.filter((k) =>
    surveyRows.some((r) => toNumOrNull(r[k]) !== null)
  );
  if (!presentKeys.length) return noteBody("※ 반경 내 토양오염실태조사 자료 없음");

  function statsFor(key, year) {
    const values = surveyRows.filter((r) => r.survey_year === year).map((r) => toNumOrNull(r[key])).filter((v) => v !== null);
    return {
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null,
    };
  }

  const rows = [
    new TableRow({ children: [headerCell("구분"), headerCell(""), ...years.map((y) => headerCell(`'${String(y).slice(-2)}`))] }),
  ];
  presentKeys.forEach((key) => {
    rows.push(
      new TableRow({
        children: [
          cellText(SUBSTANCE_LABELS.find((l) => findSubstanceKey(l) === key) || key, { bold: true }),
          cellText("최저농도"),
          ...years.map((y) => cellText(statsFor(key, y).min !== null ? formatSum(statsFor(key, y).min) : "-")),
        ],
      })
    );
    rows.push(
      new TableRow({
        children: [
          cellText(""),
          cellText("최고농도"),
          ...years.map((y) => cellText(statsFor(key, y).max !== null ? formatSum(statsFor(key, y).max) : "-")),
        ],
      })
    );
  });

  return fullWidthTable(rows);
}

function buildSurroundingSection(networkRows, surveyRows, regionGrade) {
  return [
    heading("2.2 인접·주변부지 토양오염 현황"),
    body("[표] 토양측정망 조사결과 (단위: mg/kg)"),
    buildNetworkTable(networkRows, regionGrade),
    body("[표] 토양오염실태조사 결과 (단위: mg/kg)"),
    buildSurveyTable(surveyRows),
  ];
}

// ---- 챕터03: 소유·점유·운영(3.1) + 항공사진 + 3.2~3.6 ----

function buildOwnershipTable(ownershipRows) {
  if (!ownershipRows.length) return noteBody("※ 등록된 소유 이력 없음");
  const rows = [
    new TableRow({
      children: [headerCell("소유자"), headerCell("취득일"), headerCell("처분일"), headerCell("업종"), headerCell("비고")],
    }),
    ...ownershipRows.map(
      (d) =>
        new TableRow({
          children: [
            cellText(d.owner_name || "-"),
            cellText(d.acquired_date || "-"),
            cellText(d.disposed_date || "현재"),
            cellText(d.business_type || "-"),
            cellText(d.note || "-"),
          ],
        })
    ),
  ];
  return fullWidthTable(rows);
}

function buildLeaseTable(leaseRows) {
  if (!leaseRows.length) return null;
  const rows = [
    new TableRow({
      children: [headerCell("임차인"), headerCell("임차 시작"), headerCell("임차 종료"), headerCell("업종"), headerCell("비고")],
    }),
    ...leaseRows.map(
      (d) =>
        new TableRow({
          children: [
            cellText(d.tenant_name || "-"),
            cellText(d.lease_start || "-"),
            cellText(d.lease_end || "-"),
            cellText(d.business_type || "-"),
            cellText(d.note || "-"),
          ],
        })
    ),
  ];
  return fullWidthTable(rows);
}

function checklistLine(checked, checklistOptions) {
  const marks = checklistOptions
    .map((opt) => `${checked?.[opt.key] ? "☑" : "□"} ${opt.label}`)
    .concat(`${checked?.other ? "☑" : "□"} 기타`)
    .join("  ");
  return marks;
}

function buildJudgmentBlock(title, judgment, checklistOptions, extraLine) {
  const blocks = [heading(title, HeadingLevel.HEADING_3)];
  if (judgment) {
    blocks.push(body(checklistLine(judgment.checked, checklistOptions)));
    if (judgment.checked?.other && judgment.other_text) {
      blocks.push(noteBody(`기타: ${judgment.other_text}`));
    }
    if (extraLine) blocks.push(noteBody(extraLine(judgment)));
    blocks.push(body(judgment.summary || "※ 판단 내용 미입력"));
  } else {
    blocks.push(noteBody("※ 판단 내용 미입력"));
  }
  return blocks;
}

async function buildAerialImageParagraphs(aerialImages) {
  if (!aerialImages.length) return [noteBody("※ 등록된 항공사진 없음")];
  const runs = aerialImages.map(
    (img) =>
      new ImageRun({
        type: img.type,
        data: img.data,
        transformation: { width: 220, height: 160 },
      })
  );
  return [new Paragraph({ children: runs, spacing: { after: 160 } })];
}

async function buildOwnershipSection(ctx) {
  const { ownershipRows, leaseRows, aerialImages, judgments, costCapacityItems } = ctx;
  const leaseTable = buildLeaseTable(leaseRows);

  const blocks = [
    heading("3.1 토양오염관리대상시설의 소유·점유 또는 운영"),
    body("[표] 대상시설(또는 부지)의 소유·점유 현황"),
    buildOwnershipTable(ownershipRows),
  ];
  if (leaseTable) {
    blocks.push(body("[표] 임대차 이력"));
    blocks.push(leaseTable);
  }
  blocks.push(body("항공사진 (부지 사용이력 확인)"));
  blocks.push(...(await buildAerialImageParagraphs(aerialImages)));

  blocks.push(
    ...buildJudgmentBlock("3.2 토양환경평가의 실시, 그 밖의 토양오염의 방지를 위한 주의의 정도", judgments.soil_assessment, [
      { key: "assessment_report", label: "토양환경평가보고서" },
    ])
  );

  blocks.push(heading("3.3 토양정화에 드는 비용을 감당할 능력이 있는지 여부", HeadingLevel.HEADING_3));
  if (judgments.cost_capacity) {
    blocks.push(
      body(
        checklistLine(judgments.cost_capacity.checked, [
          { key: "property_tax", label: "재산세 납부실적" },
          { key: "asset_valuation", label: "재산평가액 보고서" },
          { key: "debt_assessment", label: "부채정도 평가서" },
        ])
      )
    );
    blocks.push(body(judgments.cost_capacity.summary || "※ 판단 내용 미입력"));
  } else {
    blocks.push(noteBody("※ 판단 내용 미입력"));
  }
  if (costCapacityItems.length) {
    const rows = [
      new TableRow({ children: [headerCell("제출자료 유형"), headerCell("금액(원)"), headerCell("비고")] }),
      ...costCapacityItems.map(
        (it) =>
          new TableRow({
            children: [cellText(it.item_type || "-"), cellText(it.amount || "-"), cellText(it.note || "-")],
          })
      ),
    ];
    blocks.push(fullWidthTable(rows));
  }

  blocks.push(
    ...buildJudgmentBlock("3.4 토양오염이 발생한 토지로의 출입 가능성 또는 용이성", judgments.access, [
      { key: "aerial_photo", label: "항공사진" },
      { key: "design_drawing", label: "설계도면" },
      { key: "site_plan", label: "배치 평면도" },
      { key: "site_photo", label: "현장사진" },
    ])
  );

  blocks.push(
    ...buildJudgmentBlock(
      "3.5 정화책임자 간의 약정 내용",
      judgments.agreement,
      [
        { key: "cleanup_agreement", label: "정화분담 약정서" },
        { key: "cost_agreement", label: "비용분담 합의서" },
      ],
      (j) => `복수의 정화책임자 간 약정 유무: ${j.agreement_exists || "-"}`
    )
  );

  blocks.push(
    ...buildJudgmentBlock("3.6 토양오염물질의 관리 이력", judgments.management_history, [
      { key: "facility_report", label: "특정토양오염관리대상시설 설치신고서" },
      { key: "hazmat_permit", label: "위험물 제조소·저장소·취급소 설치허가서" },
      { key: "other_permit", label: "기타 환경인허가" },
      { key: "process_evidence", label: "원료, 성분, 구성, 제조공정 등 증빙자료" },
      { key: "slag_test", label: "슬래그 시험성적서" },
      { key: "slag_cert", label: "슬래그 친환경 인증" },
    ])
  );

  return blocks;
}

// ---- 챕터06: 현장 및 청취조사 ----

function buildFieldSurveySection(fieldSurvey) {
  const blocks = [heading("4. 현장 및 청취조사")];
  if (!fieldSurvey) {
    blocks.push(noteBody("※ 등록된 현장·청취조사 자료 없음"));
    return blocks;
  }
  if (fieldSurvey.survey_date) blocks.push(noteBody(`조사일자: ${fieldSurvey.survey_date}`));

  blocks.push(heading("4.1 현장조사", HeadingLevel.HEADING_3));
  (fieldSurvey.field_items || []).forEach((item) => {
    blocks.push(body(`${item.checked ? "☑" : "□"} ${item.label} — ${item.answer || "확인되지 않음"}`));
  });

  blocks.push(heading("4.2 청취조사", HeadingLevel.HEADING_3));
  (fieldSurvey.interview_items || []).forEach((item) => {
    blocks.push(body(`${item.checked ? "☑" : "□"} ${item.label} — ${item.answer || "확인되지 않음"}`));
  });

  return blocks;
}

// ---- 챕터07: 종합의견 ----

function buildReviewOpinionSection(reviewOpinion) {
  const blocks = [heading("6. 기술검토 결과(종합)")];
  if (!reviewOpinion) {
    blocks.push(noteBody("※ 종합의견 미작성"));
    return blocks;
  }
  reviewOpinion
    .split("\n")
    .filter((line) => line.trim())
    .forEach((line) => blocks.push(body(line)));
  return blocks;
}

// ---- 1. 개요 ----

function buildOverviewSection(caseInfo, overview) {
  const blocks = [heading("1. 개요", HeadingLevel.HEADING_1), heading("1.1 안건 개요", HeadingLevel.HEADING_3)];

  const infoRows = [
    ["자문대상", caseInfo.address || "-"],
    ["신청서", overview.application_number || "-"],
    [
      "정밀조사 시기",
      overview.investigation_start || overview.investigation_end
        ? `${overview.investigation_start || "?"} ~ ${overview.investigation_end || "?"}`
        : "-",
    ],
    ["정화책임자", overview.currentOwners.length ? overview.currentOwners.join(", ") : "-"],
  ];
  blocks.push(
    fullWidthTable(
      infoRows.map(
        ([label, value]) =>
          new TableRow({ children: [headerCell(label), cellText(value, { align: AlignmentType.LEFT })] })
      )
    )
  );

  blocks.push(heading("1.2 추진 경과", HeadingLevel.HEADING_3));
  if (overview.progressItems.length) {
    overview.progressItems.forEach((p) => blocks.push(body(`ㅇ (${p.date || "?"}) ${p.description || ""}`)));
  } else {
    blocks.push(noteBody("※ 등록된 추진 경과 없음"));
  }

  blocks.push(heading("1.3 정화책임자에 대한 시·도지사 검토의견서", HeadingLevel.HEADING_3));
  blocks.push(body(overview.sido_opinion || "※ 미입력"));

  blocks.push(heading("1.4 정화책임자 의견", HeadingLevel.HEADING_3));
  const optType = overview.responsible_party_opinion_type;
  blocks.push(
    body(
      `${optType === "의견서" ? "☑" : "□"} 의견서  ${optType === "기타" ? "☑" : "□"} 기타(${
        overview.responsible_party_opinion_other || ""
      })`
    )
  );
  blocks.push(body(overview.responsible_party_opinion_text || "※ 미입력"));

  return blocks;
}

export async function buildReportDocx(payload) {
  const { caseInfo, overview, contaminationRows, networkRows, surveyRows, ownership, judgments, costCapacityItems, aerialImages, fieldSurvey, reviewOpinion } = payload;

  const children = [
    new Paragraph({ text: "기술검토보고서(초안)", heading: HeadingLevel.TITLE }),
    new Paragraph({
      children: [
        new TextRun({
          text: "※ 본 초안은 현재 등록된 조사 데이터만 반영되었으며, 실제 제출 전 검토가 필요합니다.",
          italics: true,
          color: "999999",
          size: 20,
        }),
      ],
      spacing: { after: 200 },
    }),
    ...buildOverviewSection(caseInfo, overview),
    heading("2. 토양오염물질의 종류·양·특성", HeadingLevel.HEADING_1),
    ...buildContaminationSection(contaminationRows, caseInfo.region_grade),
    ...buildSurroundingSection(networkRows, surveyRows, caseInfo.region_grade),
    heading("3. 기술검토 결과", HeadingLevel.HEADING_1),
    ...(await buildOwnershipSection({
      ownershipRows: ownership.ownershipRows,
      leaseRows: ownership.leaseRows,
      aerialImages,
      judgments,
      costCapacityItems,
    })),
    ...buildFieldSurveySection(fieldSurvey),
    ...buildReviewOpinionSection(reviewOpinion),
  ];

  const doc = new Document({
    sections: [{ children }],
  });

  return Packer.toBuffer(doc);
}
