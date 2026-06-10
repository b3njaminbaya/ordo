import { motion } from "framer-motion";
import { Target, Eye, CheckCircle2, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui";
import DrawingImage from "../assets/Drawing.jpg";

const VALUES = [
  { title: "Simplicity first",     desc: "We believe the best tool is the one you actually use. Taskly is intentionally simple — powerful where it matters, absent where it doesn't." },
  { title: "Calm over chaos",      desc: "Productivity shouldn't feel stressful. Our design reduces noise, surfaces what matters, and keeps your team focused." },
  { title: "Transparency",         desc: "Everyone on your team sees the same picture. No hidden state, no confused handoffs — just clear ownership and visible progress." },
  { title: "Built for real teams", desc: "We've designed every feature around how teams actually work, not how productivity gurus say they should." },
];

const REASONS = [
  "Seamless task assignment and real-time tracking",
  "Live Kanban boards with drag-and-drop",
  "Deadline notifications before things are overdue",
  "Velocity analytics to improve sprint performance",
  "Secure accounts with hashed tokens and JWT auth",
  "Calendar view for deadline planning",
  "Shareable workspace invites",
  "Simple, distraction-free interface",
  "Free to start — no credit card required",
];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay },
});

const AboutUs = () => {
  const navigate = useNavigate();

  return (
    <div className="bg-page text-text">

      {/* Hero */}
      <section className="relative bg-sidebar py-28 px-4 sm:px-6 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-page to-transparent pointer-events-none" />
        <motion.div {...fadeUp()} className="max-w-3xl mx-auto relative z-10">
          <span className="inline-block px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary text-xs font-bold uppercase tracking-widest mb-4">About Taskly</span>
          <h1 className="mt-2 text-4xl sm:text-5xl font-extrabold text-white leading-tight">
            Built for teams who<br />care about their work.
          </h1>
          <p className="mt-5 text-lg text-white/70 leading-relaxed max-w-2xl mx-auto">
            Taskly is a focused task management platform designed to eliminate the overhead of
            coordination — so your team can spend more time doing and less time managing.
          </p>
        </motion.div>
      </section>

      {/* Mission & Vision */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-surface">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-6">
          {[
            {
              Icon: Target,
              label: "Our Mission",
              body: "To give every team — whether two people or two hundred — a calm, powerful space to organize their work, stay aligned, and ship with confidence.",
            },
            {
              Icon: Eye,
              label: "Our Vision",
              body: "A world where great work isn't held back by bad tooling. We want Taskly to be the task manager teams love using — not just tolerate.",
            },
          ].map(({ Icon, label, body }, i) => (
            <motion.div key={label} {...fadeUp(i * 0.1)}
              className="bg-page rounded-2xl border border-border p-8 flex flex-col gap-4">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                <Icon size={22} className="text-primary" />
              </div>
              <h2 className="text-lg font-bold text-text">{label}</h2>
              <p className="text-sm text-text-muted leading-relaxed">{body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Values */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">What we stand for</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-text">Our values</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {VALUES.map(({ title, desc }, i) => (
              <motion.div key={title} {...fadeUp(i * 0.08)}
                className="bg-surface rounded-2xl border border-border p-7 hover:border-primary/40 transition-colors">
                <h3 className="font-semibold text-text mb-2">{title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why choose us */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-surface border-t border-border">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">Why Taskly</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-text">Built different, by design.</h2>
            <p className="mt-4 text-text-muted max-w-xl mx-auto">
              Here&apos;s what you get out of the box — no add-ons, no upgrades required.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <ul className="space-y-3">
              {REASONS.map((reason) => (
                <li key={reason}
                  className="flex items-start gap-3 bg-page rounded-xl border border-border px-5 py-3.5">
                  <CheckCircle2 size={16} className="text-success mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-text-muted">{reason}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-6">
              <img src={DrawingImage} alt="Taskly product illustration" className="w-full rounded-2xl shadow-card" />
              <Button onClick={() => navigate("/signup")} className="flex items-center justify-center gap-2">
                Start using Taskly free <ArrowRight size={15} />
              </Button>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};

export default AboutUs;
