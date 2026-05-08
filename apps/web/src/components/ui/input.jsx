export function Input({
  label,
  error,
  hint,
  id,
  className = "",
  type = "text",
  ...props
}) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-text">
          {label}
        </label>
      )}
      <input
        id={inputId}
        type={type}
        className={[
          "w-full px-3 py-2 rounded border text-sm text-text bg-surface placeholder:text-text-muted",
          "transition-colors duration-150",
          "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent",
          error ? "border-danger" : "border-border hover:border-text-muted",
          className,
        ].filter(Boolean).join(" ")}
        {...props}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
      {hint && !error && <p className="text-xs text-text-muted">{hint}</p>}
    </div>
  );
}

export function Textarea({ label, error, hint, id, className = "", rows = 3, ...props }) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-text">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        rows={rows}
        className={[
          "w-full px-3 py-2 rounded border text-sm text-text bg-surface placeholder:text-text-muted resize-none",
          "transition-colors duration-150",
          "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent",
          error ? "border-danger" : "border-border hover:border-text-muted",
          className,
        ].filter(Boolean).join(" ")}
        {...props}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
      {hint && !error && <p className="text-xs text-text-muted">{hint}</p>}
    </div>
  );
}
