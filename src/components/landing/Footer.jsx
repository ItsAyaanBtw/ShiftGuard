"use client";

export default function Footer() {
  return (
    <footer
      style={{
        padding: "48px 24px",
        background: "var(--paper-bg-warm)",
        borderTop: "1px solid oklch(0.22 0.015 60 / 0.08)",
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          fontSize: 13,
          color: "var(--paper-muted)",
        }}
      >
        <div
          className="font-serif font-italic"
          style={{ fontSize: 22, color: "var(--paper-fg)" }}
        >
          ShiftGuard
        </div>
        <div>© 2026 · Every dollar accounted for.</div>
      </div>
    </footer>
  );
}
