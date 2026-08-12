"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import TopNav from "@/app/components/TopNav";

const AerialMapView = dynamic(
  () => import("@/app/cases/[id]/AerialMapView"),
  { ssr: false }
);

export default function InventorySiteDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [site, setSite] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from("inventory_sites")
      .select("*")
      .eq("id", id)
      .single();
    if (fetchError) {
      setError("부지 정보를 불러오지 못했어요.");
      setLoading(false);
      return;
    }
    setSite(data);
    setForm(data);
    setLoading(false);
  }

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setSavedMsg("");
  }

  async function handleRegeocode() {
    if (!form.address) return;
    setSaving(true);
    try {
      const res = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: form.address }),
      });
      const geo = await res.json();
      if (res.ok) {
        setForm((f) => ({ ...f, lat: geo.lat, lon: geo.lon }));
      } else {
        setError(geo.error || "좌표를 찾지 못했어요.");
      }
    } catch {
      setError("좌표 변환 중 문제가 발생했어요.");
    }
    setSaving(false);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    const { area_sqm, ...rest } = form;
    const { error: updateError } = await supabase
      .from("inventory_sites")
      .update({
        ...rest,
        area_sqm: area_sqm ? Number(area_sqm) : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      setError("저장에 실패했어요. 다시 시도해주세요.");
      setSaving(false);
      return;
    }
    setSavedMsg("저장했어요!");
    setSaving(false);
    load();
  }

  async function handleDelete() {
    if (!confirm("이 부지를 삭제할까요? 삭제하면 되돌릴 수 없어요.")) return;
    await supabase.from("inventory_sites").delete().eq("id", id);
    router.push("/inventory");
  }

  async function handleBoundarySave(points) {
    const value = points ? points.map((p) => ({ lat: p.lat, lon: p.lon })) : null;
    const { error: updateError } = await supabase
      .from("inventory_sites")
      .update({ boundary_points: value, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (!updateError) {
      setForm((f) => ({ ...f, boundary_points: value }));
      setSite((s) => ({ ...s, boundary_points: value }));
    }
  }

  if (loading) {
    return (
      <div className="page">
        <TopNav />
        <div className="card">불러오는 중이에요...</div>
      </div>
    );
  }

  if (error && !site) {
    return (
      <div className="page">
        <TopNav />
        <div className="card" style={{ color: "var(--color-badge-red-text)" }}>
          {error}
        </div>
      </div>
    );
  }

  const coords = form.lat && form.lon ? { lat: form.lat, lon: form.lon } : null;

  return (
    <div className="page">
      <TopNav />

      <div style={{ marginBottom: 16 }}>
        <Link href="/inventory" style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
          ← 인벤토리 목록으로
        </Link>
      </div>

      <div style={{ display: "flex", gap: 20 }}>
        <div style={{ flex: 1 }}>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>기본 정보</div>

            <FormField label="부지명">
              <input
                value={form.site_name || ""}
                onChange={(e) => update("site_name", e.target.value)}
                style={inputStyle}
              />
            </FormField>

            <FormField label="주소">
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={form.address || ""}
                  onChange={(e) => update("address", e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleRegeocode}
                  disabled={saving}
                >
                  좌표 찾기
                </button>
              </div>
              {coords && (
                <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>
                  좌표: {coords.lat.toFixed(6)}, {coords.lon.toFixed(6)}
                </div>
              )}
            </FormField>

            <FormField label="면적 (㎡)">
              <input
                type="number"
                value={form.area_sqm || ""}
                onChange={(e) => update("area_sqm", e.target.value)}
                style={inputStyle}
              />
            </FormField>

            <FormField label="토지이용 현황">
              <input
                value={form.land_use || ""}
                onChange={(e) => update("land_use", e.target.value)}
                style={inputStyle}
              />
            </FormField>

            <FormField label="과거 이용 이력">
              <textarea
                value={form.land_use_history || ""}
                onChange={(e) => update("land_use_history", e.target.value)}
                rows={4}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
              />
            </FormField>

            <FormField label="메모">
              <textarea
                value={form.notes || ""}
                onChange={(e) => update("notes", e.target.value)}
                rows={3}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
              />
            </FormField>

            {error && (
              <div style={{ color: "var(--color-badge-red-text)", fontSize: 13, marginBottom: 10 }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                type="button"
                onClick={handleDelete}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "var(--color-badge-red-text)",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                이 부지 삭제
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {savedMsg && (
                  <span style={{ fontSize: 13, color: "var(--color-primary)" }}>{savedMsg}</span>
                )}
                <button className="btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <div className="card" style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>
            위치
          </div>
          <AerialMapView
            coords={coords}
            address={form.address}
            boundary={form.boundary_points}
            boundaryEditable={true}
            onBoundarySave={handleBoundarySave}
          />
        </div>
      </div>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{label}</label>
      <div style={{ marginTop: 4 }}>{children}</div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--color-border)",
};
