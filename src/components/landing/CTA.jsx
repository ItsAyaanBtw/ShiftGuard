"use client";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function CTA() {
  return (
    <section
      style={{
        padding: "160px 24px 140px",
        background: "var(--paper-bg)",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <h2
          className="font-serif font-italic"
          style={{
            fontSize: "clamp(52px, 9vw, 128px)",
            fontWeight: 500,
            lineHeight: 0.98,
            color: "var(--paper-fg)",
            letterSpacing: "-0.03em",
          }}
        >
          We give you what matters.
        </h2>
        <p
          style={{
            marginTop: 28,
            fontSize: 18,
            color: "var(--paper-muted)",
            maxWidth: 560,
            marginLeft: "auto",
            marginRight: "auto",
            lineHeight: 1.55,
          }}
        >
          Upload a single paystub. See exactly where every dollar went — in under thirty seconds.
        </p>
        <div
          style={{
            marginTop: 40,
            display: "flex",
            gap: 14,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <Link to="/upload" className="env-btn">
            Analyze my paystub <ArrowRight size={16} />
          </Link>
          <Link to="/pricing" className="env-btn env-btn--ghost">
            See pricing
          </Link>
        </div>
      </div>
    </section>
  );
}
