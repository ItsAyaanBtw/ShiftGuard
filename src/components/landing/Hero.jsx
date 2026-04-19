"use client";
import { motion } from "motion/react";
import { ArrowDown } from "lucide-react";

export default function Hero() {
  return (
    <section
      className="env-grid-bg"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "120px 24px 80px",
        background: "var(--paper-bg)",
      }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto", width: "100%" }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          <div
            className="font-mono"
            style={{
              fontSize: 12,
              letterSpacing: "0.16em",
              color: "var(--paper-green)",
              marginBottom: 28,
            }}
          >
            PAYSTUB · SIMPLIFIED
          </div>
          <h1
            className="font-serif"
            style={{
              fontSize: "clamp(56px, 10vw, 148px)",
              fontWeight: 500,
              lineHeight: 0.95,
              color: "var(--paper-fg)",
              letterSpacing: "-0.035em",
              maxWidth: 1000,
            }}
          >
            We give you <br />
            <span className="font-italic">what matters.</span>
          </h1>
          <p
            style={{
              marginTop: 36,
              fontSize: 19,
              lineHeight: 1.5,
              color: "var(--paper-muted)",
              maxWidth: 560,
            }}
          >
            Paystubs are a blur of codes, boxes, and deductions. We turn them into one clean
            envelope — every dollar accounted for.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ delay: 1.4, duration: 1 }}
          style={{
            marginTop: 96,
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: "var(--paper-muted)",
            fontSize: 13,
          }}
        >
          <ArrowDown size={14} />
          Scroll
        </motion.div>
      </div>
    </section>
  );
}
