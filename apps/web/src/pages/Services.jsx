import { motion } from "framer-motion";
import {
  CheckSquare, Users, Bell, BarChart2, Shield,
  Kanban, Calendar, ArrowRight, Zap
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui";

const SERVICES = [
  {
    Icon: CheckSquare,
    title: "Task Management",
    desc: "Create tasks with titles, descriptions, priorities (low → urgent), due dates, and status labels. Organize them into custom task lists that match your workflow.",
    tags: ["Priorities", "Due dates", "Subtasks"],
  },
  {
    Icon: Kanban,
    title: "Kanban Boards",
    desc: "Drag and drop tasks across To-Do, In Progress, In Review, and Done columns in real time. Your whole team sees updates instantly via Socket.IO.",
    tags: ["Drag & drop", "Real-time", "Visual workflow"],
  },
  {
    Icon: Calendar,
    title: "Calendar View",
    desc: "See every task due date plotted on a monthly calendar. Click any day to review what's due and plan your team's sprint accordingly.",
    tags: ["Monthly view", "Deadline planning", "Sprint prep"],
  },
  {
    Icon: Bell,
    title: "Smart Notifications",
    desc: "Automatic deadline reminders are sent 1 hour before a task is due. Task owners and assignees both get notified so nothing goes unnoticed.",
    tags: ["Auto-reminders", "Assignee alerts", "In-app"],
  },
  {
    Icon: BarChart2,
    title: "Velocity Analytics",
    desc: "Track your team's weekly task completion trend over 8 weeks. Spot slowdowns early, celebrate momentum, and improve sprint-over-sprint.",
    tags: ["8-week trend", "Bar & line charts", "Team metrics"],
  },
  {
    Icon: Users,
    title: "Team Collaboration",
    desc: "Invite teammates to your workspace by email or shareable link. Assign tasks to specific members and see who owns what at a glance.",
    tags: ["Email invites", "Shareable links", "Task assignment"],
  },
  {
    Icon: Shield,
    title: "Security",
    desc: "Passwords are hashed with Werkzeug, JWTs are signed and token-blocklisted on logout, and password-reset tokens are SHA-256 hashed before storage.",
    tags: ["JWT auth", "Bcrypt hashing", "Secure resets"],
  },
  {
    Icon: Zap,
    title: "Real-time Sync",
    desc: "Powered by Flask-SocketIO and gevent, Taskly pushes task updates and notifications to every connected teammate instantly — no refresh required.",
    tags: ["WebSockets", "Socket.IO", "Live updates"],
  },
];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay },
});

const Services = () => {
  const navigate = useNavigate();

  return (
    <div className="bg-page text-text">

      {/* Hero */}
      <section className="bg-sidebar py-24 px-4 sm:px-6 text-center">
        <motion.div {...fadeUp()} className="max-w-3xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-widest text-primary">What we offer</span>
          <h1 className="mt-4 text-4xl sm:text-5xl font-extrabold text-white leading-tight">
            Everything you need to<br />manage work well.
          </h1>
          <p className="mt-5 text-lg text-white/70 leading-relaxed">
            No feature bloat. No paywalls. Just the right set of tools to help your team
            stay organized and deliver consistently.
          </p>
        </motion.div>
      </section>

      {/* Services grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {SERVICES.map(({ Icon, title, desc, tags }, i) => (
              <motion.div
                key={title}
                className="bg-surface rounded-2xl border border-border p-7 flex flex-col gap-4 hover:border-primary/40 hover:shadow-card transition-all group"
                {...fadeUp(i * 0.05)}
                whileHover={{ y: -2 }}
              >
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                    <Icon size={22} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-text">{title}</h3>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {tags.map((tag) => (
                        <span key={tag} className="text-xs px-2 py-0.5 bg-primary/8 text-primary rounded-full font-medium">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-text-muted leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 bg-surface border-t border-border">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-extrabold text-text">Try every feature — free.</h2>
          <p className="mt-4 text-text-muted">
            No trial expiry. No feature gates. Sign up and get access to everything Taskly offers, today.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" onClick={() => navigate("/signup")}>
              Create free account <ArrowRight size={15} className="ml-1" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/contact")}>
              Have a question?
            </Button>
          </div>
        </div>
      </section>

    </div>
  );
};

export default Services;
