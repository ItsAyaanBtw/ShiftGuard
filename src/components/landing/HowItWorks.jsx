"use client";

const STEPS = [
  {
    n: "01",
    title: "Upload your paystub",
    body: "PDF, PNG, or phone photo. Drop it in — we handle rotation, glare, and messy formats.",
  },
  {
    n: "02",
    title: "We do the math",
    body: "Every deduction, every benefit, every withholding code. Mapped, labeled, double-checked against IRS tables.",
  },
  {
    n: "03",
    title: "Get your envelope",
    body: "One clean summary. Take-home, what went to taxes, what went to benefits, what hit your bank.",
  },
];

export default function HowItWorks() {
  return (
    <section
      style={{
        padding: "120px 24px",
        background: "var(--paper-bg-warm)",
      }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ maxWidth: 680, marginBottom: 72 }}>
          <div
            className="font-mono"
            style={{ fontSize: 11, letterSpacing: "0.14em", color: "var(--paper-green)" }}
          >
            HOW IT WORKS
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
            Three steps. <span className="font-italic">That's it.</span>
          </h2>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 0,
            borderTop: "1px solid oklch(0.22 0.015 60 / 0.1)",
          }}
        >
          {STEPS.map((s, i) => (
            <div
              key={s.n}
              style={{
                padding: "40px 28px",
                borderRight:
                  i < STEPS.length - 1 ? "1px solid oklch(0.22 0.015 60 / 0.1)" : "none",
                borderBottom: "1px solid oklch(0.22 0.015 60 / 0.1)",
              }}
            >
              <div
                className="font-mono"
                style={{
                  fontSize: 12,
                  color: "var(--paper-green)",
                  letterSpacing: "0.1em",
                  marginBottom: 24,
                }}
              >
                {s.n}
              </div>
              <h3
                className="font-serif"
                style={{
                  fontSize: 26,
                  fontWeight: 500,
                  color: "var(--paper-fg)",
                  marginBottom: 10,
                }}
              >
                {s.title}
              </h3>
              <p
                style={{
                  fontSize: 15,
                  lineHeight: 1.55,
                  color: "var(--paper-muted)",
                }}
              >
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
