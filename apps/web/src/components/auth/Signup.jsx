import { useState } from "react";
import { Link } from "react-router-dom";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Button, Alert } from "../ui";
import LoginModal from "./LoginModal";

const Signup = () => {
  const { register } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const validationSchema = Yup.object({
    username: Yup.string().min(3, "At least 3 characters").required("Username is required"),
    email: Yup.string().email("Invalid email format").required("Email is required"),
    password: Yup.string().min(6, "At least 6 characters").required("Password is required"),
    confirmPassword: Yup.string()
      .oneOf([Yup.ref("password"), null], "Passwords do not match")
      .required("Please confirm your password"),
    agreeToTerms: Yup.boolean()
      .oneOf([true], "You must accept the Terms & Privacy Policy to continue")
      .required(),
  });

  const handleSubmit = async (values, { setSubmitting, setErrors }) => {
    const result = await register({
      username: values.username,
      email: values.email,
      password: values.password,
    });
    if (!result.success) {
      setErrors({ api: result.message });
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-page flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-surface rounded-2xl shadow-card border border-border p-8">
          {/* Brand */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center mb-3">
              <span className="text-white font-bold">T</span>
            </div>
            <h1 className="text-2xl font-bold text-text">Create your account</h1>
            <p className="text-sm text-text-muted mt-1">Start managing tasks for free</p>
          </div>

          <Formik
            initialValues={{ username: "", email: "", password: "", confirmPassword: "", agreeToTerms: false }}
            validationSchema={validationSchema}
            onSubmit={handleSubmit}
          >
            {({ isSubmitting, errors }) => (
              <Form className="space-y-4">
                {errors.api && <Alert variant="danger">{errors.api}</Alert>}

                {/* Username */}
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-text mb-1.5">
                    Username
                  </label>
                  <Field
                    id="username"
                    type="text"
                    name="username"
                    placeholder="johndoe"
                    autoComplete="username"
                    className="w-full px-4 py-2.5 border border-border rounded-lg text-sm text-text bg-page placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                  />
                  <ErrorMessage name="username" component="p" className="text-danger text-xs mt-1" />
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="signup-email" className="block text-sm font-medium text-text mb-1.5">
                    Email address
                  </label>
                  <Field
                    id="signup-email"
                    type="email"
                    name="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="w-full px-4 py-2.5 border border-border rounded-lg text-sm text-text bg-page placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                  />
                  <ErrorMessage name="email" component="p" className="text-danger text-xs mt-1" />
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="signup-password" className="block text-sm font-medium text-text mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Field
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      name="password"
                      placeholder="Min. 6 characters"
                      autoComplete="new-password"
                      className="w-full px-4 py-2.5 pr-10 border border-border rounded-lg text-sm text-text bg-page placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition-colors"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <ErrorMessage name="password" component="p" className="text-danger text-xs mt-1" />
                </div>

                {/* Confirm Password */}
                <div>
                  <label htmlFor="signup-confirm" className="block text-sm font-medium text-text mb-1.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Field
                      id="signup-confirm"
                      type={showConfirm ? "text" : "password"}
                      name="confirmPassword"
                      placeholder="Re-enter password"
                      autoComplete="new-password"
                      className="w-full px-4 py-2.5 pr-10 border border-border rounded-lg text-sm text-text bg-page placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition-colors"
                      aria-label={showConfirm ? "Hide password" : "Show password"}
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <ErrorMessage name="confirmPassword" component="p" className="text-danger text-xs mt-1" />
                </div>

                {/* Terms checkbox */}
                <div>
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <Field
                      type="checkbox"
                      name="agreeToTerms"
                      id="agreeToTerms"
                      className="mt-0.5 w-4 h-4 rounded border-border accent-primary cursor-pointer flex-shrink-0"
                    />
                    <span className="text-sm text-text-muted leading-snug">
                      I agree to the{" "}
                      <Link to="/terms-and-conditions" target="_blank" className="text-primary hover:underline font-medium">
                        Terms &amp; Conditions
                      </Link>{" "}
                      and{" "}
                      <Link to="/privacy-policy" target="_blank" className="text-primary hover:underline font-medium">
                        Privacy Policy
                      </Link>
                    </span>
                  </label>
                  <ErrorMessage name="agreeToTerms" component="p" className="text-danger text-xs mt-1 ml-7" />
                </div>

                <Button
                  type="submit"
                  fullWidth
                  disabled={isSubmitting}
                  className="mt-2 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? "Creating account…" : <><UserPlus size={15} /> Create Account</>}
                </Button>

                <p className="text-sm text-text-muted text-center pt-1">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setShowLoginModal(true)}
                    className="text-primary font-medium hover:underline"
                  >
                    Log in
                  </button>
                </p>
              </Form>
            )}
          </Formik>
        </div>

      </div>

      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
    </div>
  );
};

export default Signup;
