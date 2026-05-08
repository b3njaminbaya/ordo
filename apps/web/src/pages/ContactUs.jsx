import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, MapPin, ChevronDown, ChevronUp, Send, MessageSquare } from "lucide-react";
import { Button, Alert } from "../components/ui";

const FAQS = [
  {
    question: "Is Taskly really free?",
    answer: "Yes — Taskly is free to start with no credit card required. Create a workspace, invite your team, and use every feature without any trial limits.",
  },
  {
    question: "How do I invite teammates?",
    answer: "From your workspace, go to Shareboard. You can invite people by email or copy a shareable invite link. Invited users join your workspace and can be assigned tasks immediately.",
  },
  {
    question: "Can I reset my password if I forget it?",
    answer: "Yes. Click 'Forgot password?' on the login screen and enter your email. You'll receive a secure reset link valid for 1 hour.",
  },
  {
    question: "Where is Taskly hosted?",
    answer: "The Taskly web app is hosted on Vercel and the API on Render. Both run on globally distributed infrastructure for low-latency access.",
  },
  {
    question: "Is my data secure?",
    answer: "Yes. Passwords are hashed with bcrypt, JWTs are signed and blocklisted on logout, and password-reset tokens are SHA-256 hashed before storage. We do not sell or share your data.",
  },
];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay },
});

const ContactUs = () => {
  const [openFAQ, setOpenFAQ] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="bg-page text-text">

      {/* Hero */}
      <section className="bg-sidebar py-24 px-4 sm:px-6 text-center">
        <motion.div {...fadeUp()} className="max-w-3xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-widest text-primary">Contact</span>
          <h1 className="mt-4 text-4xl sm:text-5xl font-extrabold text-white leading-tight">
            We&apos;d love to hear from you.
          </h1>
          <p className="mt-5 text-lg text-white/70">
            A question, a bug report, or just want to say hi — we&apos;re a real team and we read every message.
          </p>
        </motion.div>
      </section>

      {/* Contact info + form */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-10">

          {/* Info panel */}
          <div className="lg:col-span-2 flex flex-col gap-5">
            <div className="bg-surface rounded-2xl border border-border p-6 flex flex-col gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Mail size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-1">Email</p>
                <a href="mailto:info@taskly.com" className="text-sm font-medium text-text hover:text-primary transition-colors">
                  info@taskly.com
                </a>
                <p className="text-xs text-text-muted mt-1">We reply within one business day.</p>
              </div>
            </div>

            <div className="bg-surface rounded-2xl border border-border p-6 flex flex-col gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <MapPin size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-1">Location</p>
                <p className="text-sm font-medium text-text">Nairobi, Kenya</p>
                <p className="text-xs text-text-muted mt-1">Remote-first — we serve teams worldwide.</p>
              </div>
            </div>

            <div className="bg-surface rounded-2xl border border-border p-6 flex flex-col gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <MessageSquare size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-1">Response time</p>
                <p className="text-sm font-medium text-text">Within 24 hours</p>
                <p className="text-xs text-text-muted mt-1">Mon – Fri, 9 AM – 6 PM EAT.</p>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-3 bg-surface rounded-2xl border border-border p-8">
            <h2 className="text-xl font-bold text-text mb-1">Send us a message</h2>
            <p className="text-sm text-text-muted mb-6">Fill in the form and we&apos;ll get back to you promptly.</p>

            {submitted ? (
              <Alert variant="success">
                Thank you! We&apos;ve received your message and will respond within one business day.
              </Alert>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text mb-1.5">Full Name</label>
                    <input required placeholder="Jane Doe" type="text"
                      className="w-full px-4 py-2.5 border border-border rounded-lg text-sm text-text bg-page placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text mb-1.5">Email Address</label>
                    <input required placeholder="you@example.com" type="email"
                      className="w-full px-4 py-2.5 border border-border rounded-lg text-sm text-text bg-page placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-1.5">Subject</label>
                  <input required placeholder="How can we help?" type="text"
                    className="w-full px-4 py-2.5 border border-border rounded-lg text-sm text-text bg-page placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-1.5">Message</label>
                  <textarea required rows={5} placeholder="Tell us what's on your mind…"
                    className="w-full px-4 py-2.5 border border-border rounded-lg text-sm text-text bg-page placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors resize-none" />
                </div>
                <Button type="submit" fullWidth className="flex items-center justify-center gap-2">
                  <Send size={14} /> Send Message
                </Button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-surface border-t border-border">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">FAQ</span>
            <h2 className="mt-3 text-3xl font-extrabold text-text">Common questions</h2>
            <p className="mt-3 text-text-muted">Find quick answers before reaching out.</p>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="bg-page rounded-xl border border-border overflow-hidden">
                <button
                  onClick={() => setOpenFAQ(openFAQ === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-medium text-text hover:bg-surface-muted transition-colors"
                >
                  <span>{faq.question}</span>
                  {openFAQ === i
                    ? <ChevronUp size={15} className="text-primary flex-shrink-0 ml-3" />
                    : <ChevronDown size={15} className="text-text-muted flex-shrink-0 ml-3" />
                  }
                </button>
                {openFAQ === i && (
                  <div className="px-5 pb-5 text-sm text-text-muted leading-relaxed border-t border-border pt-4">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
};

export default ContactUs;
