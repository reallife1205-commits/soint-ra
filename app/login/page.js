"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "로그인에 실패했어요.");
      setLoading(false);
      return;
    }

    const next = searchParams.get("next") || "/cases";
    router.replace(next);
    router.refresh();
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-bg)",
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="card"
        style={{ width: 360, background: "white" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "linear-gradient(155deg, #c06a3f 0%, #a8562f 55%, #7a3f22 100%)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            토
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>토담 土潭</div>
            <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
              담당자 전용 페이지예요
            </div>
          </div>
        </div>

        <label style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
          비밀번호
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid var(--color-border)",
            marginTop: 4,
            marginBottom: 14,
            fontSize: 15,
          }}
        />

        {error && (
          <div
            style={{
              color: "var(--color-badge-red-text)",
              fontSize: 14,
              marginBottom: 14,
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          className="btn-primary"
          disabled={loading || !password}
          style={{ width: "100%", justifyContent: "center" }}
        >
          {loading ? "확인 중..." : "입장하기"}
        </button>
      </form>
    </div>
  );
}
