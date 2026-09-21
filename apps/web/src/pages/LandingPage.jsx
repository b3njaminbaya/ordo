import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  CheckSquare, Bell, BarChart2, Shield, Users, Rocket,
  ArrowRight, Calendar, Kanban, CheckCircle2, RefreshCw,
  Timer, Server, Database, Lock, Package, Wrench,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "../components/ui";
import TeamImage from "../assets/Team.jpg";

const FEATURES = [
  { Icon: CheckSquare, title: "Task Management",     desc: "Create, prioritize, and track every task with due dates, status labels, and subtasks — all in one place." },
  { Icon: Kanban,      title: "Kanban Boards",       desc: "Visualize your workflow with drag-and-drop columns. Move tasks from To-Do to Done with ease." },
  { Icon: Calendar,    title: "Calendar View",       desc: "See all deadlines in a monthly calendar. Plan ahead and never miss a due date again." },
  { Icon: Timer,       title: "Time Tracking",       desc: "Track time on tasks with live timers that stay in sync across your own devices, log past time, see weekly totals, and export to CSV." },
  { Icon: Bell,        title: "Smart Notifications", desc: "Get instant alerts when you are assigned a task or someone comments, plus reminders 24 hours and 1 hour before a deadline and when it is overdue." },
  { Icon: BarChart2,   title: "Velocity Analytics",  desc: "Track your team's completion rate. Identify bottlenecks and improve delivery speed." },
  { Icon: Users,       title: "Team Collaboration",  desc: "Invite teammates, assign tasks, and work in shared workspaces with live real-time updates." },
  { Icon: Shield,      title: "Secure by default",   desc: "Salted scrypt password hashes, signed tokens that are revoked on logout and password change, hashed single-use reset links, and workspace-level data isolation." },
];

const WHY = [
  { Icon: Database, title: "Runs on your own server",   desc: "Ordo is a standard Flask + React app with a PostgreSQL database. Deploy it anywhere you can run Python and Node — your data stays where you host it." },
  { Icon: Lock,     title: "Security taken seriously",  desc: "Every request is scoped to your workspace, sessions are revocable, and real-time connections are authenticated. The API has a large automated test suite." },
  { Icon: Server,   title: "Built end to end",          desc: "Designed and directed by Benjamin Baya and built with AI assistance (Claude Code), covering the data model, API, WebSockets, background jobs, UI, tests and CI." },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Try the live demo",     desc: "Sign up in seconds — no credit card. Create lists, add tasks, invite a teammate and watch changes sync live." },
  { step: "02", title: "Explore the features",  desc: "Kanban, calendar, recurring tasks, time tracking, notifications and analytics are all part of the demo." },
  { step: "03", title: "Read the code",         desc: "The full source is on GitHub. Clone it and run it yourself with the setup steps in the README." },
];

const INCLUDED = [
  { Icon: Package,     title: "React 19 front end",      desc: "Vite, React Router, Tailwind CSS and Framer Motion, with optimistic updates and accessible dialogs." },
  { Icon: Server,      title: "Flask API + Socket.IO",   desc: "Blueprints per feature, JWT auth with revocation, rate limiting, and authenticated WebSocket rooms." },
  { Icon: Database,    title: "PostgreSQL + migrations", desc: "Alembic migrations, database constraints backing application rules, and safe background jobs." },
  { Icon: Wrench,      title: "Tested and automated",    desc: "Backend and front-end test suites, plus GitHub Actions for lint, tests and deploys." },
];

