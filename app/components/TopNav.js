"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = [
  { key: "report", label: "기술검토 리포트", href: "/cases" },
  { key: "inventory", label: "토양 인벤토리", href: "/inventory" },
];

export default function TopNav() {
  const pathname = usePathname();
  const active = pathname?.startsWith("/inventory") ? "inventory" : "report";

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 20,
        flexWrap: "wrap",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            background: "linear-gradient(155deg, #c06a3f 0%, #a8562f 55%, #7a3f22 100%)",
            boxShadow: "0 3px 8px rgba(122, 63, 34, 0.35)",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 20,
          }}
        >
          토
        </div>
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--color-secondary)",
              letterSpacing: "0.02em",
              marginBottom: 1,
            }}
          >
            토양을 담다
          </div>
          <div style={{ fontWeight: 700, fontSize: 19 }}>
            토담{" "}
            <span style={{ fontWeight: 700, color: "var(--color-primary)", fontSize: 17 }}>
              土潭
            </span>
          </div>
          <div style={{ fontSize: 15, color: "var(--color-text-muted)" }}>
            토양정화 기술검토 · 인벤토리 플랫폼
          </div>
        </div>
      </div>

      <nav
        style={{
          display: "flex",
          gap: 4,
          background: "var(--color-surface-alt)",
          borderRadius: 10,
          padding: 4,
        }}
      >
        {SECTIONS.map((s) => (
          <Link
            key={s.key}
            href={s.href}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              textDecoration: "none",
              color: active === s.key ? "white" : "var(--color-text)",
              background: active === s.key ? "var(--color-primary)" : "transparent",
            }}
          >
            {s.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
