export function Select({ label, error, hint, id, children, className = "", ...props }) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-text">
          {label}
        </label>
      )}
      <select
        id={inputId}
        className={[
          "w-full px-3 py-2 rounded border text-sm text-text bg-surface appearance-none",
          "transition-colors duration-150",
          "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent",
          error ? "border-danger" : "border-border hover:border-text-muted",
          className,
        ].filter(Boolean).join(" ")}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-danger">{error}</p>}
      {hint && !error && <p className="text-xs text-text-muted">{hint}</p>}
    </div>
  );
}
