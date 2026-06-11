import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  CheckSquare, Bell, BarChart2, Shield, Users, Rocket,
  ArrowRight, Zap, Calendar, Kanban, CheckCircle2,
  RefreshCw, Lock, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "../components/ui";
import TeamImage from "../assets/Team.jpg";

const FEATURES = [
  { Icon: CheckSquare, title: "Task Management",     desc: "Create, prioritize, and track every task with due dates, status labels, and subtasks — all in one place." },
  { Icon: Kanban,      title: "Kanban Boards",       desc: "Visualize your workflow with drag-and-drop Kanban columns. Move tasks from To-Do to Done effortlessly." },
  { Icon: Calendar,    title: "Calendar View",       desc: "See all your deadlines in a monthly calendar. Plan ahead and never miss a due date again." },
  { Icon: Bell,        title: "Smart Notifications", desc: "Get real-time alerts when tasks are updated or deadlines are approaching — so nothing slips through." },
  { Icon: BarChart2,   title: "Velocity Analytics",  desc: "Track your team's completion rate week by week. Identify bottlenecks and improve delivery speed." },
  { Icon: Users,       title: "Team Collaboration",  desc: "Invite teammates, assign tasks, and work in shared workspaces with live updates via Socket.IO." },
  { Icon: Shield,      title: "Secure by default",   desc: "Passwords are bcrypt-hashed, JWTs are signed and blocklisted on logout, and reset tokens are SHA-256 hashed." },
  { Icon: Zap,         title: "Real-time sync",      desc: "Powered by Flask-SocketIO, every task update reaches your whole team instantly — no refresh needed." },
];

const STATS = [
  { icon: CheckSquare, value: "10,000+",   label: "Tasks organized" },
  { icon: Users,       value: "500+",      label: "Teams onboarded" },
  { icon: RefreshCw,   value: "Real-time", label: "Live collaboration" },
  { icon: Lock,        value: "Secure",    label: "JWT + bcrypt auth" },
];

const STEPS = [
  { step: "01", title: "Create your workspace", desc: "Sign up and get a personal workspace in seconds — no credit card required." },
  { step: "02", title: "Add tasks & assign them", desc: "Create task lists, set priorities and due dates, and assign work to your team." },
  { step: "03", title: "Track & ship faster",    desc: "Monitor progress on the Kanban board, calendar, or dashboard — and deliver on time." },
];

const VALUES = [
  { title: "Simplicity first",     desc: "The best tool is the one you actually use. Taskly is intentionally simple — powerful where it matters, absent where it doesn't." },
  { title: "Calm over chaos",      desc: "Productivity shouldn't feel stressful. Our design reduces noise, surfaces what matters, and keeps your team focused." },
  { title: "Transparency",         desc: "Everyone on your team sees the same picture. No hidden state, no confused handoffs — clear ownership and visible progress." },
  { title: "Built for real teams", desc: "Every feature is designed around how teams actually work, not how productivity gurus say they should." },
];

