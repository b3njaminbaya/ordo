export function Card({ children, className = "", padding = true, ...props }) {
  return (
    <div
      className={[
        "bg-surface rounded-lg shadow-card border border-border",
        padding ? "p-5" : "",
        className,
      ].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "" }) {
  return (
    <div className={["flex items-center justify-between mb-4", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = "" }) {
  return (
    <h3 className={["text-base font-semibold text-text", className].filter(Boolean).join(" ")}>
      {children}
    </h3>
  );
}
