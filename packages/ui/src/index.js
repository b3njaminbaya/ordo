/**
 * @taskly/ui
 *
 * Shared design system for Taskly apps.
 * The Tailwind preset lives in ../tailwind.config.js (CJS) and is loaded
 * directly via createRequire in apps that extend it (e.g. apps/web).
 * This file exports framework-agnostic JS constants for use in app code
 * (e.g. Chart.js dataset colors, programmatic styling).
 */

/** Design tokens as JS constants — single source of truth */
const colors = {
  primary:        "#6366F1",
  primaryHover:   "#4F46E5",
  primaryDark:    "#3730A3",
  primaryLight:   "#EEF2FF",
  success:        "#10B981",
  successDark:    "#065F46",
  successLight:   "#ECFDF5",
  warning:        "#F59E0B",
  warningDark:    "#78350F",
  warningLight:   "#FFFBEB",
  danger:         "#EF4444",
  dangerDark:     "#991B1B",
  dangerLight:    "#FEF2F2",
  page:           "#F9FAFB",
  surface:        "#FFFFFF",
  surfaceMuted:   "#F3F4F6",
  border:         "#E5E7EB",
  text:           "#111827",
  textMuted:      "#6B7280",
  sidebar:        "#111827",
};

module.exports = { colors };
