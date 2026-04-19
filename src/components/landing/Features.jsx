"use client";
import { Zap, MessageSquareText, Building2 } from "lucide-react";

const FEATURES = [
  {
    icon: Zap,
    title: "Instant analysis",
    body: "Drop any paystub — PDF, photo, or scan. We parse every line item in seconds with hybrid OCR plus reasoning.",
  },
  {
    icon: MessageSquareText,
    title: "Plain-language breakdown",
    body: "No jargon. We translate Box 12a, pre-tax benefits, and withholding codes into sentences a human can read.",
  },
  {
    icon: Building2,
    title: "Multi-employer support",
    body: "Juggling two jobs, 1099 gigs, and a W-2? We merge it all into one view and flag overlapping withholding.",
  },
];

export default function Features() {
  return (
    <section
      style={{
        padding: "120px 24px",
        background: "var(--paper-bg)",
        borderTop: "1px solid oklch(0.22 0.015 60 / 0.06)",
      }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ maxWidth: 680, marginBottom: 72 }}>
          <div
            className="font-mono"
            style={{ fontSize: 11, letterSpacing: "0.14em", color: "var(--paper-green)" }}
          >
            WHAT YOU GET
          </div>
          <h2
            className="font-serif"
            style={{
              fontSize: "clamp(36px, 5vw, 60px)",
              fontWeight: 500,
              lineHeight: 1.05,
              marginTop: 14,
              color: "var(--paper-fg)",
            }}
          >
            Clarity, <span className="font-italic">not clutter.</span>
          </h2>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20,
          }}
        >
          {FEATURES.map((f) => (
            <div
              key={f.title}
              style={{
                background: "var(--paper-bg)",
                border: "1px solid oklch(0.22 0.015 60 / 0.08)",
                borderRadius: 16,
                padding: 28,
                boxShadow: "0 1px 0 rgba(255,255,255,0.5) inset",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "oklch(0.38 0.08 155 / 0.1)",
                  color: "var(--paper-green)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 18,
                }}
              >
                <f.icon size={20} />
              </div>
              <h3
                className="font-serif"
                style={{
                  fontSize: 24,
                  fontWeight: 500,
                  color: "var(--paper-fg)",
                  marginBottom: 10,
                }}
              >
                {f.title}
              </h3>
              <p
                style={{
                  fontSize: 15,
                  lineHeight: 1.55,
                  color: "var(--paper-muted)",
                }}
              >
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
