import { useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, ListTodo, Kanban, CalendarDays, Bell,
  Share2, User, Settings, Home, LogOut, X,
  Sun, Moon, Monitor, RefreshCw, Timer,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useNotifications } from "../../context/NotificationsContext";
import { useTimer } from "../../context/TimerContext";
import { Avatar } from "../ui";
import { assetUrl } from "../../config";
import { fmtElapsed } from "../../utils/time";

const NAV_LINKS = [
  { name: "Dashboard",     icon: LayoutDashboard, path: "/workspace/dashboard" },
  { name: "Task Lists",    icon: ListTodo,        path: "/workspace/tasks-list" },
  { name: "Kanban",        icon: Kanban,          path: "/workspace/kanban" },
  { name: "Calendar",      icon: CalendarDays,    path: "/workspace/calendar" },
  { name: "Recurring",     icon: RefreshCw,       path: "/workspace/recurring" },
  { name: "Time",          icon: Timer,           path: "/workspace/time", badge: "timer" },
  { name: "Notifications", icon: Bell,            path: "/workspace/notifications", badge: "unread" },
  { name: "Share Board",   icon: Share2,          path: "/workspace/shareboard" },
  { name: "Profile",       icon: User,            path: "/workspace/profile" },
  { name: "Settings",      icon: Settings,        path: "/workspace/settings" },
  { name: "Home",          icon: Home,            path: "/" },
];

const THEME_CYCLE = ["system", "light", "dark"];
const THEME_ICONS = { light: Sun, dark: Moon, system: Monitor };
const THEME_LABELS = { light: "Light", dark: "Dark", system: "System" };

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next = THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length];
  const Icon = THEME_ICONS[theme];

  return (
    <button
      onClick={() => setTheme(next)}
      title={`Theme: ${THEME_LABELS[theme]} — click for ${THEME_LABELS[next]}`}
      className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors duration-150"
    >
      <Icon size={17} />
      <span>{THEME_LABELS[theme]}</span>
    </button>
  );
}

function NavBadge({ kind }) {
  const { unreadCount } = useNotifications();
  const { activeTimer, elapsed } = useTimer();

  if (kind === "unread" && unreadCount > 0) {
    return (
      <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-danger text-white text-[11px] font-bold flex items-center justify-center" aria-label={`${unreadCount} unread`}>
        {unreadCount > 99 ? "99+" : unreadCount}
      </span>
    );
  }
  if (kind === "timer" && activeTimer) {
    return (
      <span className="ml-auto flex items-center gap-1.5 text-[11px] font-mono tabular-nums text-green-300" aria-label="Timer running">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
        </span>
        {fmtElapsed(elapsed)}
      </span>
    );
  }
  return null;
}

function SidebarContent({ onClose }) {
  const { logout, user } = useAuth();

  return (
    <div className="flex flex-col h-full bg-sidebar text-white w-64 py-5">
      <div className="flex items-center justify-between px-5 mb-6">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center text-white font-bold text-sm" aria-hidden="true">T</div>
          <span className="font-semibold text-lg tracking-tight">Ordo</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors" aria-label="Close navigation">
            <X size={18} />
          </button>
        )}
      </div>

      {user && (
        <div className="mx-4 mb-4 px-3 py-2 rounded-lg bg-white/5 border border-white/10 flex items-center gap-3">
          <Avatar src={assetUrl(user.profile_picture)} name={user.username} size="md" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{user.username}</p>
            <p className="text-xs text-white/50 truncate" title={user.workspace?.name}>{user.workspace?.name}</p>
          </div>
        </div>
      )}

      <nav aria-label="Main" className="flex-1 px-3 space-y-1 overflow-y-auto scrollbar-thin">
        {NAV_LINKS.map(({ name, icon: Icon, path, badge }) => (
          <NavLink
            key={name}
            to={path}
            end={path === "/"}
            onClick={onClose}
            className={({ isActive }) =>
              [
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150",
                isActive ? "bg-primary text-white" : "text-white/70 hover:text-white hover:bg-white/10",
              ].join(" ")
            }
          >
            <Icon size={17} />
            {name}
            {badge && <NavBadge kind={badge} />}
          </NavLink>
        ))}
      </nav>

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
  const drawerRef = useRef(null);

  // Mobile drawer: Escape closes it and focus moves inside while it is open.
  useEffect(() => {
    if (!isOpen) return undefined;
    const previous = document.activeElement;
    drawerRef.current?.querySelector("a,button")?.focus();
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [isOpen, onClose]);

  return (
    <>
      <aside className="hidden md:flex w-64 flex-shrink-0 h-screen sticky top-0">
        <SidebarContent />
      </aside>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 md:hidden animate-fade-in" onClick={onClose} aria-hidden="true" />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="fixed inset-y-0 left-0 z-50 md:hidden animate-slide-in-left"
          >
            <SidebarContent onClose={onClose} />
          </div>
        </>
      )}
    </>
  );
}
