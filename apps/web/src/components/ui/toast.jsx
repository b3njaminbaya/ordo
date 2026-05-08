import { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle, AlertTriangle, XCircle, Info, X } from "lucide-react";

const ToastContext = createContext(null);

const CONFIGS = {
  success: { icon: CheckCircle, classes: "bg-success text-white" },
  warning: { icon: AlertTriangle, classes: "bg-warning text-white" },
  danger:  { icon: XCircle,      classes: "bg-danger text-white" },
  info:    { icon: Info,         classes: "bg-primary text-white" },
};

let _id = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((message, variant = "info", duration = 4000) => {
    const id = ++_id;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80">
        {toasts.map(({ id, message, variant }) => {
          const { icon: Icon, classes } = CONFIGS[variant] ?? CONFIGS.info;
          return (
            <div
              key={id}
              className={["flex items-center gap-3 px-4 py-3 rounded-lg shadow-modal text-sm animate-slide-up", classes].join(" ")}
            >
              <Icon size={16} className="flex-shrink-0" />
              <span className="flex-1">{message}</span>
              <button onClick={() => dismiss(id)} className="opacity-70 hover:opacity-100 flex-shrink-0" aria-label="Dismiss">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
