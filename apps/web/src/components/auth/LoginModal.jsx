import { useNavigate } from "react-router-dom";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { X, LogIn } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Button, Alert } from "../ui";

const LoginModal = ({ onClose }) => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const goTo = (path) => {
    if (onClose) onClose();
    navigate(path);
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-surface rounded-2xl shadow-card w-full max-w-md border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-sm">T</span>
            </div>
            <h2 className="text-lg font-bold text-text">Welcome back</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-muted transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-sm text-text-muted mb-6">Sign in to your Taskly account to continue.</p>

          <Formik
            initialValues={{ identifier: "", password: "" }}
            validationSchema={Yup.object({
              identifier: Yup.string().required("Email or username is required"),
              password: Yup.string().required("Password is required"),
            })}
            onSubmit={async (values, { setSubmitting, setErrors }) => {
              const result = await login(values);
              if (result.success) {
                if (onClose) onClose();
              } else {
                setErrors({ api: result.message });
              }
              setSubmitting(false);
            }}
          >
            {({ isSubmitting, errors }) => (
              <Form className="space-y-4">
                {errors.api && (
                  <Alert variant="danger">{errors.api}</Alert>
                )}

                <div>
                  <label className="block text-sm font-medium text-text mb-1.5">
                    Email or Username
                  </label>
                  <Field
                    type="text"
                    name="identifier"
                    placeholder="you@example.com"
                    autoComplete="username"
                    className="w-full px-4 py-2.5 border border-border rounded-lg text-sm text-text bg-page placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                  />
                  <ErrorMessage name="identifier" component="p" className="text-danger text-xs mt-1" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium text-text">Password</label>
                    <button
                      type="button"
                      onClick={() => goTo("/forgot-password")}
                      className="text-xs text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <Field
                    type="password"
                    name="password"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="w-full px-4 py-2.5 border border-border rounded-lg text-sm text-text bg-page placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                  />
                  <ErrorMessage name="password" component="p" className="text-danger text-xs mt-1" />
                </div>

                <Button
                  type="submit"
                  fullWidth
                  disabled={isSubmitting}
                  className="mt-2 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? "Signing in…" : <><LogIn size={15} /> Sign In</>}
                </Button>

                <p className="text-sm text-text-muted text-center">
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    onClick={() => goTo("/signup")}
                    className="text-primary font-medium hover:underline"
                  >
                    Sign Up
                  </button>
                </p>
              </Form>
            )}
          </Formik>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
