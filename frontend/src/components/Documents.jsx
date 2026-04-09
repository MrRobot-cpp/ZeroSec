"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import useDocuments from "@/hooks/useDocuments";

const SENSITIVITY_STYLES = {
  low:    { label: "Low",    text: "text-green-400",  bg: "bg-green-900/30",  border: "border-green-600" },
  medium: { label: "Medium", text: "text-yellow-400", bg: "bg-yellow-900/30", border: "border-yellow-600" },
  high:   { label: "High",   text: "text-red-400",    bg: "bg-red-900/30",    border: "border-red-600" },
};

function SensitivityDropdown({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const current = SENSITIVITY_STYLES[value];

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-gray-800 ${current.border} ${current.text}`}
      >
        <span className={`w-2 h-2 rounded-full ${current.bg} border ${current.border}`} />
        {current.label}
        <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-36 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-10 overflow-hidden">
          {Object.entries(SENSITIVITY_STYLES).map(([key, s]) => (
            <button
              key={key}
              type="button"
              onClick={() => { onChange(key); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-gray-700 transition-colors ${s.text} ${value === key ? s.bg : ""}`}
            >
              <span className={`w-2 h-2 rounded-full border ${s.border} ${s.bg}`} />
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Documents() {
  const router = useRouter();
  const { documents, loading, error, uploading, upload, remove } = useDocuments();
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [sensitivity, setSensitivity] = useState("medium");
  const fileInputRef = useRef(null);

  const viewDocument = (documentId) => {
    router.push(`/documents/${documentId}`);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploadSuccess(null);

    try {
      const result = await upload(file, sensitivity);
      setUploadSuccess(`File "${file.name}" uploaded successfully!`);
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      // Clear success message after 5 seconds
      setTimeout(() => setUploadSuccess(null), 5000);
    } catch (err) {
      setUploadError(err.message);
    }
  };

  const handleDelete = async (documentId, documentName) => {
    setDeleteConfirm(null);
    try {
      await remove(documentId);
      setUploadSuccess(`File "${documentName}" deleted successfully!`);
      setTimeout(() => setUploadSuccess(null), 5000);
    } catch (err) {
      setUploadError(err.message);
    }
  };

  const getSensitivityColor = (sensitivity) => {
    switch (sensitivity?.toLowerCase()) {
      case "high":
        return "text-red-400";
      case "medium":
        return "text-yellow-400";
      case "low":
        return "text-green-400";
      default:
        return "text-gray-400";
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const formatDate = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString();
    } catch {
      return isoString;
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Document Management</h1>
            <p className="text-gray-400 text-sm">
              Upload any file type (.pdf, .docx, .doc, .txt, etc.) - RAG reads them automatically
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SensitivityDropdown
              value={sensitivity}
              onChange={setSensitivity}
              disabled={uploading}
            />
            <label
              htmlFor="file-upload"
              className={`px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium cursor-pointer transition-all duration-200 inline-flex items-center gap-2 ${
                uploading ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              {uploading ? "Uploading..." : "Upload Document"}
            </label>
            <input
              id="file-upload"
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              disabled={uploading}
              className="hidden"
            />
          </div>
        </div>

        {/* Success/Error Messages */}
        {uploadSuccess && (
          <div className="mt-4 p-3 bg-green-900/50 border border-green-700 rounded-md text-green-300 text-sm">
            {uploadSuccess}
          </div>
        )}
        {(uploadError || error) && (
          <div className="mt-4 p-3 bg-red-900/50 border border-red-700 rounded-md text-red-300 text-sm">
            {uploadError || error}
          </div>
        )}
      </div>

      {/* Documents Table */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-400">Loading documents...</div>
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <span className="text-6xl mb-4">📄</span>
            <p className="text-lg mb-2">No documents uploaded yet</p>
            <p className="text-sm">Upload your first document to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Name</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Sensitivity</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">ACL Tags</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Issues</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Size</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Uploaded</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                    <td className="py-3 px-4 text-gray-100">
                      <button
                        onClick={() => viewDocument(doc.id)}
                        className="flex items-center gap-2 hover:text-blue-400 transition-colors text-left"
                      >
                        <span>📄</span>
                        <span className="font-medium hover:underline">{doc.name}</span>
                      </button>
                    </td>
                    <td className={`py-3 px-4 font-semibold ${getSensitivityColor(doc.sensitivity)}`}>
                      {doc.sensitivity}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">
                        {doc.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1 flex-wrap">
                        {doc.acl_tags?.map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-blue-900/50 text-blue-300 rounded text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {doc.issues?.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {doc.issues.map((issue, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-red-900/50 text-red-300 rounded text-xs"
                            >
                              {issue}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-500 text-sm">None</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-300 text-sm">
                      {formatFileSize(doc.size)}
                    </td>
                    <td className="py-3 px-4 text-gray-400 text-sm">
                      {formatDate(doc.uploaded_at)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => viewDocument(doc.id)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                        >
                          View
                        </button>
                        <button
                          onClick={() => setDeleteConfirm({ id: doc.id, name: doc.name })}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4">Confirm Deletion</h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to delete <span className="font-semibold text-white">"{deleteConfirm.name}"</span>?
              This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm.id, deleteConfirm.name)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Footer */}
      <div className="bg-gray-800 border-t border-gray-700 p-4">
        <p className="text-gray-400 text-sm">
          <span className="font-semibold text-gray-300">{documents.length}</span> document(s) in the RAG system
          {documents.length > 0 && (
            <span className="ml-4">
              Total size: <span className="font-semibold text-gray-300">
                {formatFileSize(documents.reduce((acc, doc) => acc + (doc.size || 0), 0))}
              </span>
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
