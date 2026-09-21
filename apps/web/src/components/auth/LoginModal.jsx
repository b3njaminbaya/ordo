import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { LogIn, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Button, Alert, Modal } from "../ui";

const inputCls =
  "w-full px-4 py-2.5 border border-border rounded-lg text-sm text-text bg-page placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors";

const LoginModal = ({ onClose }) => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  const goTo = (path) => {
    onClose?.();
    navigate(path);
  };

  return (
    <Modal open onClose={onClose} title="Welcome back" size="md">
      <p className="text-sm text-text-muted mb-6">Sign in to your Ordo account to continue.</p>

      <Formik
        initialValues={{ identifier: "", password: "" }}
        validationSchema={Yup.object({
          identifier: Yup.string().trim().required("Email or username is required"),
          password: Yup.string().required("Password is required"),
        })}
        onSubmit={async (values, { setSubmitting, setErrors }) => {
          const result = await login({ identifier: values.identifier.trim(), password: values.password });
          if (result.success) onClose?.();
          else setErrors({ api: result.message });
          setSubmitting(false);
        }}
      >
        {({ isSubmitting, errors }) => (
          <Form className="space-y-4" noValidate>
            {errors.api && <Alert variant="danger">{errors.api}</Alert>}

            <div>
              <label htmlFor="login-identifier" className="block text-sm font-medium text-text mb-1.5">Email or Username</label>
              <Field id="login-identifier" type="text" name="identifier" placeholder="you@example.com" autoComplete="username" className={inputCls} />
              <ErrorMessage name="identifier" component="p" className="text-danger text-xs mt-1" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-password" className="block text-sm font-medium text-text">Password</label>
                <button type="button" onClick={() => goTo("/forgot-password")} className="text-xs text-primary hover:underline">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Field
                  id="login-password" type={showPassword ? "text" : "password"} name="password"
                  placeholder="Enter your password" autoComplete="current-password" className={`${inputCls} pr-10`}
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

            <Button type="submit" fullWidth loading={isSubmitting} className="mt-2">
              {!isSubmitting && <LogIn size={15} />} {isSubmitting ? "Signing in…" : "Sign In"}
            </Button>

            <p className="text-sm text-text-muted text-center">
              Don&apos;t have an account?{" "}
              <button type="button" onClick={() => goTo("/signup")} className="text-primary font-medium hover:underline">Sign Up</button>
            </p>
          </Form>
        )}
      </Formik>
    </Modal>
  );
};

export default LoginModal;