const FAQS = [
  {
    question: "Is Taskly really free?",
    answer: "Yes — Taskly is free to start with no credit card required. Create a workspace, invite your team, and use every feature without any trial limits.",
  },
  {
    question: "How do I invite teammates?",
    answer: "From your workspace, open the Shareboard. You can invite people by email or copy a shareable invite link. Invited users join your workspace and can be assigned tasks immediately.",
  },
  {
    question: "Can I reset my password if I forget it?",
    answer: "Yes. Click 'Forgot password?' on the login screen and enter your email. You'll receive a secure reset link valid for 1 hour.",
  },
  {
    question: "Where is Taskly hosted?",
    answer: "The Taskly web app is hosted on Vercel and the API on Render. Both run on globally distributed infrastructure for low-latency access.",
  },
  {
    question: "Is my data secure?",
    answer: "Yes. Passwords are hashed with bcrypt, JWTs are signed and blocklisted on logout, and password-reset tokens are SHA-256 hashed before storage. We do not sell or share your data.",
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
        {/* Subtle background glow — no photo */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full bg-primary/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-sidebar/80 to-transparent pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto">
          <motion.div {...fadeUp(0)}>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary text-xs font-semibold mb-6">
              <Zap size={11} /> Now with real-time collaboration
            </span>
          </motion.div>

          <motion.h1
            className="text-4xl sm:text-5xl lg:text-7xl font-black text-white leading-tight tracking-tight"
            {...fadeUp(0.1)}
          >
            Your team&apos;s work,<br />
            <span className="text-primary">finally organized.</span>
          </motion.h1>

          <motion.p
            className="mt-6 text-lg sm:text-xl text-white/70 max-w-2xl mx-auto leading-relaxed"
            {...fadeUp(0.2)}
          >
            Taskly brings tasks, deadlines, and teammates into one calm, focused workspace.
            Stop juggling tools — start shipping.
          </motion.p>

          <motion.div
            className="mt-10 flex flex-col sm:flex-row gap-3 justify-center"
            {...fadeUp(0.3)}
          >
            <Button size="lg" onClick={() => navigate("/signup")}>
              Start for free — no card needed <ArrowRight size={16} className="ml-1" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
              className="border-white/30 text-white hover:bg-white/10"
            >
              See how it works
            </Button>
          </motion.div>

          <motion.div
            className="mt-10 flex flex-wrap items-center justify-center gap-6 text-white/50 text-sm"
            {...fadeUp(0.4)}
          >
            {["Free to start", "No credit card", "Real-time sync", "Cancel anytime"].map((t) => (
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

      {/* ── Stats strip ───────────────────────────────── */}
      <section className="py-10 px-4 sm:px-6 lg:px-8 bg-surface border-b border-border">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map(({ icon: Icon, value, label }, i) => (
            <motion.div
              key={label}
              className="flex flex-col items-center gap-2 text-center"
              {...fadeUp(i * 0.08)}
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Icon size={20} className="text-primary" />
              </div>
              <p className="text-2xl font-black text-text">{value}</p>
              <p className="text-xs text-text-muted font-medium">{label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── How it works ──────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8 bg-surface">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">How it works</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-text">Three steps to clarity</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map(({ step, title, desc }, i) => (
              <motion.div
                key={step}
                className="relative flex flex-col gap-4 p-7 bg-page rounded-2xl border border-border"
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
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 bg-page">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">Features</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-text">Everything your team needs</h2>
            <p className="mt-4 text-text-muted max-w-xl mx-auto">
              No feature bloat. No paywalls. Just the right set of tools to help your team stay organized and deliver consistently.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(({ Icon, title, desc }, i) => (
              <motion.div
                key={title}
                className="group flex flex-col gap-3 p-6 bg-surface rounded-2xl border border-border hover:border-primary/40 hover:shadow-card transition-all"
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
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-surface">
        <div className="max-w-5xl mx-auto flex flex-col lg:flex-row items-center gap-14">
          <motion.div className="lg:w-1/2" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }}>
            <img src={TeamImage} alt="Team collaborating" className="w-full rounded-2xl shadow-card" />
          </motion.div>
          <div className="lg:w-1/2">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">Built for teams</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-text leading-tight">
              Less chaos,<br />more done.
            </h2>
            <p className="mt-5 text-text-muted leading-relaxed">
              Taskly gives every team member a clear picture of what&apos;s happening, what&apos;s next,
              and who owns what — without the noise of endless status meetings.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "Real-time task updates across your whole team",
                "Shared Kanban boards with drag-and-drop",
                "Deadline notifications so nothing falls through",
                "Velocity tracking to improve sprint by sprint",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-text-muted">
                  <CheckCircle2 size={16} className="text-success mt-0.5 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Button onClick={() => navigate("/signup")}>
                Get started free <ArrowRight size={15} className="ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Values ────────────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-page">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">What we stand for</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-text">Built on principles, not hype.</h2>
            <p className="mt-4 text-text-muted max-w-xl mx-auto">
              Every design and product decision at Taskly comes back to these four ideas.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {VALUES.map(({ title, desc }, i) => (
              <motion.div
                key={title}
                className="bg-surface rounded-2xl border border-border p-7 hover:border-primary/40 transition-colors"
                {...fadeUp(i * 0.08)}
              >
                <h3 className="font-semibold text-text mb-2">{title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────── */}
      <section id="faq" className="py-24 px-4 sm:px-6 lg:px-8 bg-surface border-t border-border">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">FAQ</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-text">Common questions</h2>
            <p className="mt-4 text-text-muted">
              Quick answers before you sign up. Still unsure?{" "}
              <a href="mailto:support@taskly.com" className="text-primary hover:underline">Email us.</a>
            </p>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="bg-page rounded-xl border border-border overflow-hidden">
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
      <section className="py-28 px-4 sm:px-6 bg-page">
        <div className="max-w-5xl mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Rocket size={30} className="text-primary" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-text">
            Ready to work better together?
          </h2>
          <p className="mt-4 text-text-muted text-lg max-w-xl mx-auto">
            Join teams already using Taskly to ship faster, stay organized, and stress less.
            Free forever for small teams.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" onClick={() => navigate("/signup")}>
              Create your free account <ArrowRight size={16} className="ml-1" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => document.getElementById("faq")?.scrollIntoView({ behavior: "smooth" })}
            >
              Have a question?
            </Button>
          </div>
        </div>
      </section>

    </div>
  );
};

export default LandingPage;
