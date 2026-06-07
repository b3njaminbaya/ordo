import { useState, useEffect, useRef, useCallback } from "react";
import {
  Paperclip, FileText, Image, File, Download, Trash2, Upload, AlertCircle,
} from "lucide-react";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import { Spinner } from "../ui";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "https://taskly-app-9u0e.onrender.com";

const ACCEPTED = [
  "image/png","image/jpeg","image/gif","image/webp","image/svg+xml",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain","text/markdown","text/csv",
  "application/zip",
].join(",");

function fileIcon(mimeType) {
  if (!mimeType) return <File size={14} />;
  if (mimeType.startsWith("image/"))  return <Image   size={14} className="text-primary" />;
  if (mimeType === "application/pdf") return <FileText size={14} className="text-danger"  />;
  if (mimeType.includes("word") || mimeType.includes("text")) return <FileText size={14} className="text-primary" />;
  return <File size={14} className="text-text-muted" />;
}

function formatBytes(bytes) {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelTime(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function TaskAttachments({ taskId, taskOwnerId, onCountChange }) {
  const { user } = useAuth();
  const fileRef = useRef(null);
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [uploading, setUploading]     = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [deletingId, setDeletingId]   = useState(null);

  const updateAttachments = (next) => {
    setAttachments(next);
    onCountChange?.(next.length);
  };

  const fetchAttachments = useCallback(async () => {
    try {
      const res = await api.get(`/tasks/${taskId}/attachments`);
      const list = Array.isArray(res.data) ? res.data : [];
      setAttachments(list);
      onCountChange?.(list.length);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [taskId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchAttachments(); }, [fetchAttachments]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!fileRef.current) return;
    fileRef.current.value = "";          // reset so same file can be re-selected
    if (!file) return;

    // Client-side size check (10 MB)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File too large. Maximum 10 MB.");
      return;
    }

    setUploadError("");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post(`/tasks/${taskId}/attachments`, formData, {
        headers: { "Content-Type": undefined },
      });
      updateAttachments([...attachments, res.data]);
    } catch (err) {
      setUploadError(err.response?.data?.error || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (attachmentId) => {
    setDeletingId(attachmentId);
    try {
      await api.delete(`/tasks/${taskId}/attachments/${attachmentId}`);
      updateAttachments(attachments.filter((a) => a.id !== attachmentId));
    } catch {
      // non-fatal — item stays in list
    } finally {
      setDeletingId(null);
    }
  };

  const canDelete = (a) =>
    a.uploaded_by === user?.id || taskOwnerId === user?.id;

  const downloadUrl = (a) =>
    `${API_BASE}/tasks/attachments/${a.id}/download`;

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Paperclip size={14} className="text-text-muted" />
          <h3 className="text-sm font-semibold text-text">
            Attachments
            {attachments.length > 0 && (
              <span className="ml-1.5 text-xs font-normal text-text-muted">
                ({attachments.length}/10)
              </span>
            )}
          </h3>
        </div>

        {attachments.length < 10 && (
          <>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              {uploading ? <Spinner size="xs" /> : <Upload size={12} />}
              {uploading ? "Uploading…" : "Attach"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED}
              onChange={handleFileChange}
              className="hidden"
            />
          </>
        )}
      </div>

      {/* Error */}
      {uploadError && (
        <div className="flex items-center gap-1.5 text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2 mb-2">
          <AlertCircle size={12} />
          {uploadError}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-3">
          <Spinner size="sm" />
        </div>
      ) : attachments.length === 0 ? (
        <p className="text-xs text-text-muted py-2 text-center">
          No attachments yet. Click "Attach" to upload a file.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {attachments.map((a) => {
            const isDeleting = deletingId === a.id;
            return (
              <li
                key={a.id}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border bg-surface-muted group transition-opacity ${isDeleting ? "opacity-40" : ""}`}
              >
                {/* Icon */}
                <span className="flex-shrink-0">{fileIcon(a.mime_type)}</span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text truncate">{a.original_name}</p>
                  <p className="text-[11px] text-text-muted">
                    {formatBytes(a.file_size)}
                    {a.uploader_name && ` · ${a.uploader_name}`}
                    {a.uploaded_at && ` · ${formatRelTime(a.uploaded_at)}`}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a
                    href={downloadUrl(a)}
                    download={a.original_name}
                    onClick={(e) => {
                      // Use fetch + blob so the auth token is sent
                      e.preventDefault();
                      api.get(`/tasks/attachments/${a.id}/download`, { responseType: "blob" })
                        .then((res) => {
                          const url = URL.createObjectURL(res.data);
                          const link = document.createElement("a");
                          link.href = url;
                          link.download = a.original_name;
                          link.click();
                          URL.revokeObjectURL(url);
                        })
                        .catch(() => {});
                    }}
                    className="p-1 rounded text-text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                    aria-label="Download"
                  >
                    <Download size={13} />
                  </a>
                  {canDelete(a) && !isDeleting && (
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="p-1 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                      aria-label="Delete attachment"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
