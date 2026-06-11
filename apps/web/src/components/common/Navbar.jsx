import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Menu, X } from "lucide-react";
import { Button } from "../ui";

const NAV_LINKS = [
  { label: "Features", anchor: "features" },
  { label: "FAQ",      anchor: "faq" },
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

  const scrollTo = (anchor) => {
    setOpen(false);
    if (location.pathname === "/") {
      document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth" });
    } else {
      sessionStorage.setItem("scrollTarget", anchor);
      navigate("/");
    }
  };

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
            <span className="font-bold text-lg text-text tracking-tight">Teevexa Ordo</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-7">
            {NAV_LINKS.map(({ label, anchor }) => (
              <button
                key={anchor}
                onClick={() => scrollTo(anchor)}
                className="text-sm font-medium text-text-muted hover:text-text transition-colors duration-150"
              >
                {label}
              </button>
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
            {NAV_LINKS.map(({ label, anchor }) => (
              <button
                key={anchor}
                onClick={() => scrollTo(anchor)}
                className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-text-muted hover:text-text hover:bg-surface-muted transition-colors"
              >
                {label}
              </button>
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
