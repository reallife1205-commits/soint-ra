"use client";

import { useCallback, useEffect, useState } from "react";
import {
  changedFields,
  displayValue,
  entryPlace,
  fieldLabel,
  inScope,
  loadCaseHistory,
  restoreDeletedRow,
  restoreField,
  undoInsert,
} from "@/lib/changeHistory";

function formatTime(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const ACTION_BADGES = {
  insert: { label: "추가", className: "badge badge-green" },
  update: { label: "수정", className: "badge badge-blue" },
  delete: { label: "삭제", className: "badge badge-red" },
};

const VALUE_STYLE = {
  maxWidth: 260,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  display: "inline-block",
  verticalAlign: "bottom",
};

// 장 제목 옆 "변경 이력" 버튼 + 이력 창. 되돌린 뒤에는 onRestored로 화면을 다시 불러오게 한다.
export default function ChangeHistoryPanel({ caseId, scope, screenLabel, onRestored }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [onlyThisScreen, setOnlyThisScreen] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await loadCaseHistory(caseId);
    setEntries(data);
    setLoadError(error);
    setLoading(false);
  }, [caseId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  async function run(action, confirmMessage) {
    if (confirmMessage && !confirm(confirmMessage)) return;
    setBusy(true);
    const { error } = await action();
    setBusy(false);
    if (error) {
      alert(`되돌리지 못했어요: ${error.message}`);
      return;
    }
    await load();
    onRestored?.();
  }

  const visible = entries
    .filter((e) => !onlyThisScreen || inScope(e, scope))
    // 내용은 그대로이고 숨은 칸(category 등)만 바뀐 수정은 보여줄 게 없어 뺀다
    .filter((e) => e.action !== "update" || changedFields(e).length > 0);

  return (
    <>
      <button className="btn-secondary" onClick={() => setOpen(true)} title="이 안건에서 입력·수정·삭제한 내용을 보고 예전 값으로 되돌려요">
        🕘 변경 이력
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              borderRadius: 10,
              padding: 20,
              width: 820,
              maxWidth: "95vw",
              maxHeight: "88vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 17 }}>변경 이력</div>
              <button
                onClick={() => setOpen(false)}
                style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 19 }}
              >
                ✕
              </button>
            </div>
            <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 10 }}>
              칸에 입력한 내용은 저장될 때마다 바뀌기 전 값이 여기에 남아요. 실수로 고쳤다면 해당 줄의
              &nbsp;<b>이전 값으로</b>를 누르세요. 되돌린 것도 이력에 남으니 다시 되돌릴 수 있어요.
            </div>
            <label style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <input type="checkbox" checked={onlyThisScreen} onChange={(e) => setOnlyThisScreen(e.target.checked)} />
              지금 화면({screenLabel}) 관련만 보기
            </label>

            <div style={{ overflowY: "auto", flex: 1, borderTop: "1px solid var(--color-border)" }}>
              {loading ? (
                <div style={{ padding: 20, textAlign: "center", color: "var(--color-text-muted)" }}>불러오는 중...</div>
              ) : loadError ? (
                <div style={{ padding: 20, color: "var(--color-badge-red-text)" }}>
                  이력을 불러오지 못했어요: {loadError.message}
                  <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 6 }}>
                    아직 sql/025_change_history.sql을 Supabase에서 실행하지 않았다면 먼저 실행해 주세요.
                  </div>
                </div>
              ) : visible.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: "var(--color-text-muted)" }}>
                  남아 있는 변경 이력이 없어요. (이력 기능을 켠 뒤부터 기록돼요)
                </div>
              ) : (
                visible.map((entry) => {
                  const badge = ACTION_BADGES[entry.action];
                  const fields = changedFields(entry);
                  return (
                    <div key={entry.id} style={{ padding: "10px 4px", borderBottom: "1px solid var(--color-border)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                        <span className={badge.className}>{badge.label}</span>
                        <span style={{ color: "var(--color-text-muted)" }}>{formatTime(entry.changed_at)}</span>
                        <span style={{ fontWeight: 600 }}>{entryPlace(entry)}</span>
                        <span style={{ flex: 1 }} />
                        {entry.action === "delete" && entry.table_name !== "cases" && (
                          <button
                            className="btn-secondary"
                            disabled={busy}
                            style={{ padding: "2px 10px", fontSize: 13 }}
                            onClick={() => run(() => restoreDeletedRow(entry))}
                          >
                            되살리기
                          </button>
                        )}
                        {entry.action === "insert" && entry.table_name !== "cases" && (
                          <button
                            className="btn-secondary"
                            disabled={busy}
                            style={{ padding: "2px 10px", fontSize: 13 }}
                            onClick={() => run(() => undoInsert(entry), "이때 추가한 행을 지울까요? (지운 것도 이력에 남아 다시 되살릴 수 있어요)")}
                          >
                            추가 취소
                          </button>
                        )}
                      </div>

                      {fields.length > 0 && (
                        <table style={{ marginTop: 6, fontSize: 14, borderCollapse: "collapse", width: "100%" }}>
                          <tbody>
                            {fields.map((f) => (
                              <tr key={f.key}>
                                <td style={{ width: 130, color: "var(--color-text-muted)", padding: "2px 4px" }}>{fieldLabel(f.key)}</td>
                                <td style={{ padding: "2px 4px" }}>
                                  {entry.action !== "insert" && (
                                    <span title={displayValue(f.before)} style={{ ...VALUE_STYLE, textDecoration: entry.action === "update" ? "line-through" : "none", color: "var(--color-text-muted)" }}>
                                      {displayValue(f.before)}
                                    </span>
                                  )}
                                  {entry.action === "update" && <span style={{ margin: "0 6px" }}>→</span>}
                                  {entry.action !== "delete" && (
                                    <span title={displayValue(f.after)} style={{ ...VALUE_STYLE, fontWeight: 600 }}>
                                      {displayValue(f.after)}
                                    </span>
                                  )}
                                </td>
                                <td style={{ width: 90, textAlign: "right", padding: "2px 4px" }}>
                                  {entry.action === "update" && (
                                    <button
                                      disabled={busy}
                                      onClick={() => run(() => restoreField(entry, f.key, f.before))}
                                      className="link-edit"
                                      style={{ border: "none", background: "none", cursor: "pointer", fontSize: 13 }}
                                      title={`${fieldLabel(f.key)}을(를) "${displayValue(f.before)}"(으)로 되돌려요`}
                                    >
                                      이전 값으로
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
