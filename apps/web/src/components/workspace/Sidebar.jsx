import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, ListTodo, Kanban, CalendarDays,
  Share2, User, Settings, Home, LogOut, X,
  Sun, Moon, Monitor, RefreshCw,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";

const NAV_LINKS = [
  { name: "Dashboard",  icon: LayoutDashboard, path: "/workspace/dashboard" },
  { name: "Task Lists", icon: ListTodo,        path: "/workspace/tasks-list" },
  { name: "Kanban",     icon: Kanban,          path: "/workspace/kanban" },
  { name: "Calendar",   icon: CalendarDays,    path: "/workspace/calendar" },
  { name: "Recurring",  icon: RefreshCw,       path: "/workspace/recurring" },
  { name: "Shareboard", icon: Share2,          path: "/workspace/shareboard" },
  { name: "Profile",    icon: User,            path: "/workspace/profile" },
  { name: "Settings",   icon: Settings,        path: "/workspace/settings" },
  { name: "Home",       icon: Home,            path: "/" },
];

const THEME_CYCLE = ["system", "light", "dark"];
const THEME_ICONS = { light: Sun, dark: Moon, system: Monitor };
const THEME_LABELS = { light: "Light", dark: "Dark", system: "System" };

function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const cycle = () => {
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length];
    setTheme(next);
  };

  const Icon = THEME_ICONS[theme];

  return (
    <button
      onClick={cycle}
      title={`Theme: ${THEME_LABELS[theme]} — click to change`}
      className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors duration-150"
    >
      <Icon size={17} />
      <span>{THEME_LABELS[theme]}</span>
    </button>
  );
}

function SidebarContent({ onClose }) {
  const { logout, user } = useAuth();

  return (
    <div className="flex flex-col h-full bg-sidebar text-white w-64 py-5">
      {/* Header */}
      <div className="flex items-center justify-between px-5 mb-6">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center text-white font-bold text-sm">
            T
          </div>
          <span className="font-semibold text-lg tracking-tight">Teevexa Ordo</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* User pill */}
      {user && (
        <div className="mx-4 mb-4 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
          <p className="text-xs text-white/50 mb-0.5">Signed in as</p>
          <p className="text-sm font-medium text-white truncate">{user.username}</p>
        </div>
      )}

      {/* Nav links */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto scrollbar-thin">
        {NAV_LINKS.map(({ name, icon: Icon, path }) => (
          <NavLink
            key={name}
            to={path}
            onClick={onClose}
            className={({ isActive }) =>
              [
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150",
                isActive
                  ? "bg-primary text-white"
                  : "text-white/70 hover:text-white hover:bg-white/10",
              ].join(" ")
            }
          >
            <Icon size={17} />
            {name}
          </NavLink>
        ))}
      </nav>

      {/* Bottom controls */}
      <div className="px-3 pt-4 border-t border-white/10 mt-2 space-y-1">
        <ThemeToggle />
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-danger/80 transition-colors duration-150"
        >
          <LogOut size={17} />
          Logout
        </button>
      </div>
    </div>
  );
}

export default function Sidebar({ isOpen, onClose }) {
  return (
    <>
      {/* Desktop — always visible */}
      <aside className="hidden md:flex w-64 flex-shrink-0 h-screen sticky top-0">
        <SidebarContent />
      </aside>

      {/* Mobile — slide-over drawer */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden animate-fade-in"
            onClick={onClose}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 z-50 md:hidden animate-slide-up">
            <SidebarContent onClose={onClose} />
          </div>
        </>
      )}
    </>
  );
}
