import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { FaGithub } from "react-icons/fa6";

const NAV = [
  { label: "Home",     to: "/" },
  { label: "Try the demo", to: "/signup" },
];

const LEGAL = [
  { label: "Terms & Conditions", to: "/terms-and-conditions" },
  { label: "Privacy Policy",     to: "/privacy-policy" },
  { label: "Cookies Policy",     to: "/cookies-policy" },
  { label: "Accessibility",      to: "/accessibility" },
];

const Footer = () => (
  <footer className="bg-sidebar text-white">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">

        <div>
          <Link to="/" className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-bold text-sm" aria-hidden="true">O</div>
            <span className="font-bold text-lg tracking-tight">Ordo</span>
          </Link>
          <p className="text-sm text-white/60 leading-relaxed max-w-xs">
            A project management app — tasks, Kanban, calendar, time tracking and real-time collaboration —
            built by Benjamin Baya as a portfolio project.
          </p>
          <div className="flex items-center gap-2 mt-6">
            <a
              href="https://github.com/b3njaminbaya"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/60 hover:bg-primary hover:text-white transition-all"
            >
              <FaGithub size={14} />
            </a>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-4">Explore</h4>
          <ul className="space-y-2.5">
            {NAV.map(({ label, to }) => (
              <li key={to}>
                <Link to={to} className="text-sm text-white/70 hover:text-white transition-colors">{label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-4">Get in touch</h4>
          <a
            href="mailto:b3njaminbaya@gmail.com"
            className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors"
          >
            <Mail size={14} className="flex-shrink-0" />
            b3njaminbaya@gmail.com
          </a>
        </div>
      </div>

      <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/40">
        <p>&copy; {new Date().getFullYear()} Ordo by Benjamin Baya. Portfolio project.</p>
        <nav aria-label="Legal" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          {LEGAL.map(({ label, to }) => (
            <Link key={to} to={to} className="hover:text-white transition-colors">{label}</Link>
          ))}
        </nav>
      </div>
    </div>
  </footer>
);

export default Footer;
