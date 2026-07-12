import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  CheckSquare, Bell, BarChart2, Shield, Users, Rocket,
  ArrowRight, Calendar, Kanban, CheckCircle2, RefreshCw,
  Timer, Server, Database, Lock, Package, Wrench, Headphones,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "../components/ui";
import TeamImage from "../assets/Team.jpg";

const FEATURES = [
  { Icon: CheckSquare, title: "Task Management",     desc: "Create, prioritize, and track every task with due dates, status labels, and subtasks — all in one place." },
  { Icon: Kanban,      title: "Kanban Boards",       desc: "Visualize your workflow with drag-and-drop columns. Move tasks from To-Do to Done with ease." },
  { Icon: Calendar,    title: "Calendar View",       desc: "See all deadlines in a monthly calendar. Plan ahead and never miss a due date again." },
  { Icon: Timer,       title: "Time Tracking",       desc: "Track time spent on tasks with live timers, synced across your team in real time via Socket.IO." },
  { Icon: Bell,        title: "Smart Notifications", desc: "Get real-time alerts when tasks are updated or deadlines are approaching." },
  { Icon: BarChart2,   title: "Velocity Analytics",  desc: "Track your team's completion rate. Identify bottlenecks and improve delivery speed." },
  { Icon: Users,       title: "Team Collaboration",  desc: "Invite teammates, assign tasks, and work in shared workspaces with live real-time updates." },
  { Icon: Shield,      title: "Secure by default",   desc: "bcrypt passwords, signed JWTs blocklisted on logout, SHA-256 reset tokens — security built in." },
];

const WHY = [
  { Icon: Database, title: "Your data, your server",    desc: "Teevexa Ordo runs entirely on your infrastructure. No data reaches our servers after purchase." },
  { Icon: Lock,     title: "One fee. No subscriptions.", desc: "Pay once for the license. No monthly per-seat charges that grow as your team grows." },
  { Icon: Server,   title: "Full control",              desc: "Host on AWS, Azure, GCP, on-premise, or air-gapped. You choose where and how it runs." },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Try the demo — free",           desc: "Sign up right here and use the fully working product on our demo servers. No credit card, no time limit." },
  { step: "02", title: "Purchase the license",          desc: "When you're ready, email us. You get the full source code and a one-time license to self-host." },
  { step: "03", title: "Deploy on your infrastructure", desc: "We guide you through deployment or hand it to your dev team. Your instance, your data, your control." },
];

const INCLUDED = [
  { Icon: Package,     title: "Full source code",      desc: "Complete React + Flask codebase. No black-box binaries — read it, modify it, make it yours." },
  { Icon: RefreshCw,   title: "2 months free support",  desc: "Bug fixes and direct support for 60 days after purchase — covering deployment and initial stabilization. Paid maintenance and feature upgrades available after that." },
  { Icon: Wrench,      title: "Deployment assistance",  desc: "We help you get it running on your server the first time, step by step." },
  { Icon: Headphones,  title: "Optional maintenance plan", desc: "After the free support period, renew for continued updates, new features, and priority support on a paid basis." },
];

const FAQS = [
  {
    question: "What does 'self-hosted' mean?",
    answer: "Self-hosted means you run Teevexa Ordo on your own server or cloud account (AWS, Azure, GCP, your own VPS, etc.). We give you the source code; you deploy it where you like. Your data never touches our infrastructure after purchase.",
  },
  {
    question: "Can I try it before buying?",
    answer: "Yes — that's exactly what the demo is for. Sign up here and use the full product on our demo servers with your real team. When you're confident it's the right fit, contact us about purchasing the self-hosted license.",
  },
  {
    question: "What's included in the license?",
    answer: "You get the complete source code (React frontend + Flask API), one year of bug fixes and feature updates, deployment assistance to get your instance running, and direct support access. After the first year you can renew the maintenance plan or keep using it as-is.",
  },
  {
    question: "What do we need to host it?",
    answer: "A Linux server or any cloud VM (1 vCPU, 1 GB RAM is enough for small teams), a PostgreSQL database, and a domain name. We provide a Docker setup and a step-by-step deployment guide.",
  },
  {
    question: "Is there a per-seat fee after purchase?",
    answer: "No. The license is a one-time fee regardless of how many users you add. Invite your entire company — the price doesn't change.",
  },
  {
    question: "How do we purchase the license?",
    answer: "Email us at sales@teevexa.com and tell us about your team size and use case. We'll send you a quote and a license agreement. Payment is processed via invoice.",
  },
];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay },
});

