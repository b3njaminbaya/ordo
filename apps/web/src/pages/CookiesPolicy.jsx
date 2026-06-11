import { Cookie, Lock, BarChart2, Settings2, Zap, ChevronRight, Mail } from "lucide-react";
import { Link } from "react-router-dom";

const COOKIE_TYPES = [
  {
    Icon: Lock,
    name: "Essential Cookies",
    required: true,
    desc: "These cookies are strictly necessary for Taskly to function. They handle user authentication (JWT tokens), maintain your session across pages, and protect against cross-site request forgery. You cannot opt out of these cookies.",
    examples: ["Authentication tokens", "Session identifiers", "CSRF protection tokens"],
  },
  {
    Icon: Settings2,
    name: "Functional Cookies",
    required: false,
    desc: "Functional cookies remember your preferences and settings so you don't have to reconfigure them each visit. They personalize your experience without being used for advertising.",
    examples: ["Theme preference", "Notification settings", "Dashboard layout"],
  },
  {
    Icon: BarChart2,
    name: "Analytics Cookies",
    required: false,
    desc: "We use analytics cookies to understand how our platform is used in aggregate — which pages are visited most, where users drop off, and which features are most popular. This data helps us build a better product.",
    examples: ["Page view counts", "Session duration", "Feature interaction rates"],
  },
  {
    Icon: Zap,
    name: "Performance Cookies",
    required: false,
    desc: "These cookies collect technical data about how our services perform. They help us identify and fix issues like slow page loads, API errors, and browser-specific bugs before they affect more users.",
    examples: ["Load time measurements", "Error tracking", "API response monitoring"],
  },
];

const FAQ = [
  {
    q: "Can I use Taskly without accepting cookies?",
    a: "Essential cookies are required for the platform to function — you cannot opt out of them. All other cookie categories are optional and can be declined from the banner or your browser settings.",
  },
  {
    q: "How do I change my cookie preferences?",
    a: "You can manage cookies in your browser settings at any time. Most browsers let you view, block, or delete individual cookies. Note that blocking essential cookies will prevent you from signing in.",
  },
  {
    q: "Do you use third-party cookies?",
    a: "Taskly does not currently use advertising or social media tracking cookies. Any third-party services we integrate are evaluated for privacy compliance before use.",
  },
  {
    q: "How long do cookies last?",
    a: "Session cookies expire when you close your browser. Persistent cookies (like remembered login sessions) last for up to 30 days or until you log out, whichever comes first.",
  },
];

const CookiesPolicy = () => (
  <div className="bg-page text-text">
    {/* Hero */}
    <section className="bg-sidebar py-24 px-4 sm:px-6 relative overflow-hidden">
      <div className="absolute inset-0 opacity-5 pointer-events-none"
        style={{ backgroundImage: "radial-gradient(circle at 40% 40%, #6366f1 0%, transparent 60%), radial-gradient(circle at 80% 70%, #8b5cf6 0%, transparent 50%)" }}
      />
      <div className="max-w-7xl mx-auto text-center relative">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary text-xs font-semibold mb-6">
          <Cookie size={12} />
          Legal · Cookies
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight">Cookies Policy</h1>
        <p className="mt-5 text-lg text-white/70 max-w-xl mx-auto leading-relaxed">
          We believe in full transparency. Here's a plain-English breakdown of every cookie Taskly uses and exactly why.
        </p>
        <div className="flex items-center justify-center gap-4 mt-6 text-sm text-white/40">
          <span>Effective: May 2026</span>
          <span>·</span>
          <span>Last updated: May 2026</span>
        </div>
      </div>
    </section>

    {/* What are cookies */}
    <section className="py-10 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto bg-primary/5 border border-primary/20 rounded-2xl p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">What Are Cookies?</p>
        <p className="text-sm text-text-muted leading-relaxed">
          Cookies are small text files stored on your device when you visit a website. They are widely used to make sites work correctly, remember your preferences, and give site owners insight into how their products are used. Cookies themselves do not contain personally identifiable information — they store small tokens that reference data on our servers.
        </p>
        <ul className="mt-4 space-y-1.5">
          {[
            "We only use cookies for legitimate purposes.",
            "Essential cookies cannot be turned off — the site won't work without them.",
            "All other cookies are optional and can be declined.",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-text-muted">
              <ChevronRight size={14} className="text-primary mt-0.5 flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>

    {/* Cookie types */}
    <section className="pb-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-lg font-bold text-text mb-4">Cookies We Use</h2>
        <div className="space-y-4">
          {COOKIE_TYPES.map(({ Icon, name, required, desc, examples }) => (
            <div key={name} className="bg-surface rounded-2xl border border-border p-6">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon size={15} className="text-primary" />
                  </div>
                  <h3 className="text-sm font-bold text-text">{name}</h3>
                </div>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${
                    required ? "bg-danger/10 text-danger" : "bg-success/10 text-success"
                  }`}
                >
                  {required ? "Required" : "Optional"}
                </span>
              </div>
              <p className="text-sm text-text-muted leading-relaxed mb-4">{desc}</p>
              <div className="flex flex-wrap gap-2">
                {examples.map((ex) => (
                  <span key={ex} className="px-2.5 py-1 bg-page border border-border rounded-md text-xs text-text-muted">
                    {ex}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* FAQ */}
    <section className="pb-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-lg font-bold text-text mb-4">Frequently Asked Questions</h2>
        <div className="space-y-3">
          {FAQ.map(({ q, a }) => (
            <div key={q} className="bg-surface rounded-2xl border border-border p-5">
              <p className="text-sm font-semibold text-text mb-2">{q}</p>
              <p className="text-sm text-text-muted leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* CTA */}
    <section className="pb-16 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto bg-surface border border-border rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-text">Cookie questions or concerns?</p>
          <p className="text-xs text-text-muted mt-0.5">Contact us and we'll respond within 5 business days.</p>
        </div>
        <a
          href="mailto:info@taskly.com"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex-shrink-0"
        >
          <Mail size={14} /> Contact Us
        </a>
      </div>

      <div className="max-w-7xl mx-auto mt-6 flex flex-wrap gap-x-4 gap-y-2 text-xs text-text-muted">
        <span>Related policies:</span>
        <Link to="/privacy-policy" className="text-primary hover:underline">Privacy Policy</Link>
        <span>·</span>
        <Link to="/terms-and-conditions" className="text-primary hover:underline">Terms &amp; Conditions</Link>
        <span>·</span>
        <Link to="/accessibility" className="text-primary hover:underline">Accessibility</Link>
      </div>
    </section>
  </div>
);

export default CookiesPolicy;
