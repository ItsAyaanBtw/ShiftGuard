"use client";
import { motion, useTransform } from "motion/react";
import { useMemo } from "react";

const TOKENS = [
  { label: "FED WH", value: "-$512.44", red: true },
  { label: "FICA OASDI", value: "-$247.12", red: true },
  { label: "STATE WH", value: "-$186.20", red: true },
  { label: "MEDICARE", value: "-$57.81", red: true },
  { label: "CITY TAX", value: "-$42.09", red: true },
  { label: "BONUS TAX", value: "-$318.00", red: true },
  { label: "SDI CA", value: "-$31.10", red: true },
  { label: "FUTA", value: "-$12.40", red: true },
  { label: "GROSS", value: "$4,218.00" },
  { label: "REG HRS", value: "80.00" },
  { label: "OT HRS", value: "6.25" },
  { label: "RATE", value: "$48.50/hr" },
  { label: "401k", value: "$210.90" },
  { label: "DENTAL", value: "$18.42" },
  { label: "VISION", value: "$6.10" },
  { label: "HSA", value: "$75.00" },
  { label: "BOX 12a · DD", value: "$204.11" },
  { label: "BOX 14", value: "NT-HLTH" },
  { label: "YTD GROSS", value: "$48,712.00" },
  { label: "YTD NET", value: "$34,108.22" },
  { label: "EMPLOYER", value: "ACME CO" },
  { label: "PERIOD", value: "03/18 – 03/31" },
  { label: "CHECK #", value: "00184227" },
  { label: "NET PAY", value: "$2,824.84" },
];

function seededRand(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export default function TokenField({ scrollYProgress }) {
  const items = useMemo(
    () =>
      TOKENS.map((t, i) => {
        const sx = seededRand(i + 1);
        const sy = seededRand(i + 101);
        const sr = seededRand(i + 201);
        const sd = seededRand(i + 301);
        return {
          ...t,
          x: 6 + sx * 88, // vw-ish %
          y: 8 + sy * 80, // vh-ish %
          rot: (sr - 0.5) * 18,
          drift: (sd - 0.5) * 40,
          key: i,
        };
      }),
    []
  );

  // Field opacity: visible 0–0.28, fade out 0.28–0.42
  const fieldOpacity = useTransform(scrollYProgress, [0, 0.05, 0.28, 0.42], [0, 1, 1, 0]);
  // Field scale during collapse
  const fieldScale = useTransform(scrollYProgress, [0.28, 0.42], [1, 0.4]);

  return (
    <motion.div
      style={{ opacity: fieldOpacity, scale: fieldScale }}
      className="absolute inset-0 pointer-events-none"
    >
      {items.map((t) => (
        <TokenItem key={t.key} token={t} scrollYProgress={scrollYProgress} />
      ))}
    </motion.div>
  );
}

function TokenItem({ token, scrollYProgress }) {
  // Collapse toward center (50%, 50%) between 0.28 and 0.42
  const dx = 50 - token.x;
  const dy = 50 - token.y;

  const tx = useTransform(scrollYProgress, [0, 0.28, 0.42], [0, 0, dx]);
  const ty = useTransform(scrollYProgress, [0, 0.28, 0.42], [0, 0, dy]);
  // Gentle parallax drift before collapse
  const drift = useTransform(scrollYProgress, [0, 0.28], [0, token.drift]);
  const yCombined = useTransform([ty, drift], ([a, b]) => `calc(${a}% + ${b}px)`);
  const xCombined = useTransform(tx, (v) => `${v}%`);

  return (
    <motion.div
      className={`env-token ${token.red ? "env-token--red" : ""}`}
      style={{
        position: "absolute",
        left: `${token.x}%`,
        top: `${token.y}%`,
        translateX: xCombined,
        translateY: yCombined,
        rotate: token.rot,
      }}
    >
      <span className="lbl">{token.label}</span>
      <span className="val">{token.value}</span>
    </motion.div>
  );
}