const LandingPage = () => {
  const navigate = useNavigate();
  const [openFAQ, setOpenFAQ] = useState(null);

  useEffect(() => {
    const target = sessionStorage.getItem("scrollTarget");
    if (target) {
      sessionStorage.removeItem("scrollTarget");
      setTimeout(() => {
        document.getElementById(target)?.scrollIntoView({ behavior: "smooth" });
      }, 150);
    }
  }, []);

  return (
    <div className="bg-page text-text overflow-x-hidden">

      {/* ── Hero ───────────────────────────────────────── */}
      <section className="relative min-h-[92vh] flex items-center justify-center text-center px-4 sm:px-6 bg-sidebar overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full bg-primary/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-sidebar/80 to-transparent pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto">
          <motion.div {...fadeUp(0)}>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary text-xs font-semibold mb-6">
              <Server size={11} /> Self-hosted · One-time license
            </span>
          </motion.div>

          <motion.h1
            className="text-4xl sm:text-5xl lg:text-7xl font-black text-white leading-tight tracking-tight"
            {...fadeUp(0.1)}
          >
            Own your project<br />
            <span className="text-primary">management software.</span>
          </motion.h1>

          <motion.p
            className="mt-6 text-lg sm:text-xl text-white/70 max-w-2xl mx-auto leading-relaxed"
            {...fadeUp(0.2)}
          >
            One-time license. Hosted on your server. No monthly per-seat fees.
            Your data stays on your infrastructure — forever.
          </motion.p>

          <motion.div
            className="mt-10 flex flex-col sm:flex-row gap-3 justify-center"
            {...fadeUp(0.3)}
          >
            <Button size="lg" onClick={() => navigate("/signup")}>
              Try the demo — free <ArrowRight size={16} className="ml-1" />
            </Button>
            <a href="mailto:sales@teevexa.com">
              <Button
                size="lg"
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10 w-full sm:w-auto"
              >
                Contact for licensing
              </Button>
            </a>
          </motion.div>

          <motion.div
            className="mt-10 flex flex-wrap items-center justify-center gap-6 text-white/50 text-sm"
            {...fadeUp(0.4)}
          >
            {["Try before you buy", "Self-hosted", "One-time fee", "Source code included"].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-success" /> {t}
              </span>
            ))}
          </motion.div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <div className="w-px h-10 bg-gradient-to-b from-transparent to-white/30" />
        </div>
      </section>

      {/* ── Why self-hosted ───────────────────────────── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-surface border-b border-border">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">Why self-hosted?</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-text">You pay once. You own it.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {WHY.map(({ Icon, title, desc }, i) => (
              <motion.div
                key={title}
                className="flex flex-col gap-4 p-7 bg-page rounded-2xl border border-border hover:border-primary/40 transition-colors"
                {...fadeUp(i * 0.1)}
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Icon size={20} className="text-primary" />
                </div>
                <h3 className="font-semibold text-text">{title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8 bg-page">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">How it works</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-text">From demo to deployed in three steps</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map(({ step, title, desc }, i) => (
              <motion.div
                key={step}
                className="relative flex flex-col gap-4 p-7 bg-surface rounded-2xl border border-border"
                {...fadeUp(i * 0.1)}
              >
                <span className="text-5xl font-black text-primary/10 leading-none">{step}</span>
                <h3 className="text-base font-bold text-text -mt-2">{title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────── */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 bg-surface">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">Features</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-text">Everything your team needs</h2>
            <p className="mt-4 text-text-muted max-w-xl mx-auto">
              Tasks, Kanban, calendar, time tracking, analytics, and real-time collaboration — all included in the license.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(({ Icon, title, desc }, i) => (
              <motion.div
                key={title}
                className="group flex flex-col gap-3 p-6 bg-page rounded-2xl border border-border hover:border-primary/40 hover:shadow-card transition-all"
                {...fadeUp(i * 0.05)}
                whileHover={{ y: -3 }}
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Icon size={20} className="text-primary" />
                </div>
                <h3 className="font-semibold text-text">{title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Team split ────────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-page">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-14">
          <motion.div className="lg:w-1/2" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }}>
            <img src={TeamImage} alt="Team collaborating" className="w-full rounded-2xl shadow-card" />
          </motion.div>
          <div className="lg:w-1/2">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">Built for your company</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-text leading-tight">
              Software you control.<br />Data you own.
            </h2>
            <p className="mt-5 text-text-muted leading-relaxed">
              Most project management tools are rented — you pay every month and your data lives on someone
              else&apos;s servers. Teevexa Ordo flips that. You purchase the software once and run it on your
              own infrastructure, on your terms.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "No per-seat fees that grow with your team",
                "Your data never leaves your servers",
                "Meets data-residency and compliance requirements",
                "Extend or customise the source code as needed",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-text-muted">
                  <CheckCircle2 size={16} className="text-success mt-0.5 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button onClick={() => navigate("/signup")}>
                Try it free <ArrowRight size={15} className="ml-1" />
              </Button>
              <a href="mailto:sales@teevexa.com">
                <Button variant="outline">Contact sales</Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── What's included ───────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-surface border-t border-border">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">License</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-text">What&apos;s in the box</h2>
            <p className="mt-4 text-text-muted max-w-xl mx-auto">
              Every Teevexa Ordo license includes everything you need to get up and running on your own server.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {INCLUDED.map(({ Icon, title, desc }, i) => (
              <motion.div
                key={title}
                className="flex items-start gap-4 p-6 bg-page rounded-2xl border border-border hover:border-primary/40 transition-colors"
                {...fadeUp(i * 0.08)}
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon size={20} className="text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-text mb-1">{title}</h3>
                  <p className="text-sm text-text-muted leading-relaxed">{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────── */}
      <section id="faq" className="py-24 px-4 sm:px-6 lg:px-8 bg-page border-t border-border">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">FAQ</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-text">Common questions</h2>
            <p className="mt-4 text-text-muted">
              Still have questions?{" "}
              <a href="mailto:sales@teevexa.com" className="text-primary hover:underline">Email us.</a>
            </p>
          </div>
          <div className="max-w-7xl mx-auto space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="bg-surface rounded-xl border border-border overflow-hidden">
                <button
                  onClick={() => setOpenFAQ(openFAQ === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-medium text-text hover:bg-surface-muted transition-colors"
                >
                  <span>{faq.question}</span>
                  {openFAQ === i
                    ? <ChevronUp size={15} className="text-primary flex-shrink-0 ml-3" />
                    : <ChevronDown size={15} className="text-text-muted flex-shrink-0 ml-3" />
                  }
                </button>
                {openFAQ === i && (
                  <div className="px-5 pb-5 text-sm text-text-muted leading-relaxed border-t border-border pt-4">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────── */}
      <section className="py-28 px-4 sm:px-6 bg-sidebar">
        <div className="max-w-7xl mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-6">
            <Rocket size={30} className="text-primary" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            Ready to own your software?
          </h2>
          <p className="mt-4 text-white/60 text-lg max-w-xl mx-auto">
            Try the demo today — free, no card, no time limit. When you&apos;re ready to purchase
            the license and host it yourself, we&apos;re one email away.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" onClick={() => navigate("/signup")}>
              Try the demo free <ArrowRight size={16} className="ml-1" />
            </Button>
            <a href="mailto:sales@teevexa.com">
              <Button
                size="lg"
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10 w-full sm:w-auto"
              >
                Contact for licensing
              </Button>
            </a>
          </div>
        </div>
      </section>

    </div>
  );
};

export default LandingPage;
