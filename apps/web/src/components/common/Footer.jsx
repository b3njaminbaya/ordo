import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { FaFacebook, FaInstagram, FaTiktok, FaYoutube, FaLinkedinIn, FaXTwitter } from "react-icons/fa6";

const NAV = [
  { label: "Home",     to: "/" },
  { label: "Try free", to: "/signup" },
];

const SOCIALS = [
  { Icon: FaFacebook,   href: "https://facebook.com/teevexa",         label: "Facebook" },
  { Icon: FaInstagram,  href: "https://instagram.com/teevexa",        label: "Instagram" },
  { Icon: FaTiktok,     href: "https://tiktok.com/@teevexa",          label: "TikTok" },
  { Icon: FaYoutube,    href: "https://youtube.com/@teevexa",         label: "YouTube" },
  { Icon: FaLinkedinIn, href: "https://linkedin.com/company/teevexa", label: "LinkedIn" },
  { Icon: FaXTwitter,   href: "https://x.com/teevexa_",              label: "X" },
];

const Footer = () => (
  <footer className="bg-sidebar text-white">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">

        {/* Brand */}
        <div>
          <Link to="/" className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-bold text-sm">T</div>
            <span className="font-bold text-lg tracking-tight">Teevexa Ordo</span>
          </Link>
          <p className="text-sm text-white/60 leading-relaxed max-w-xs">
            Self-hosted project management software. Buy once, own forever — your data stays on your server.
          </p>
          <div className="flex items-center gap-2 mt-6">
            {SOCIALS.map(({ Icon, href, label }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/60 hover:bg-primary hover:text-white transition-all"
              >
                <Icon size={14} />
              </a>
            ))}
          </div>
        </div>

        {/* Product */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-4">Product</h4>
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

        {/* Contact */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-4">Get in touch</h4>
          <ul className="space-y-3">
            <li>
              <a
                href="mailto:sales@teevexa.com"
                className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors"
              >
                <Mail size={14} className="flex-shrink-0" />
                sales@teevexa.com
              </a>
            </li>
            <li>
              <a
                href="mailto:support@teevexa.com"
                className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors"
              >
                <Mail size={14} className="flex-shrink-0" />
                support@teevexa.com
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/40">
        <p>&copy; {new Date().getFullYear()} Teevexa Ordo by Teevexa Ltd. All rights reserved.</p>
        <p>Self-hosted. You own your data.</p>
      </div>
    </div>
  </footer>
);

export default Footer;
