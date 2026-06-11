import { Shield, Eye, Database, Cookie, Trash2, AlertTriangle, Scale, Mail, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

const SECTIONS = [
  {
    Icon: Eye,
    title: "Information We Collect",
    id: "collect",
    body: "We collect only what's necessary to deliver a great experience. This includes account information you provide during registration (username, email address, password hash), activity data generated as you use Taskly (tasks created, completed, due dates), and technical data such as browser type and IP address for security purposes.",
    highlight: "We never collect sensitive personal information beyond what's needed to run your account.",
  },
  {
    Icon: Database,
    title: "How We Use Your Information",
    id: "use",
    body: "Your data is used exclusively to provide, secure, and improve Taskly. Specifically: to authenticate your sessions, deliver notifications you've opted into, analyze aggregated usage to improve features, and communicate important service updates.",
    highlight: "We do not sell, rent, or trade your personal data to any third party — ever.",
  },
  {
    Icon: Cookie,
    title: "Cookies & Tracking",
    id: "cookies",
    body: "We use essential cookies to keep you signed in and remember your preferences. Optional analytics cookies help us understand how features are used so we can improve them. You can manage or decline non-essential cookies at any time via the cookie consent banner.",
    highlight: null,
  },
  {
    Icon: Database,
    title: "Data Retention",
    id: "retention",
    body: "We retain your account data for as long as your account is active or as needed to provide services. When you delete your account, we permanently remove your personal data within 30 days, except where we are legally required to retain it.",
    highlight: "You can delete your account — and all associated data — at any time from Account Settings.",
  },
  {
    Icon: AlertTriangle,
    title: "Your Responsibilities",
    id: "responsibilities",
    body: "You are responsible for keeping your login credentials secure and for all activity that occurs under your account. Use a strong, unique password and enable caution when using Taskly on shared or public devices. Notify us immediately at info@taskly.com if you suspect unauthorized access.",
    highlight: null,
  },
  {
    Icon: Scale,
    title: "Legal Compliance",
    id: "legal",
    body: "We comply with applicable data protection laws and regulations. Your data is processed lawfully, fairly, and transparently. Where required by law or a valid legal process, we may disclose information to relevant authorities — but we will notify you when permitted.",
    highlight: null,
  },
  {
    Icon: Mail,
    title: "Contact & Questions",
    id: "contact",
    body: "If you have questions, concerns, or requests regarding this Privacy Policy or how your data is handled, reach out to us at info@taskly.com. We aim to respond to all privacy inquiries within 5 business days.",
    highlight: null,
  },
];

const RIGHTS = [
  { label: "Access", desc: "Request a copy of your personal data" },
  { label: "Rectification", desc: "Correct inaccurate or incomplete data" },
  { label: "Erasure", desc: "Request deletion of your data ('right to be forgotten')" },
  { label: "Portability", desc: "Receive your data in a portable format" },
  { label: "Objection", desc: "Object to processing of your data for certain purposes" },
];

const PrivacyPolicy = () => (
  <div className="bg-page text-text">
    {/* Hero */}
    <section className="bg-sidebar py-24 px-4 sm:px-6 relative overflow-hidden">
      <div className="absolute inset-0 opacity-5 pointer-events-none"
        style={{ backgroundImage: "radial-gradient(circle at 30% 50%, #6366f1 0%, transparent 60%), radial-gradient(circle at 80% 20%, #8b5cf6 0%, transparent 50%)" }}
      />
      <div className="max-w-5xl mx-auto text-center relative">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary text-xs font-semibold mb-6">
          <Shield size={12} />
          Legal · Privacy
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight">Privacy Policy</h1>
        <p className="mt-5 text-lg text-white/70 max-w-xl mx-auto leading-relaxed">
          We built Taskly with privacy in mind. Here's exactly what data we collect, why we collect it, and how we protect it.
        </p>
        <div className="flex items-center justify-center gap-4 mt-6 text-sm text-white/40">
          <span>Effective: May 2026</span>
          <span>·</span>
          <span>Last updated: May 2026</span>
        </div>
      </div>
    </section>

    {/* TLDR card */}
    <section className="py-10 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto bg-primary/5 border border-primary/20 rounded-2xl p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">The Short Version</p>
        <ul className="space-y-2">
          {[
            "We collect only what we need to run your account and improve the product.",
            "We never sell your data to advertisers or third parties.",
            "You can delete your account and all your data at any time.",
            "We use industry-standard encryption and security practices.",
            "Questions? Email us at info@taskly.com — we reply within 5 business days.",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-text-muted">
              <ChevronRight size={14} className="text-primary mt-0.5 flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>

    {/* Your Rights */}
    <section className="px-4 sm:px-6 pb-10">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-lg font-bold text-text mb-4">Your Rights</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {RIGHTS.map(({ label, desc }) => (
            <div key={label} className="bg-surface border border-border rounded-xl p-4">
              <p className="text-sm font-semibold text-text mb-1">{label}</p>
              <p className="text-xs text-text-muted leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Main sections */}
    <section className="pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-4">
        {SECTIONS.map(({ Icon, title, id, body, highlight }, i) => (
          <div key={id} id={id} className="bg-surface rounded-2xl border border-border p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon size={15} className="text-primary" />
              </div>
              <span className="text-xs text-text-muted font-medium">0{i + 1}</span>
              <h2 className="text-base font-bold text-text">{title}</h2>
            </div>
            <p className="text-sm text-text-muted leading-relaxed">{body}</p>
            {highlight && (
              <div className="mt-4 flex items-start gap-2 bg-primary/5 border border-primary/15 rounded-lg px-4 py-3">
                <Shield size={13} className="text-primary mt-0.5 flex-shrink-0" />
                <p className="text-xs text-primary leading-relaxed font-medium">{highlight}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>

    {/* Footer CTA */}
    <section className="pb-16 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto bg-surface border border-border rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-text">Have a privacy concern?</p>
          <p className="text-xs text-text-muted mt-0.5">We take every report seriously and respond within 5 business days.</p>
        </div>
        <a
          href="mailto:info@taskly.com"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex-shrink-0"
        >
          <Mail size={14} /> Contact Us
        </a>
      </div>

      <div className="max-w-5xl mx-auto mt-6 flex flex-wrap gap-x-4 gap-y-2 text-xs text-text-muted">
        <span>Related policies:</span>
        <Link to="/terms-and-conditions" className="text-primary hover:underline">Terms &amp; Conditions</Link>
        <span>·</span>
        <Link to="/cookies-policy" className="text-primary hover:underline">Cookies Policy</Link>
        <span>·</span>
        <Link to="/accessibility" className="text-primary hover:underline">Accessibility</Link>
      </div>
    </section>
  </div>
);

export default PrivacyPolicy;
