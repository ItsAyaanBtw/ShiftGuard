"use client";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import TokenField from "./TokenField";
import Envelope, { LockBadge } from "./Envelope";

export default function StickyStory() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  // Background warms from paper → warm paper as we near sealed

  // Captions
  const cap1 = useTransform(scrollYProgress, [0.02, 0.08, 0.24, 0.3], [0, 1, 1, 0]);
  const cap2 = useTransform(scrollYProgress, [0.42, 0.5, 0.62, 0.68], [0, 1, 1, 0]);
  const cap3 = useTransform(scrollYProgress, [0.9, 0.94], [0, 1]);

  return (
    <section ref={ref} style={{ position: "relative", height: "500vh" }}>
      <motion.div
        style={{ height: "100%" }}
        
        // sticky stage
      >
        <div
          style={{
            position: "sticky",
            top: 0,
            height: "100vh",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Token field (Act 1 + bridge) */}
          <TokenField scrollYProgress={scrollYProgress} />

          {/* Envelope (Acts 2–4) */}
          <div style={{ position: "relative", zIndex: 2 }}>
            <Envelope scrollYProgress={scrollYProgress} />
          </div>

          {/* Captions */}
          <motion.div
            style={{ opacity: cap1 }}
            className="absolute left-0 right-0 text-center"
            // top position
          >
            <div style={{ position: "absolute", top: "14vh", left: 0, right: 0 }}>
              <p
                className="font-serif font-italic"
                style={{
                  fontSize: "clamp(28px, 4.5vw, 48px)",
                  color: "var(--paper-fg)",
                  fontWeight: 400,
                }}
              >
                Your paystub is chaos.
              </p>
            </div>
          </motion.div>

          <motion.div
            style={{ opacity: cap2 }}
            className="absolute left-0 right-0 text-center"
          >
            <div style={{ position: "absolute", top: "14vh", left: 0, right: 0 }}>
              <p
                className="font-serif font-italic"
                style={{
                  fontSize: "clamp(28px, 4.5vw, 48px)",
                  color: "var(--paper-fg)",
                  fontWeight: 400,
                }}
              >
                We pull out what matters.
              </p>
            </div>
          </motion.div>

          <motion.div
            style={{ opacity: cap3 }}
            className="absolute left-0 right-0"
          >
            <div
              style={{
                position: "absolute",
                bottom: "12vh",
                left: 0,
                right: 0,
                textAlign: "center",
              }}
            >
              <p
                className="font-serif font-italic"
                style={{
                  fontSize: "clamp(26px, 4vw, 42px)",
                  color: "var(--paper-fg)",
                  fontWeight: 400,
                }}
              >
                Sealed. Understood.
              </p>
              <p
                style={{
                  marginTop: 10,
                  fontSize: 15,
                  color: "var(--paper-muted)",
                }}
              >
                One envelope. Every dollar accounted for.
              </p>
              <div style={{ marginTop: 14 }}>
                <LockBadge />
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
