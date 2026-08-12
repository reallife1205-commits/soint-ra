"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import TopNav from "@/app/components/TopNav";

export default function InventoryPage() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  async function loadData() {
    setLoading(true);
    setErrorMsg("");
    const { data, error } = await supabase
      .from("inventory_sites")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMsg("부지 목록을 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
      setLoading(false);
      return;
    }
    setSites(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredSites = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return sites;
    return sites.filter((s) =>
      [s.site_name, s.address, s.land_use]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(keyword))
    );
  }, [sites, search]);

  return (
    <div className="page">
      <TopNav />

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
        <button className="btn-primary" onClick={() => setShowAddForm(true)}>
          + 새 부지 등록
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="부지명, 주소, 토지이용 검색"
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid var(--color-border)",
            background: "white",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 13,
            color: "var(--color-text-muted)",
            whiteSpace: "nowrap",
          }}
        >
          총 {filteredSites.length}건
        </div>
      </div>

      {errorMsg && (
        <div className="card" style={{ marginBottom: 20, color: "var(--color-badge-red-text)" }}>
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="card">불러오는 중이에요...</div>
      ) : filteredSites.length === 0 ? (
        <div className="card">
          등록된 부지가 없어요. 오른쪽 위 &quot;새 부지 등록&quot; 버튼으로 첫 부지를
          추가해보세요.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
          }}
        >
          {filteredSites.map((s) => (
            <Link
              key={s.id}
              href={`/inventory/${s.id}`}
              className="card"
              style={{ display: "block" }}
            >
              <div style={{ fontWeight: 700, fontSize: 16 }}>{s.site_name}</div>
              <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 4 }}>
                {s.address || "주소 미입력"}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                {s.area_sqm && (
                  <span className="badge badge-blue">{s.area_sqm}㎡</span>
                )}
                {s.land_use && <span className="badge badge-green">{s.land_use}</span>}
              </div>
              {s.land_use_history && (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--color-text-muted)",
                    marginTop: 10,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {s.land_use_history}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      {showAddForm && (
        <AddSiteModal
          onClose={() => setShowAddForm(false)}
          onCreated={() => {
            setShowAddForm(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}

function AddSiteModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    site_name: "",
    address: "",
    area_sqm: "",
    land_use: "",
    land_use_history: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.site_name) {
      setError("부지명은 꼭 입력해주세요.");
      return;
    }
    setSaving(true);
    setError("");

    let lat = null;
    let lon = null;
    if (form.address) {
      try {
        const res = await fetch("/api/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: form.address }),
        });
        const geo = await res.json();
        if (res.ok) {
          lat = geo.lat;
          lon = geo.lon;
        }
      } catch {
        // 좌표 변환 실패해도 등록은 계속 진행해요
      }
    }

    const { error: insertError } = await supabase.from("inventory_sites").insert([
      {
        ...form,
        area_sqm: form.area_sqm ? Number(form.area_sqm) : null,
        lat,
        lon,
      },
    ]);

    if (insertError) {
      setError("저장에 실패했어요. 다시 시도해주세요.");
      setSaving(false);
      return;
    }

    setSaving(false);
    onCreated();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="card"
        style={{ width: 440, background: "white", maxHeight: "90vh", overflowY: "auto" }}
      >
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>새 부지 등록</div>

        {[
          { key: "site_name", label: "부지명 *" },
          { key: "address", label: "주소 (입력하면 좌표를 자동으로 찾아요)" },
          { key: "area_sqm", label: "면적 (㎡)", type: "number" },
          { key: "land_use", label: "토지이용 현황 (예: 공장, 창고, 나대지)" },
        ].map((field) => (
          <div key={field.key} style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {field.label}
            </label>
            <input
              type={field.type || "text"}
              value={form[field.key]}
              onChange={(e) => update(field.key, e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--color-border)",
                marginTop: 4,
              }}
            />
          </div>
        ))}

        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            과거 이용 이력
          </label>
          <textarea
            value={form.land_use_history}
            onChange={(e) => update("land_use_history", e.target.value)}
            rows={3}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid var(--color-border)",
              marginTop: 4,
              fontFamily: "inherit",
              resize: "vertical",
            }}
          />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, color: "var(--color-text-muted)" }}>메모</label>
          <textarea
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            rows={2}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid var(--color-border)",
              marginTop: 4,
              fontFamily: "inherit",
              resize: "vertical",
            }}
          />
        </div>

        {error && (
          <div style={{ color: "var(--color-badge-red-text)", fontSize: 13, marginBottom: 10 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "저장 중..." : "등록"}
          </button>
        </div>
      </form>
    </div>
  );
}
