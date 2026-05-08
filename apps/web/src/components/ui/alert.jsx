import { CheckCircle, AlertTriangle, XCircle, Info, X } from "lucide-react";

const CONFIGS = {
  success: { icon: CheckCircle, classes: "bg-success-light text-success-dark border border-success/20" },
  warning: { icon: AlertTriangle, classes: "bg-warning-light text-warning-dark border border-warning/20" },
  danger:  { icon: XCircle,      classes: "bg-danger-light text-danger-dark border border-danger/20" },
  info:    { icon: Info,         classes: "bg-primary-light text-primary-dark border border-primary/20" },
};

export function Alert({ variant = "info", children, onDismiss, className = "" }) {
  const { icon: Icon, classes } = CONFIGS[variant] ?? CONFIGS.info;

  return (
    <div
      role="alert"
      className={[
        "flex items-start gap-3 px-4 py-3 rounded text-sm",
        classes,
        className,
      ].filter(Boolean).join(" ")}
    >
      <Icon size={16} className="mt-0.5 flex-shrink-0" />
      <span className="flex-1">{children}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="flex-shrink-0 opacity-60 hover:opacity-100" aria-label="Dismiss">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
