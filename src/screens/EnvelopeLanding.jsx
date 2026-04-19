"use client";
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
      <Hero />
      <StickyStory />
      <Features />
      <HowItWorks />
      <CTA />
      <Footer />
    </div>
  );
}
