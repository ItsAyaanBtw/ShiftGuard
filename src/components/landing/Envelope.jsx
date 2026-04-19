"use client";
import { motion, useTransform } from "motion/react";
import { Check, Lock } from "lucide-react";

export default function Envelope({ scrollYProgress }) {
  // Envelope enters between 0.38–0.55
  const envOpacity = useTransform(scrollYProgress, [0.36, 0.5], [0, 1]);
  const envScale = useTransform(scrollYProgress, [0.36, 0.55], [0.85, 1]);

  // Summary card slides down 0.48–0.65
  const cardY = useTransform(scrollYProgress, [0.48, 0.65], [-220, 0]);
  const cardOpacity = useTransform(scrollYProgress, [0.46, 0.58], [0, 1]);

  // Flap closes 0.65–0.88 from -180 → 0 deg
  const flapRotate = useTransform(scrollYProgress, [0.65, 0.88], [-180, 0]);

  // Seal pops at 0.88–0.95
  const sealScale = useTransform(scrollYProgress, [0.88, 0.93, 0.97], [0, 1.25, 1]);
  const sealOpacity = useTransform(scrollYProgress, [0.87, 0.9], [0, 1]);

  // Shadow deepens as sealed
  const shadowOpacity = useTransform(scrollYProgress, [0.38, 0.95], [0.15, 0.35]);

  return (
    <motion.div
      style={{ opacity: envOpacity, scale: envScale }}
      className="relative"
    >
      {/* Ground shadow */}
      <motion.div
        style={{ opacity: shadowOpacity }}
        className="absolute left-1/2 -translate-x-1/2"
        initial={false}
        aria-hidden
      >
        <div
          style={{
            width: "min(440px, 70vw)",
            height: 40,
            marginTop: 24,
            background: "radial-gradient(ellipse at center, rgba(60,40,20,0.5), transparent 70%)",
            filter: "blur(14px)",
            transform: "translateY(12px)",
          }}
        />
      </motion.div>

      <div
        style={{
          width: "min(520px, 82vw)",
          aspectRatio: "1.7 / 1",
          perspective: "1200px",
          position: "relative",
        }}
      >
        {/* Envelope body (back) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "var(--paper-kraft)",
            borderRadius: 10,
            boxShadow:
              "inset 0 2px 4px rgba(255,255,255,0.35), inset 0 -6px 18px rgba(80,50,20,0.22), 0 18px 40px -18px rgba(60,40,20,0.35)",
            overflow: "hidden",
          }}
        >
          {/* Crease lines V */}
          <svg
            viewBox="0 0 520 306"
            preserveAspectRatio="none"
            width="100%"
            height="100%"
            style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
          >
            <path
              d="M0 0 L260 138 L520 0"
              stroke="oklch(0.35 0.06 55 / 0.22)"
              strokeWidth="1"
              fill="none"
            />
            <path
              d="M0 306 L260 168 L520 306"
              stroke="oklch(0.35 0.06 55 / 0.18)"
              strokeWidth="1"
              fill="none"
            />
          </svg>
        </div>

        {/* Summary card — slides down from above, sits behind flap */}
        <motion.div
          style={{
            y: cardY,
            opacity: cardOpacity,
            position: "absolute",
            left: "8%",
            right: "8%",
            top: "10%",
            bottom: "10%",
            background: "var(--paper-bg)",
            borderRadius: 8,
            padding: "18px 22px",
            boxShadow:
              "0 1px 0 rgba(255,255,255,0.6) inset, 0 12px 28px -10px rgba(60,40,20,0.35), 0 0 0 1px oklch(0.22 0.015 60 / 0.06)",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              className="font-mono"
              style={{ fontSize: 10, color: "var(--paper-muted)", letterSpacing: "0.08em" }}
            >
              TAKE-HOME · PERIOD 03/18 – 03/31
            </div>
            <div
              className="font-serif"
              style={{
                fontSize: "clamp(34px, 6vw, 56px)",
                fontWeight: 500,
                lineHeight: 1,
                marginTop: 6,
                color: "var(--paper-green)",
              }}
            >
              $2,824<span style={{ color: "var(--paper-muted)", fontSize: "0.55em" }}>.84</span>
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
              borderTop: "1px solid oklch(0.22 0.015 60 / 0.08)",
              paddingTop: 10,
            }}
          >
            <Stat label="Gross" value="$4,218" />
            <Stat label="Taxes" value="-$1,077" red />
            <Stat label="Benefits" value="-$316" />
          </div>
        </motion.div>

        {/* Bottom pocket (clipped, darker, overlaps card) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "var(--paper-kraft-dark)",
            clipPath: "polygon(0% 45%, 100% 45%, 100% 100%, 0% 100%)",
            borderRadius: 10,
            boxShadow: "inset 0 8px 16px -4px rgba(60,40,20,0.35)",
            zIndex: 2,
          }}
          aria-hidden
        />

        {/* Flap — top triangle, rotating */}
        <motion.div
          style={{
            position: "absolute",
            inset: 0,
            transformOrigin: "top center",
            transformStyle: "preserve-3d",
            rotateX: flapRotate,
            zIndex: 3,
          }}
        >
          {/* Outer face (visible when closed) */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "var(--paper-kraft-dark)",
              clipPath: "polygon(0% 0%, 100% 0%, 50% 100%)",
              backfaceVisibility: "hidden",
              boxShadow: "inset 0 2px 0 rgba(255,255,255,0.25)",
            }}
          />
          {/* Inner face (visible when open/rotated 180) */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "var(--paper-kraft)",
              clipPath: "polygon(0% 0%, 100% 0%, 50% 100%)",
              transform: "rotateX(180deg)",
              backfaceVisibility: "hidden",
            }}
          />
        </motion.div>

        {/* Wax seal */}
        <motion.div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            x: "-50%",
            y: "-50%",
            scale: sealScale,
            opacity: sealOpacity,
            zIndex: 4,
            width: 78,
            height: 78,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 35% 30%, oklch(0.5 0.1 155), oklch(0.3 0.08 155) 70%)",
            boxShadow:
              "inset 0 2px 4px rgba(255,255,255,0.3), inset 0 -6px 10px rgba(0,0,0,0.35), 0 10px 24px -8px rgba(20,40,25,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--paper-bg)",
          }}
        >
          <Check size={32} strokeWidth={3} />
        </motion.div>
      </div>
    </motion.div>
  );
}

function Stat({ label, value, red }) {
  return (
    <div>
      <div
        className="font-mono"
        style={{ fontSize: 9, color: "var(--paper-muted)", letterSpacing: "0.08em" }}
      >
        {label.toUpperCase()}
      </div>
      <div
        className="font-mono"
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: red ? "var(--paper-red-fg)" : "var(--paper-fg)",
          marginTop: 2,
        }}
      >
        {value}
      </div>
    </div>
  );
}

export function LockBadge() {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        borderRadius: 999,
        background: "oklch(0.22 0.015 60 / 0.05)",
        color: "var(--paper-muted)",
        fontSize: 12,
        fontWeight: 500,
      }}
    >
      <Lock size={13} />
      AES-256 encrypted at rest
    </div>
  );
}
