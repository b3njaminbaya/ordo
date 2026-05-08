const SIZES = {
  sm: "w-7 h-7 text-xs",
  md: "w-9 h-9 text-sm",
  lg: "w-12 h-12 text-base",
  xl: "w-20 h-20 text-2xl",
};

export function Avatar({ src, alt, name, size = "md", className = "" }) {
  const initials = name
    ? name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  return (
    <div
      className={[
        "rounded-full flex items-center justify-center font-semibold bg-primary-light text-primary overflow-hidden flex-shrink-0",
        SIZES[size],
        className,
      ].filter(Boolean).join(" ")}
      title={alt ?? name}
    >
      {src ? (
        <img src={src} alt={alt ?? name} className="w-full h-full object-cover" />
      ) : (
        initials
      )}
    </div>
  );
}
