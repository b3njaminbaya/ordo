import {
  Accessibility as AccessibilityIcon,
  Keyboard,
  Monitor,
  Type,
  Contrast,
  MousePointer,
  Layers,
  Mail,
  ChevronRight,
} from "lucide-react";
import { Link } from "react-router-dom";

const COMMITMENTS = [
  {
    Icon: Keyboard,
    title: "Keyboard Navigation",
    body: "Every interactive element — buttons, forms, modals, dropdowns — is fully reachable and operable via keyboard alone. Tab, Shift+Tab, Enter, Space, and arrow keys work as expected throughout the interface.",
  },
  {
    Icon: Monitor,
    title: "Screen Reader Support",
    body: "We use semantic HTML5 elements and ARIA roles, labels, and live regions to ensure content is properly announced by assistive technologies including NVDA, JAWS, and VoiceOver on macOS and iOS.",
  },
  {
    Icon: Contrast,
    title: "Color Contrast",
    body: "All text meets or exceeds WCAG 2.1 Level AA contrast ratios — 4.5:1 for body text and 3:1 for large text and UI components. We do not rely on color alone to convey information.",
  },
  {
    Icon: Type,
    title: "Text Resizing",
    body: "The interface scales gracefully up to 200% zoom without content loss, horizontal scrolling, or broken layouts. We use relative units (rem/em) throughout so browser font-size preferences are respected.",
  },
  {
    Icon: MousePointer,
    title: "Focus Indicators",
    body: "Visible focus rings are present on all interactive elements so keyboard and switch-access users can always tell where focus is. We never use outline: none without a custom focus style replacement.",
  },
  {
    Icon: Layers,
    title: "Consistent Structure",
    body: "Headings, landmarks, and page structure follow a logical hierarchy on every page. Navigation is consistent across routes so users can build a reliable mental model of the application.",
  },
];

const STANDARDS = [
  { label: "WCAG 2.1 Level AA", desc: "Our target conformance level" },
  { label: "ARIA 1.2", desc: "Accessible Rich Internet Applications spec" },
  { label: "Section 508", desc: "US federal accessibility requirements" },
  { label: "EN 301 549", desc: "European accessibility standard" },
];

const Accessibility = () => (
  <div className="bg-page text-text">
    {/* Hero */}
    <section className="bg-sidebar py-24 px-4 sm:px-6 relative overflow-hidden">
      <div className="absolute inset-0 opacity-5 pointer-events-none"
        style={{ backgroundImage: "radial-gradient(circle at 50% 60%, #6366f1 0%, transparent 60%)" }}
      />
      <div className="max-w-5xl mx-auto text-center relative">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary text-xs font-semibold mb-6">
          <AccessibilityIcon size={12} />
          Legal · Accessibility
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight">Accessibility Statement</h1>
        <p className="mt-5 text-lg text-white/70 max-w-xl mx-auto leading-relaxed">
          Taskly is committed to being usable by everyone, regardless of ability or assistive technology.
        </p>
        <div className="flex items-center justify-center gap-4 mt-6 text-sm text-white/40">
          <span>Effective: May 2026</span>
          <span>·</span>
          <span>Last reviewed: May 2026</span>
        </div>
      </div>
    </section>

    {/* Standards */}
    <section className="py-10 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-4">Standards We Target</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {STANDARDS.map(({ label, desc }) => (
            <div key={label} className="bg-surface border border-border rounded-xl p-4 text-center">
              <p className="text-sm font-bold text-primary">{label}</p>
              <p className="text-xs text-text-muted mt-1 leading-snug">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Commitments */}
    <section className="pb-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-lg font-bold text-text mb-4">Our Commitments</h2>
        <div className="space-y-3">
          {COMMITMENTS.map(({ Icon, title, body }) => (
            <div key={title} className="bg-surface rounded-2xl border border-border p-5 flex gap-4">
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mt-0.5">
                <Icon size={17} className="text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text mb-1">{title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Known limitations */}
    <section className="pb-10 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto bg-primary/5 border border-primary/20 rounded-2xl p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Known Limitations</p>
        <ul className="space-y-2">
          {[
            "Drag-and-drop in the Kanban board currently requires a mouse; keyboard reordering is on our roadmap.",
            "Some third-party embedded content may not meet our contrast standards.",
            "PDF exports have not yet been tested with all screen readers.",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-text-muted">
              <ChevronRight size={14} className="text-primary mt-0.5 flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>
        <p className="text-xs text-text-muted mt-4">We are actively working to address these limitations in upcoming releases.</p>
      </div>
    </section>

    {/* Report */}
    <section className="pb-16 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto bg-surface border border-border rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-text">Found an accessibility barrier?</p>
          <p className="text-xs text-text-muted mt-0.5">
            Email us at{" "}
            <a href="mailto:info@taskly.com" className="text-primary hover:underline">info@taskly.com</a>{" "}
            with the page URL and a description of the issue. We aim to respond within 5 business days.
          </p>
        </div>
        <a
          href="mailto:info@taskly.com"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex-shrink-0"
        >
          <Mail size={14} /> Report Issue
        </a>
      </div>

      <div className="max-w-5xl mx-auto mt-6 flex flex-wrap gap-x-4 gap-y-2 text-xs text-text-muted">
        <span>Related policies:</span>
        <Link to="/privacy-policy" className="text-primary hover:underline">Privacy Policy</Link>
        <span>·</span>
        <Link to="/terms-and-conditions" className="text-primary hover:underline">Terms &amp; Conditions</Link>
        <span>·</span>
        <Link to="/cookies-policy" className="text-primary hover:underline">Cookies Policy</Link>
      </div>
    </section>
  </div>
);

export default Accessibility;
