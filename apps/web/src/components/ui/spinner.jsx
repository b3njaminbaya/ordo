const SIZES = {
  sm: "w-4 h-4 border-2",
  md: "w-6 h-6 border-2",
  lg: "w-8 h-8 border-[3px]",
};

export function Spinner({ size = "md", className = "" }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={[
        "inline-block rounded-full border-current border-r-transparent animate-spin",
        SIZES[size],
        className,
      ].filter(Boolean).join(" ")}
    />
  );
}
