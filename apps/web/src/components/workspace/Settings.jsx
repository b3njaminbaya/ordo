import { useState } from "react";
import { Formik, Form } from "formik";
import * as Yup from "yup";
import { User, Lock, Bell, Trash2, Eye, EyeOff, Sun, Moon, Monitor } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import api from "../../api/axios";
import { Input, Button, Alert } from "../ui";

const Section = ({ icon: Icon, title, description, children }) => (
  <div className="bg-surface rounded-xl border border-border overflow-hidden">
    <div className="px-6 py-5 border-b border-border flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon size={16} className="text-primary" />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        {description && <p className="text-xs text-text-muted mt-0.5">{description}</p>}
      </div>
    </div>
    <div className="px-6 py-5">{children}</div>
  </div>
);

const profileSchema = Yup.object({
  username: Yup.string().min(3, "At least 3 characters").required("Username is required"),
  email: Yup.string().email("Invalid email").required("Email is required"),
});

const passwordSchema = Yup.object({
  current_password: Yup.string().required("Current password is required"),
  new_password: Yup.string().min(6, "At least 6 characters").required("New password is required"),
  confirm_password: Yup.string()
    .oneOf([Yup.ref("new_password")], "Passwords do not match")
    .required("Please confirm your new password"),
});

const THEME_OPTIONS = [
  { value: "light",  label: "Light",  icon: Sun,     desc: "Always use light theme" },
  { value: "dark",   label: "Dark",   icon: Moon,    desc: "Always use dark theme" },
  { value: "system", label: "System", icon: Monitor, desc: "Follow your device setting" },
];

