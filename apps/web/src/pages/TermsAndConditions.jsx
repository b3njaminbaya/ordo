import { FileText, UserCheck, ShieldCheck, Copyright, AlertOctagon, XCircle, RefreshCw, Mail, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

const SECTIONS = [
  {
    Icon: UserCheck,
    title: "Acceptance of Terms",
    id: "acceptance",
    body: "By accessing or using Taskly, you confirm that you are at least 16 years of age and agree to be bound by these Terms and Conditions and our Privacy Policy. If you are using Taskly on behalf of an organization, you represent that you have the authority to bind that organization to these terms.",
    highlight: "If you do not agree with any part of these terms, you may not access or use our services.",
  },
  {
    Icon: ShieldCheck,
    title: "User Accounts",
    id: "accounts",
    body: "You must create an account to use Taskly. You are responsible for: maintaining the confidentiality of your login credentials, all activity that occurs under your account, keeping your account information accurate and up to date. You may not share your account with others or create accounts for any purpose other than using Taskly as intended.",
    highlight: null,
  },
  {
    Icon: AlertOctagon,
    title: "Acceptable Use",
    id: "acceptable-use",
    body: "You agree not to use Taskly to: engage in any unlawful activity; upload or transmit malware, viruses, or harmful code; attempt to gain unauthorized access to our systems or other accounts; spam, harass, or harm other users; reverse-engineer, copy, or redistribute any part of our platform without permission; use the service in a way that could damage, disable, or impair it.",
    highlight: "Violations may result in immediate account suspension or termination without notice.",
  },
  {
    Icon: Copyright,
    title: "Intellectual Property",
    id: "ip",
    body: "All content, trademarks, trade dress, logos, and branding on Taskly are owned by us or our licensors and are protected by applicable intellectual property laws. We grant you a limited, non-exclusive, non-transferable license to use Taskly solely for its intended purpose. You retain ownership of content you create within the platform.",
    highlight: null,
  },
  {
    Icon: AlertOctagon,
    title: "Limitation of Liability",
    id: "liability",
    body: "Taskly is provided 'as is' without warranties of any kind, express or implied. To the fullest extent permitted by law, we disclaim all warranties including merchantability, fitness for a particular purpose, and non-infringement. We are not liable for any indirect, incidental, special, or consequential damages arising from your use of or inability to use Taskly.",
    highlight: null,
  },
  {
    Icon: XCircle,
    title: "Termination",
    id: "termination",
    body: "We reserve the right to suspend or terminate your account at our sole discretion, with or without notice, if we determine that you have violated these Terms. You may also delete your account at any time from your Account Settings. Upon termination, your right to use Taskly ceases immediately.",
    highlight: null,
  },
  {
    Icon: RefreshCw,
    title: "Changes to Terms",
    id: "changes",
    body: "We may update these Terms from time to time to reflect changes in our services or legal requirements. When we make significant changes, we will notify you via email or an in-app notification at least 14 days before the changes take effect. Your continued use of Taskly after that period constitutes acceptance of the updated terms.",
    highlight: null,
  },
  {
    Icon: Mail,
    title: "Contact",
    id: "contact",
    body: "For questions about these Terms and Conditions or to report a violation, please contact us at info@taskly.com. For urgent security concerns, mark your subject line as 'URGENT' and we will prioritize your inquiry.",
    highlight: null,
  },
];

const SUMMARY = [
  "You must be 16+ to use Taskly.",
  "Don't misuse the platform — no spam, hacking, or illegal activity.",
  "You own your content; we own our platform and branding.",
  "We can suspend accounts that violate these terms.",
  "We'll give you 14 days notice before major changes.",
];

const TermsAndConditions = () => (
  <div className="bg-page text-text">
    {/* Hero */}
    <section className="bg-sidebar py-24 px-4 sm:px-6 relative overflow-hidden">
      <div className="absolute inset-0 opacity-5 pointer-events-none"
        style={{ backgroundImage: "radial-gradient(circle at 70% 50%, #6366f1 0%, transparent 60%), radial-gradient(circle at 20% 80%, #8b5cf6 0%, transparent 50%)" }}
      />
      <div className="max-w-5xl mx-auto text-center relative">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary text-xs font-semibold mb-6">
          <FileText size={12} />
          Legal · Terms
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight">Terms &amp; Conditions</h1>
        <p className="mt-5 text-lg text-white/70 max-w-xl mx-auto leading-relaxed">
          These terms govern your use of Taskly. We've written them to be clear and fair — please read them before using our platform.
        </p>
        <div className="flex items-center justify-center gap-4 mt-6 text-sm text-white/40">
          <span>Effective: May 2026</span>
          <span>·</span>
          <span>Last updated: May 2026</span>
        </div>
      </div>
    </section>

    {/* TLDR */}
    <section className="py-10 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto bg-primary/5 border border-primary/20 rounded-2xl p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">The Short Version</p>
        <ul className="space-y-2">
          {SUMMARY.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-text-muted">
              <ChevronRight size={14} className="text-primary mt-0.5 flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>

    {/* Main sections */}
    <section className="pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-4">
        {SECTIONS.map(({ Icon, title, id, body, highlight }, i) => (
          <div key={id} id={id} className="bg-surface rounded-2xl border border-border p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon size={15} className="text-primary" />
              </div>
              <span className="text-xs text-text-muted font-medium">0{i + 1}</span>
              <h2 className="text-base font-bold text-text">{title}</h2>
            </div>
            <p className="text-sm text-text-muted leading-relaxed">{body}</p>
            {highlight && (
              <div className="mt-4 flex items-start gap-2 bg-danger/5 border border-danger/15 rounded-lg px-4 py-3">
                <AlertOctagon size={13} className="text-danger mt-0.5 flex-shrink-0" />
                <p className="text-xs text-danger leading-relaxed font-medium">{highlight}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>

    {/* Footer CTA */}
    <section className="pb-16 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto bg-surface border border-border rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-text">Questions about these terms?</p>
          <p className="text-xs text-text-muted mt-0.5">We're happy to clarify anything — just reach out.</p>
        </div>
        <a
          href="mailto:info@taskly.com"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex-shrink-0"
        >
          <Mail size={14} /> Contact Us
        </a>
      </div>

      <div className="max-w-5xl mx-auto mt-6 flex flex-wrap gap-x-4 gap-y-2 text-xs text-text-muted">
        <span>Related policies:</span>
        <Link to="/privacy-policy" className="text-primary hover:underline">Privacy Policy</Link>
        <span>·</span>
        <Link to="/cookies-policy" className="text-primary hover:underline">Cookies Policy</Link>
        <span>·</span>
        <Link to="/accessibility" className="text-primary hover:underline">Accessibility</Link>
      </div>
    </section>
  </div>
);

export default TermsAndConditions;
