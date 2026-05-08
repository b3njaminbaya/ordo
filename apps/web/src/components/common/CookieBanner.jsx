import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Cookie, X } from "lucide-react";
import { Button } from "../ui";

const STORAGE_KEY = "taskly_cookie_consent";

const CookieBanner = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(STORAGE_KEY);
    if (!consent) setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, "accepted");
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem(STORAGE_KEY, "declined");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-50 bg-sidebar rounded-2xl shadow-card border border-white/10 p-5"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Cookie size={18} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">We use cookies</p>
          <p className="text-xs text-white/60 mt-1 leading-relaxed">
            We use essential and analytics cookies to improve your experience.{" "}
            <Link to="/cookies-policy" className="text-primary hover:underline" onClick={accept}>
              Learn more
            </Link>
          </p>
        </div>
        <button
          onClick={decline}
          className="text-white/40 hover:text-white transition-colors flex-shrink-0"
          aria-label="Dismiss"
        >
          <X size={15} />
        </button>
      </div>
      <div className="flex gap-2 mt-4">
        <Button size="sm" fullWidth onClick={accept}>
          Accept all
        </Button>
        <Button size="sm" fullWidth variant="ghost"
          className="text-white/70 hover:text-white hover:bg-white/10"
          onClick={decline}
        >
          Decline
        </Button>
      </div>
    </div>
  );
};

export default CookieBanner;
