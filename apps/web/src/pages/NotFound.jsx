import { Link } from "react-router-dom";
import { ArrowLeft, SearchX } from "lucide-react";

const NotFound = () => (
  <div className="min-h-screen bg-page flex flex-col items-center justify-center px-4 text-center">
    <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
      <SearchX size={36} className="text-primary" />
    </div>
    <h1 className="text-8xl font-black text-primary">404</h1>
    <h2 className="mt-3 text-2xl font-bold text-text">Page not found</h2>
    <p className="mt-3 text-text-muted max-w-sm">
      The page you&apos;re looking for doesn&apos;t exist or has been moved.
    </p>
    <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
      <Link
        to="/"
        className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-white text-sm font-medium rounded transition-colors hover:bg-primary-hover"
      >
        <ArrowLeft size={15} /> Back to Home
      </Link>
      <a
        href="mailto:support@teevexa.com"
        className="inline-flex items-center justify-center gap-2 px-6 py-2.5 border border-primary text-primary text-sm font-medium rounded transition-colors hover:bg-primary/5"
      >
        Email Support
      </a>
    </div>
  </div>
);

export default NotFound;