const FAQS = [
  {
    question: "Is this a commercial product?",
    answer: "No. Ordo is a personal portfolio project by Benjamin Baya. It is not sold or supported as a commercial service.",
  },
  {
    question: "Can I try it?",
    answer: "Yes — the live demo is open to anyone. It runs on free-tier hosting, so the first request after a quiet period can take up to a minute while the server wakes up.",
  },
  {
    question: "Will my demo data be kept?",
    answer: "Not reliably. The demo database can be reset or removed at any time, so please don't store anything important there. Use fake data.",
  },
  {
    question: "Can I run it myself?",
    answer: "Yes. The source is on GitHub under the MIT license. You need Python 3.12, Node 22 and a PostgreSQL database; the README walks through setup and deployment.",
  },
  {
    question: "What does it cost?",
    answer: "Nothing. There are no plans, seats or fees.",
  },
  {
    question: "How do I get in touch?",
    answer: "Email b3njaminbaya@gmail.com — feedback, bug reports and questions are welcome.",
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
              <Server size={11} /> Portfolio project · Open source
            </span>
          </motion.div>

          <motion.h1
            className="text-4xl sm:text-5xl lg:text-7xl font-black text-white leading-tight tracking-tight"
            {...fadeUp(0.1)}
          >
            Project management,<br />
            <span className="text-primary">built end to end.</span>
          </motion.h1>

          <motion.p
            className="mt-6 text-lg sm:text-xl text-white/70 max-w-2xl mx-auto leading-relaxed"
            {...fadeUp(0.2)}
          >
            Ordo brings tasks, Kanban boards, a calendar, time tracking and real-time collaboration
            together — a full-stack project by Benjamin Baya.
          </motion.p>

          <motion.div
            className="mt-10 flex flex-col sm:flex-row gap-3 justify-center"
            {...fadeUp(0.3)}
          >
            <Button size="lg" onClick={() => navigate("/signup")}>
              Try the live demo <ArrowRight size={16} className="ml-1" />
            </Button>
            <a href="https://github.com/b3njaminbaya" target="_blank" rel="noopener noreferrer">
              <Button
                size="lg"
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10 w-full sm:w-auto"
              >
                View the source
              </Button>
            </a>
          </motion.div>

          <motion.div
            className="mt-10 flex flex-wrap items-center justify-center gap-6 text-white/50 text-sm"
            {...fadeUp(0.4)}
          >
            {["Free to try", "Open source (MIT)", "Self-hostable", "Demo may reset"].map((t) => (
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
            <span className="text-xs font-bold uppercase tracking-widest text-primary">Why Ordo?</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-text">Simple to run, careful under the hood.</h2>
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
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-text">From demo to source in three steps</h2>
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
              Tasks, Kanban, calendar, time tracking, analytics, and real-time collaboration.
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
            <span className="text-xs font-bold uppercase tracking-widest text-primary">Built to be understood</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-text leading-tight">
              Readable code.<br />Real features.
            </h2>
            <p className="mt-5 text-text-muted leading-relaxed">
              Ordo is deliberately a complete, working application rather than a demo of one technique: multi-user workspaces, live updates, background jobs, file handling and a real security model.
              </p>
            <ul className="mt-6 space-y-3">
              {[
                "Workspace-level access control on every endpoint",
                "Real-time sync over authenticated WebSockets",
                "Timezone-safe time tracking and reminders",
                "MIT licensed — fork it and make it yours",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-text-muted">
                  <CheckCircle2 size={16} className="text-success mt-0.5 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button onClick={() => navigate("/signup")}>
                Try the demo <ArrowRight size={15} className="ml-1" />
              </Button>
              <a href="mailto:b3njaminbaya@gmail.com">
                <Button variant="outline">Get in touch</Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── What's included ───────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-surface border-t border-border">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">Under the hood</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-text">What it&apos;s made of</h2>
            <p className="mt-4 text-text-muted max-w-xl mx-auto">
              A quick tour of the stack.
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
              <a href="mailto:b3njaminbaya@gmail.com" className="text-primary hover:underline">Email us.</a>
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
            Ready to have a look?
          </h2>
          <p className="mt-4 text-white/60 text-lg max-w-xl mx-auto">
            Try the demo, or clone the repo and run it yourself. The demo runs on free hosting and its
            data can be reset at any time, so please use fake data.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" onClick={() => navigate("/signup")}>
              Try the live demo <ArrowRight size={16} className="ml-1" />
            </Button>
            <a href="mailto:b3njaminbaya@gmail.com">
              <Button
                size="lg"
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10 w-full sm:w-auto"
              >
                View the source
              </Button>
            </a>
          </div>
        </div>
      </section>

    </div>
  );
};

export default LandingPage;
