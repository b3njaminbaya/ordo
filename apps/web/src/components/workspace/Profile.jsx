import { useState, useCallback, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import Cropper from "react-easy-crop";
import { Settings, LogOut, Camera, X, ZoomIn, ZoomOut, Check, Mail, Building2, User as UserIcon, Shield } from "lucide-react";
import { Button, Alert } from "../ui";
import api from "../../api/axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "https://taskly-app-9u0e.onrender.com";

async function getCroppedBlob(imageSrc, croppedAreaPixels) {
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", reject);
    img.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  const size = Math.min(croppedAreaPixels.width, croppedAreaPixels.height);
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    size,
    size,
  );

  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
}

const CropModal = ({ src, onConfirm, onCancel, uploading }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const onCropComplete = useCallback((_, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl border border-border w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-text">Crop your photo</h2>
          <button onClick={onCancel} className="text-text-muted hover:text-text transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Crop area */}
        <div className="relative bg-black" style={{ height: 320 }}>
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        {/* Zoom control */}
        <div className="px-5 py-4 border-t border-border">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setZoom((z) => Math.max(1, z - 0.1))}
              className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-muted transition-colors"
            >
              <ZoomOut size={16} />
            </button>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-primary"
              aria-label="Zoom"
            />
            <button
              onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
              className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-muted transition-colors"
            >
              <ZoomIn size={16} />
            </button>
          </div>
          <p className="text-xs text-text-muted text-center mt-2">Drag to reposition · Pinch or scroll to zoom</p>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex gap-2">
          <Button variant="outline" fullWidth onClick={onCancel} disabled={uploading}>
            Cancel
          </Button>
          <Button
            fullWidth
            onClick={() => onConfirm(croppedAreaPixels)}
            loading={uploading}
            className="flex items-center justify-center gap-1.5"
          >
            <Check size={15} /> Apply & Save
          </Button>
        </div>
      </div>
    </div>
  );
};

const Profile = () => {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [imageSrc, setImageSrc] = useState(null);
  const [showCrop, setShowCrop] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const avatarUrl = user?.profile_picture
    ? `${API_BASE}${user.profile_picture}`
    : null;

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : "??";

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File too large. Maximum 5 MB.");
      return;
    }
    setUploadError("");
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      setImageSrc(reader.result);
      setShowCrop(true);
    });
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCropConfirm = async (croppedAreaPixels) => {
    try {
      setUploading(true);
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels);
      const formData = new FormData();
      formData.append("file", blob, "avatar.jpg");

      const res = await api.post("/users/profile-picture", formData, {
        headers: { "Content-Type": undefined },
      });

      setUser((prev) => ({ ...prev, profile_picture: res.data.profile_picture_url }));
      setShowCrop(false);
      setImageSrc(null);
    } catch (err) {
      setUploadError(err.response?.data?.error || "Upload failed. Please try again.");
      setShowCrop(false);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-full bg-page py-8 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">

        {uploadError && (
          <Alert variant="danger" className="mb-5" onDismiss={() => setUploadError("")}>
            {uploadError}
          </Alert>
        )}

        {/* Main profile card */}
        <div className="bg-surface rounded-2xl border border-border overflow-hidden">
          {/* Top section */}
          <div className="p-8 flex flex-col sm:flex-row items-center sm:items-start gap-8">
            {/* Avatar with upload overlay */}
            <div className="relative flex-shrink-0 group">
              <div className="w-28 h-28 rounded-full bg-primary flex items-center justify-center overflow-hidden border-4 border-border shadow-sm">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={user?.username} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white font-bold text-3xl">{initials}</span>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                aria-label="Change profile picture"
              >
                <Camera size={22} className="text-white" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Name & actions */}
            <div className="flex-1 text-center sm:text-left min-w-0">
              <h1 className="text-2xl font-bold text-text">{user?.username || "Guest User"}</h1>
              <p className="text-sm text-text-muted mt-1 break-all">{user?.email}</p>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-primary/10 text-primary mt-3">
                <Shield size={11} />
                {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "Member"}
              </span>
              <div className="flex flex-wrap gap-3 mt-5 justify-center sm:justify-start">
                <Button size="sm" onClick={() => navigate("/workspace/settings")}
                  className="flex items-center gap-1.5">
                  <Settings size={13} /> Edit Profile
                </Button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-text-muted hover:text-text hover:border-primary/40 transition-colors"
                >
                  <Camera size={13} /> Change Photo
                </button>
                <Button size="sm" variant="ghost" onClick={logout}
                  className="flex items-center gap-1.5 text-danger hover:bg-danger/10 hover:text-danger">
                  <LogOut size={13} /> Sign Out
                </Button>
              </div>
            </div>
          </div>

          {/* Info grid */}
          <div className="border-t border-border grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
            {[
              { Icon: Mail,      label: "Email",     value: user?.email || "—" },
              { Icon: Building2, label: "Workspace", value: user?.workspace?.name || `${user?.username}'s Workspace` },
              { Icon: UserIcon,  label: "Username",  value: `@${user?.username || "—"}` },
            ].map(({ Icon, label, value }) => (
              <div key={label} className="flex items-start gap-4 px-6 py-5">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon size={16} className="text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-text-muted">{label}</p>
                  <p className="text-sm font-medium text-text break-words mt-0.5">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-4 bg-surface rounded-2xl border border-border p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-4">Quick Actions</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button fullWidth variant="outline" onClick={() => navigate("/workspace/settings")}
              className="flex items-center justify-center gap-2 py-3">
              <Settings size={14} /> Account Settings
            </Button>
            <Button fullWidth variant="outline" onClick={() => navigate("/workspace/notifications")}
              className="flex items-center justify-center gap-2 py-3">
              View Notifications
            </Button>
          </div>
        </div>

      </div>

      {/* Crop modal */}
      {showCrop && imageSrc && (
        <CropModal
          src={imageSrc}
          onConfirm={handleCropConfirm}
          onCancel={() => { setShowCrop(false); setImageSrc(null); }}
          uploading={uploading}
        />
      )}
    </div>
  );
};

export default Profile;
