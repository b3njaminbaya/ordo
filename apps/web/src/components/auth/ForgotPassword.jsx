import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, ArrowLeft, Send } from "lucide-react";
import api from "../../api/axios";
import { Button, Alert } from "../ui";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/forgot-password/", { email });
      setMessage(res.data.message);
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-page flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-surface rounded-2xl shadow-card border border-border p-8">
          {/* Icon & heading */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Mail size={24} className="text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-text">Forgot your password?</h1>
            <p className="text-sm text-text-muted mt-2 text-center max-w-xs">
              No worries! Enter your email and we&apos;ll send you a reset link.
            </p>
          </div>

          {message ? (
            <div className="space-y-4">
              <Alert variant="success">{message}</Alert>
              <p className="text-sm text-text-muted text-center">
                Didn&apos;t receive it? Check your spam folder or{" "}
                <button
                  onClick={() => { setMessage(""); setEmail(""); }}
                  className="text-primary hover:underline font-medium"
                >
                  try again
                </button>.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <Alert variant="danger">{error}</Alert>}

              <div>
                <label htmlFor="fp-email" className="block text-sm font-medium text-text mb-1.5">
                  Email address
                </label>
                <input
                  id="fp-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full px-4 py-2.5 border border-border rounded-lg text-sm text-text bg-page placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                />
              </div>

              <Button type="submit" fullWidth disabled={loading} className="flex items-center justify-center gap-2">
                {loading ? "Sending…" : <><Send size={15} /> Send Reset Link</>}
              </Button>
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-border">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors mx-auto"
            >
              <ArrowLeft size={14} /> Back to previous page
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
