"use client";

import Link from "next/link";
import { ArrowRight, Bot, Shield, PiggyBank, Zap, TrendingUp, CheckCircle, Star, Globe, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const FEATURES = [
  { icon: Bot, title: "AI Financial Copilot", desc: "Ask anything about your money in plain English. Powered by GPT-4o.", color: "text-indigo-600", bg: "bg-indigo-100" },
  { icon: Shield, title: "Real-time Fraud Detection", desc: "AI monitors every transaction. Unusual patterns get flagged instantly.", color: "text-emerald-600", bg: "bg-emerald-100" },
  { icon: PiggyBank, title: "Autonomous Savings", desc: "Set rules once. AI saves for you automatically when conditions are met.", color: "text-amber-600", bg: "bg-amber-100" },
  { icon: Zap, title: "Budget Planner", desc: "Know instantly: 'Can I afford it?' with risk scores and monthly breakdowns.", color: "text-purple-600", bg: "bg-purple-100" },
  { icon: TrendingUp, title: "Spending Analytics", desc: "Beautiful charts. Category breakdown, trends, month-over-month comparisons.", color: "text-rose-600", bg: "bg-rose-100" },
  { icon: Globe, title: "Multi-Currency", desc: "INR, USD, EUR, GBP — all in one place with real-time balances.", color: "text-cyan-600", bg: "bg-cyan-100" },
];

const TRUST_BADGES = [
  { icon: Lock, label: "256-bit Encryption" },
  { icon: Shield, label: "RBI Compliant" },
  { icon: CheckCircle, label: "FDIC Insured" },
  { icon: Star, label: "4.9★ App Store" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 backdrop-blur-lg bg-white/5 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
              <span className="text-white text-lg font-bold">₿</span>
            </div>
            <span className="font-bold text-lg">AI Smart Bank</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/login"><Button variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10">Sign In</Button></Link>
            <Link href="/auth/register"><Button className="bg-indigo-500 hover:bg-indigo-600 text-white">Get Started Free</Button></Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-20 pb-32">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-indigo-500/20 rounded-full blur-[120px]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Badge className="bg-indigo-500/20 text-indigo-200 border-indigo-500/30 mb-6 text-xs">✨ Powered by GPT-4o — India's smartest banking AI</Badge>
          <h1 className="text-5xl md:text-7xl font-bold leading-tight tracking-tight">
            Your money,<br />
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">supercharged by AI</span>
          </h1>
          <p className="text-xl text-white/60 mt-6 max-w-2xl mx-auto leading-relaxed">
            Banking that thinks for you. AI copilot answers your spending questions, autonomous agent saves automatically, fraud detection works 24/7.
          </p>
          <div className="mt-10 max-w-md mx-auto">
            <div className="flex gap-3 p-2 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20">
              <Link href="/auth/register" className="flex-1">
                <Button className="w-full bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl">Start Free <ArrowRight className="w-4 h-4 ml-2" /></Button>
              </Link>
            </div>
            <p className="text-xs text-white/40 mt-3">Free forever. No credit card. ₹10,000 welcome bonus.</p>
          </div>
          <div className="flex items-center justify-center gap-8 mt-12 flex-wrap">
            {TRUST_BADGES.map((b) => (
              <div key={b.label} className="flex items-center gap-2 text-white/50 text-sm">
                <b.icon className="w-4 h-4" />{b.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold">Everything you need, nothing you don&apos;t</h2>
          <p className="text-white/50 mt-3 text-lg">Built for people who want their money to work harder</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <Card key={f.title} className="bg-white/5 border-white/10 text-white hover:bg-white/10 transition-colors">
              <CardContent className="p-6">
                <div className={`w-12 h-12 ${f.bg} rounded-xl flex items-center justify-center mb-4`}>
                  <f.icon className={`w-6 h-6 ${f.color}`} />
                </div>
                <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-32">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-12 text-center">
          <h2 className="text-4xl font-bold">Start for free. Scale as you grow.</h2>
          <p className="text-white/70 mt-3 text-lg">₹10,000 welcome bonus. No credit card. Cancel anytime.</p>
          <div className="mt-8 flex justify-center gap-4">
            <Link href="/auth/register"><Button size="lg" className="bg-white text-indigo-600 hover:bg-white/90">Create Free Account <ArrowRight className="w-4 h-4 ml-2" /></Button></Link>
            <Link href="/auth/login"><Button size="lg" variant="outline" className="text-white border-white/30 hover:bg-white/10">Sign In</Button></Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center"><span className="text-white text-sm font-bold">₿</span></div>
            <span className="font-bold">AI Smart Bank</span>
          </div>
          <p className="text-white/40 text-sm">© 2026 AI Smart Bank. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}