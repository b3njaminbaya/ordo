import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, CheckCircle2 } from "lucide-react";

const NAV = [
  { label: "Home",       to: "/" },
  { label: "About Us",   to: "/about" },
  { label: "Services",   to: "/services" },
  { label: "Contact Us", to: "/contact" },
];

const LEGAL = [
  { label: "Privacy Policy",     to: "/privacy-policy" },
  { label: "Terms & Conditions", to: "/terms-and-conditions" },
  { label: "Cookies Policy",     to: "/cookies-policy" },
  { label: "Accessibility",      to: "/accessibility" },
];

const Footer = () => {
  const [subscribed, setSubscribed] = useState(false);

  return (
  <footer className="bg-sidebar text-white">
    {/* Newsletter strip */}
    <div className="border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <p className="text-base font-semibold">Stay in the loop</p>
          <p className="text-sm text-white/60 mt-0.5">Get product updates and tips directly to your inbox.</p>
        </div>
        {subscribed ? (
          <div className="flex items-center gap-2 text-sm font-medium text-success bg-success/10 border border-success/20 rounded-lg px-4 py-2.5">
            <CheckCircle2 size={16} /> You&apos;re subscribed — thanks!
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); setSubscribed(true); }} className="flex w-full md:w-auto gap-0">
            <input
              type="email"
              required
              placeholder="you@example.com"
              className="px-4 py-2.5 rounded-l-lg text-sm text-text bg-white w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Email for newsletter"
            />
            <button
              type="submit"
              className="px-5 py-2.5 rounded-r-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors whitespace-nowrap"
            >
              Subscribe
            </button>
          </form>
        )}
      </div>
    </div>

    {/* Main grid */}
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
        {/* Brand */}
        <div className="col-span-2 md:col-span-1">
          <Link to="/" className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-bold text-sm">T</div>
            <span className="font-bold text-lg tracking-tight">Taskly</span>
          </Link>
          <p className="text-sm text-white/60 leading-relaxed max-w-xs">
            Calm, focused task management for teams who value clarity over chaos.
          </p>
        </div>

        {/* Navigation */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-4">Navigation</h4>
          <ul className="space-y-2.5">
            {NAV.map(({ label, to }) => (
              <li key={to}>
                <Link to={to} className="text-sm text-white/70 hover:text-white transition-colors">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Legal */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-4">Legal</h4>
          <ul className="space-y-2.5">
            {LEGAL.map(({ label, to }) => (
              <li key={to}>
                <Link to={to} className="text-sm text-white/70 hover:text-white transition-colors">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-4">Contact</h4>
          <ul className="space-y-3">
            <li>
              <a
                href="mailto:info@taskly.com"
                className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors"
              >
                <Mail size={14} className="flex-shrink-0" />
                info@taskly.com
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/40">
        <p>&copy; {new Date().getFullYear()} Taskly. All rights reserved.</p>
        <p>Built with care for productive teams.</p>
      </div>
    </div>
  </footer>
  );
};

export default Footer;
