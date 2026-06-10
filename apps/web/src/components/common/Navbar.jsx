import { useState, useEffect } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Menu, X } from "lucide-react";
import { Button } from "../ui";

const NAV_LINKS = [
  { label: "Home",       to: "/" },
  { label: "About",      to: "/about" },
  { label: "Services",   to: "/services" },
  { label: "Contact",    to: "/contact" },
];

const Navbar = ({ onLogin }) => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { setOpen(false); }, [location.pathname]);

  const linkClass = ({ isActive }) =>
    `text-sm font-medium transition-colors duration-150 ${
      isActive ? "text-primary" : "text-text-muted hover:text-text"
    }`;

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-200 ${
        scrolled
          ? "bg-surface/90 backdrop-blur-md shadow-card"
          : "bg-surface border-b border-border"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-sm shadow-sm">
              T
            </div>
            <span className="font-bold text-lg text-text tracking-tight">Taskly</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-7">
            {NAV_LINKS.map(({ label, to }) => (
              <NavLink key={to} to={to} end={to === "/"} className={linkClass}>
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <Button size="sm" onClick={() => navigate("/workspace")}>
                My Workspace
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate("/signup")}>
                  Sign Up
                </Button>
                <Button size="sm" onClick={onLogin}>
                  Log In
                </Button>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setOpen((v) => !v)}
            className="md:hidden p-2 rounded-lg text-text-muted hover:text-text hover:bg-surface-muted transition-colors"
            aria-label="Toggle menu"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden border-t border-border bg-surface animate-fade-in">
          <nav className="px-4 py-3 space-y-1">
            {NAV_LINKS.map(({ label, to }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-text-muted hover:text-text hover:bg-surface-muted"
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="px-4 py-3 border-t border-border flex flex-col gap-2">
            {user ? (
              <Button fullWidth onClick={() => { navigate("/workspace"); setOpen(false); }}>
                My Workspace
              </Button>
            ) : (
              <>
                <Button fullWidth variant="outline" onClick={() => { navigate("/signup"); setOpen(false); }}>
                  Sign Up
                </Button>
                <Button fullWidth onClick={() => { onLogin(); setOpen(false); }}>
                  Log In
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
