const VARIANTS = {
  default:  "bg-surface-muted text-text-muted border border-border",
  primary:  "bg-primary-light text-primary-dark border border-primary/20",
  success:  "bg-success-light text-success-dark border border-success/20",
  warning:  "bg-warning-light text-warning-dark border border-warning/20",
  danger:   "bg-danger-light text-danger-dark border border-danger/20",
};

const PRIORITY_MAP = {
  low:    "success",
  medium: "warning",
  high:   "danger",
  urgent: "danger",
};

const STATUS_MAP = {
  "todo":        "default",
  "pending":     "default",
  "in-progress": "primary",
  "completed":   "success",
};

export function Badge({ children, variant = "default", className = "" }) {
  return (
    <span
      className={[
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        VARIANTS[variant] ?? VARIANTS.default,
        className,
      ].filter(Boolean).join(" ")}
    >
      {children}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  return (
    <Badge variant={PRIORITY_MAP[priority] ?? "default"}>
      {priority?.charAt(0).toUpperCase() + priority?.slice(1)}
    </Badge>
  );
}

export function StatusBadge({ status }) {
  const label = status === "in-progress" ? "In Progress"
    : status?.charAt(0).toUpperCase() + status?.slice(1);
  return (
    <Badge variant={STATUS_MAP[status] ?? "default"}>{label}</Badge>
  );
}
