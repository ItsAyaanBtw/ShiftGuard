"use client";
import { Link } from 'react-router-dom'
import BrandMark, { Wordmark } from '../components/BrandMark'
import "../components/landing/envelope.css";
import Hero from "../components/landing/Hero";
import StickyStory from "../components/landing/StickyStory";
import Features from "../components/landing/Features";
import HowItWorks from "../components/landing/HowItWorks";
import CTA from "../components/landing/CTA";
import Footer from "../components/landing/Footer";

export default function EnvelopeLanding() {
  return (
    <div className="env-landing">
      {/* ---------- Nav ---------- */}
      <nav className="relative z-30 px-4 sm:px-6 pt-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 rounded-2xl border border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-3 sm:px-5 py-2.5 shadow-md">
          <Link to="/" className="flex items-center gap-2 min-w-0 px-2 py-1.5 -ml-2 rounded-lg hover:bg-slate-800/60 transition-colors">
            <BrandMark size={28} />
            <Wordmark size={22} className="hidden sm:inline-flex text-white" />
            <span className="sm:hidden text-base font-semibold text-white tracking-tight truncate">ShiftGuard</span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <Link
              to="/log"
              className="text-sm font-medium text-slate-300 hover:text-white px-3 py-2 rounded-lg hover:bg-slate-800/80 min-h-[40px] inline-flex items-center"
            >
              App
            </Link>
            <Link
              to="/pricing"
              className="text-sm font-medium text-slate-400 hover:text-terracotta px-3 py-2 rounded-lg min-h-[40px] inline-flex items-center"
            >
              Pricing
            </Link>
            <Link
              to="/auth?next=/upload"
              className="text-sm font-semibold bg-terracotta text-white hover:bg-terracotta-light transition-colors px-4 py-2 rounded-lg ml-1 sm:ml-2 min-h-[40px] inline-flex items-center"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      <Hero />
      <StickyStory />
      <Features />
      <HowItWorks />
      <CTA />
      <Footer />
    </div>
  );
}