const Settings = () => {
  const { user, setUser, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(user?.notifications_enabled ?? true);
  const [notifSaving, setNotifSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const handleProfileSubmit = async (values, { setSubmitting, setStatus }) => {
    try {
      await api.patch("/users/updateprofile", {
        username: values.username,
        email: values.email,
      });
      setUser((prev) => ({ ...prev, username: values.username, email: values.email }));
      setStatus({ success: "Profile updated successfully." });
    } catch (err) {
      setStatus({ error: err.response?.data?.error || "Failed to update profile." });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordSubmit = async (values, { setSubmitting, setStatus, resetForm }) => {
    try {
      await api.patch("/users/change-password", {
        current_password: values.current_password,
        new_password: values.new_password,
      });
      setStatus({ success: "Password updated successfully." });
      resetForm();
    } catch (err) {
      setStatus({ error: err.response?.data?.error || "Failed to update password." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleNotifToggle = async (val) => {
    setNotifSaving(true);
    try {
      await api.patch("/users/notifications", { notifications_enabled: val });
      setNotifEnabled(val);
      setUser((prev) => ({ ...prev, notifications_enabled: val }));
    } catch {
      // revert
    } finally {
      setNotifSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== user?.username) {
      setDeleteError(`Type your username "${user?.username}" to confirm.`);
      return;
    }
    try {
      await api.delete("/users/deleteaccount");
      logout();
    } catch (err) {
      setDeleteError(err.response?.data?.error || "Failed to delete account.");
    }
  };

  return (
    <div className="min-h-full bg-page py-8 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-7">
          <h1 className="text-xl font-bold text-text">Settings</h1>
          <p className="text-sm text-text-muted mt-1">Manage your account, security, and preferences.</p>
        </div>

        {/* Top row: Profile | Change Password */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

          {/* ── Profile ── */}
          <Section icon={User} title="Profile" description="Update your display name and email address.">
            <Formik
              initialValues={{ username: user?.username || "", email: user?.email || "" }}
              validationSchema={profileSchema}
              onSubmit={handleProfileSubmit}
              enableReinitialize
            >
              {({ values, handleChange, handleBlur, isSubmitting, errors, touched, status }) => (
                <Form className="space-y-4">
                  {status?.error && <Alert variant="danger">{status.error}</Alert>}
                  {status?.success && <Alert variant="success">{status.success}</Alert>}
                  <Input
                    label="Username"
                    name="username"
                    value={values.username}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={touched.username && errors.username}
                  />
                  <Input
                    label="Email address"
                    name="email"
                    type="email"
                    value={values.email}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={touched.email && errors.email}
                  />
                  <div className="flex justify-end pt-1">
                    <Button type="submit" size="sm" loading={isSubmitting}>
                      Save Changes
                    </Button>
                  </div>
                </Form>
              )}
            </Formik>
          </Section>

          {/* ── Password ── */}
          <Section icon={Lock} title="Change Password" description="Use a strong password you don't use elsewhere.">
            <Formik
              initialValues={{ current_password: "", new_password: "", confirm_password: "" }}
              validationSchema={passwordSchema}
              onSubmit={handlePasswordSubmit}
            >
              {({ values, handleChange, handleBlur, isSubmitting, errors, touched, status }) => (
                <Form className="space-y-4">
                  {status?.error && <Alert variant="danger">{status.error}</Alert>}
                  {status?.success && <Alert variant="success">{status.success}</Alert>}

                  <div>
                    <label className="block text-sm font-medium text-text mb-1.5">Current Password</label>
                    <div className="relative">
                      <input
                        type={showCurrent ? "text" : "password"}
                        name="current_password"
                        value={values.current_password}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        placeholder="Enter current password"
                        className="w-full px-4 py-2.5 pr-10 border border-border rounded-lg text-sm text-text bg-page placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                      />
                      <button type="button" onClick={() => setShowCurrent(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text">
                        {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {touched.current_password && errors.current_password && (
                      <p className="text-danger text-xs mt-1">{errors.current_password}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text mb-1.5">New Password</label>
                    <div className="relative">
                      <input
                        type={showNew ? "text" : "password"}
                        name="new_password"
                        value={values.new_password}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        placeholder="Min. 6 characters"
                        className="w-full px-4 py-2.5 pr-10 border border-border rounded-lg text-sm text-text bg-page placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                      />
                      <button type="button" onClick={() => setShowNew(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text">
                        {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {touched.new_password && errors.new_password && (
                      <p className="text-danger text-xs mt-1">{errors.new_password}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text mb-1.5">Confirm New Password</label>
                    <div className="relative">
                      <input
                        type={showConfirm ? "text" : "password"}
                        name="confirm_password"
                        value={values.confirm_password}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        placeholder="Re-enter new password"
                        className="w-full px-4 py-2.5 pr-10 border border-border rounded-lg text-sm text-text bg-page placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                      />
                      <button type="button" onClick={() => setShowConfirm(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text">
                        {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {touched.confirm_password && errors.confirm_password && (
                      <p className="text-danger text-xs mt-1">{errors.confirm_password}</p>
                    )}
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button type="submit" size="sm" loading={isSubmitting}>
                      Update Password
                    </Button>
                  </div>
                </Form>
              )}
            </Formik>
          </Section>
        </div>

        {/* Middle row: Appearance */}
        <div className="mt-5">
          <Section icon={Monitor} title="Appearance" description="Choose how Teevexa Ordo looks to you.">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {THEME_OPTIONS.map(({ value, label, icon: Icon, desc }) => {
                const active = theme === value;
                return (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={[
                      "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center",
                      active
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-primary/40 text-text-muted hover:text-text",
                    ].join(" ")}
                  >
                    <Icon size={22} className={active ? "text-primary" : ""} />
                    <span className={["text-sm font-semibold", active ? "text-primary" : "text-text"].join(" ")}>{label}</span>
                    <span className="text-xs text-text-muted">{desc}</span>
                  </button>
                );
              })}
            </div>
          </Section>
        </div>

        {/* Bottom row: Notifications | Danger Zone */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start mt-5">

          {/* ── Notifications ── */}
          <Section icon={Bell} title="Notifications" description="Control when and how Teevexa Ordo notifies you.">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-text">Deadline reminders</p>
                <p className="text-xs text-text-muted mt-0.5">Get notified 1 hour before tasks are due.</p>
              </div>
              <button
                onClick={() => handleNotifToggle(!notifEnabled)}
                disabled={notifSaving}
                aria-checked={notifEnabled}
                role="switch"
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                  notifEnabled ? "bg-primary" : "bg-surface-muted border border-border"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    notifEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </Section>

          {/* ── Danger Zone ── */}
          <div className="bg-surface rounded-xl border border-danger/30 overflow-hidden">
            <div className="px-6 py-5 border-b border-danger/20 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-danger/10 flex items-center justify-center">
                <Trash2 size={16} className="text-danger" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-danger">Danger Zone</h2>
                <p className="text-xs text-text-muted mt-0.5">Permanent actions that cannot be undone.</p>
              </div>
            </div>
            <div className="px-6 py-5 space-y-4">
              {deleteError && <Alert variant="danger">{deleteError}</Alert>}
              <p className="text-sm text-text-muted">
                Deleting your account will permanently remove all your data, task lists, and workspace membership.
                This action <strong className="text-text">cannot be undone</strong>.
              </p>
              <div>
                <label className="block text-sm font-medium text-text mb-1.5">
                  Type <span className="font-mono text-danger">{user?.username}</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirm}
                  onChange={(e) => { setDeleteConfirm(e.target.value); setDeleteError(""); }}
                  placeholder={user?.username}
                  className="w-full px-4 py-2.5 border border-border rounded-lg text-sm text-text bg-page placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-danger/30 focus:border-danger transition-colors"
                />
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={handleDeleteAccount}
                disabled={deleteConfirm !== user?.username}
                className="flex items-center gap-1.5"
              >
                <Trash2 size={13} /> Delete My Account
              </Button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Settings;
