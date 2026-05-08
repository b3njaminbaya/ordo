const VARIANTS = {
  primary:   "bg-primary text-white hover:bg-primary-hover focus-ring",
  secondary: "bg-surface text-text border border-border hover:bg-surface-muted focus-ring",
  danger:    "bg-danger text-white hover:bg-danger-dark focus-ring",
  ghost:     "text-text-muted hover:bg-surface-muted hover:text-text focus-ring",
  outline:   "border border-primary text-primary hover:bg-primary-light focus-ring",
};

const SIZES = {
  sm:   "px-3 py-1.5 text-sm",
  md:   "px-4 py-2 text-sm",
  lg:   "px-6 py-2.5 text-base",
  icon: "p-2",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  fullWidth = false,
  disabled = false,
  loading = false,
  type = "button",
  onClick,
  className = "",
  ...props
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={[
        "inline-flex items-center justify-center gap-2 font-medium rounded transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        fullWidth ? "w-full" : "",
        className,
      ].filter(Boolean).join(" ")}
      {...props}
    >
      {loading && <Spinner size="sm" className="text-current" />}
      {children}
    </button>
  );
}

import { Spinner } from "./spinner";
