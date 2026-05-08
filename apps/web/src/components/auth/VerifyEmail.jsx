import { useNavigate } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { Button } from "../ui";

export default function VerifyEmail() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-page flex items-center justify-center px-4">
      <div className="bg-surface rounded-2xl border border-border shadow-card p-8 w-full max-w-sm text-center">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
          <MailCheck size={24} className="text-primary" />
        </div>
        <h2 className="text-lg font-bold text-text">No verification needed</h2>
        <p className="text-sm text-text-muted mt-2 leading-relaxed">
          Email verification is not required. You can log in directly with your credentials.
        </p>
        <Button onClick={() => navigate("/")} className="mt-6 w-full">
          Go to Home
        </Button>
      </div>
    </div>
  );
}
