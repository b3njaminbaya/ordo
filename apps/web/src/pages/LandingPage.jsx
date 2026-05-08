import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  CheckSquare, Bell, BarChart2, Shield, Users, Rocket,
  ArrowRight, Star, Zap, Calendar, Kanban, CheckCircle2
} from "lucide-react";
import { Button } from "../components/ui";
import HeroImage from "../assets/Hero.jpg";
import TeamImage from "../assets/Team.jpg";
import TestimonialImage from "../assets/Testimonial.jpeg";

const FEATURES = [
  { Icon: CheckSquare, title: "Task Management",      desc: "Create, prioritize, and track every task with due dates, status labels, and subtasks — all in one place." },
  { Icon: Kanban,      title: "Kanban Boards",        desc: "Visualize your workflow with drag-and-drop Kanban columns. Move tasks from To-Do to Done effortlessly." },
  { Icon: Calendar,    title: "Calendar View",        desc: "See all your deadlines in a monthly calendar. Plan ahead and never miss a due date again." },
  { Icon: Bell,        title: "Smart Notifications",  desc: "Get real-time alerts when tasks are updated or deadlines are approaching — so nothing slips through." },
  { Icon: BarChart2,   title: "Velocity Analytics",   desc: "Track your team's completion rate week by week. Identify bottlenecks and improve delivery speed." },
  { Icon: Users,       title: "Team Collaboration",   desc: "Invite teammates, assign tasks, and work in shared workspaces with live updates via Socket.IO." },
];

const STEPS = [
  { step: "01", title: "Create your workspace", desc: "Sign up and get a personal workspace in seconds — no credit card required." },
  { step: "02", title: "Add tasks & assign them", desc: "Create task lists, set priorities and due dates, and assign work to your team." },
  { step: "03", title: "Track & ship faster",     desc: "Monitor progress on the Kanban board, calendar, or dashboard — and deliver on time." },
];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay },
});

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="bg-page text-text overflow-x-hidden">

      {/* ── Hero ───────────────────────────────────────── */}
      <section className="relative min-h-[92vh] flex items-center justify-center text-center px-4 sm:px-6 overflow-hidden">
        {/* Background image + overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${HeroImage})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-sidebar/80 via-sidebar/70 to-sidebar/90" />

        <div className="relative z-10 max-w-4xl mx-auto">
          <motion.div {...fadeUp(0)}>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary text-xs font-semibold mb-6">
              <Zap size={11} /> Now with real-time collaboration
            </span>
          </motion.div>

          <motion.h1
            className="text-4xl sm:text-5xl lg:text-7xl font-black text-white leading-tight tracking-tight"
            {...fadeUp(0.1)}
          >
            Your team's work,<br />
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
              onClick={() => navigate("/about")}
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

        {/* Scroll cue */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/30 text-xs">
          <div className="w-px h-10 bg-gradient-to-b from-transparent to-white/30" />
        </div>
      </section>

      {/* ── How it works ──────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-surface">
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
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-page">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">Features</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-text">Everything your team needs</h2>
            <p className="mt-4 text-text-muted max-w-xl mx-auto">
              Built for teams who want clarity, not complexity. No bloat — just the tools that matter.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-14">
          <motion.div className="lg:w-1/2" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }}>
            <img src={TeamImage} alt="Team collaborating" className="w-full rounded-2xl shadow-card" />
          </motion.div>
          <div className="lg:w-1/2">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">Built for teams</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-text leading-tight">
              Less chaos,<br />more done.
            </h2>
            <p className="mt-5 text-text-muted leading-relaxed">
              Taskly gives every team member a clear picture of what's happening, what's next, and who owns what —
              without the noise of endless status meetings.
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

      {/* ── Testimonial ───────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 bg-sidebar">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex justify-center gap-1 mb-8">
            {[...Array(5)].map((_, i) => <Star key={i} size={18} className="text-warning fill-warning" />)}
          </div>
          <blockquote>
            <p className="text-xl sm:text-2xl font-light italic text-white/90 leading-relaxed">
              &ldquo;Taskly replaced three tools for our team. It&apos;s the only task manager that actually
              gets out of your way and lets you focus on the work.&rdquo;
            </p>
            <footer className="mt-8 flex items-center justify-center gap-3">
              <img
                src={TestimonialImage}
                alt="Benjamin Baya"
                className="w-12 h-12 rounded-full border-2 border-primary object-cover"
              />
              <div className="text-left">
                <p className="text-sm font-semibold text-white">Benjamin Baya</p>
                <p className="text-xs text-white/50">Project Manager</p>
              </div>
            </footer>
          </blockquote>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────── */}
      <section className="py-28 px-4 sm:px-6 bg-page">
        <div className="max-w-3xl mx-auto text-center">
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
            <Button size="lg" variant="outline" onClick={() => navigate("/contact")}>
              Talk to us first
            </Button>
          </div>
        </div>
      </section>

    </div>
  );
};

export default LandingPage;
