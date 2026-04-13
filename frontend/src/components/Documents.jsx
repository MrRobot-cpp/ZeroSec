"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import PropTypes from "prop-types";
import useDocuments from "@/hooks/useDocuments";
import { getClearanceLevels } from "@/services/attributeService";
import { fetchVaultData } from "@/services/documentService";

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

function ClearanceDropdown({ value, onChange, levels, disabled }) {
  const [open, setOpen] = useState(false);

  const selected = value === null ? null : (levels.find(l => l.id === value) || null);
  const label = selected ? selected.name : "No Restriction";
  const dotColor = selected ? (selected.color || "#3b82f6") : "#6b7280";

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-600 bg-gray-800 text-sm font-medium text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:border-gray-500"
      >
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: dotColor }}
        />
        {label}
        <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-48 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-10 overflow-hidden">
          <button
            type="button"
            onClick={() => { onChange(null); setOpen(false); }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-gray-700 transition-colors text-gray-400 ${value === null ? "bg-gray-700/50" : ""}`}
          >
            <span className="w-2 h-2 rounded-full bg-gray-600 flex-shrink-0" />
            {"No Restriction"}
          </button>
          {[...levels].sort((a, b) => a.level - b.level).map(cl => (
            <button
              key={cl.id}
              type="button"
              onClick={() => { onChange(cl.id); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-gray-700 transition-colors text-gray-200 ${value === cl.id ? "bg-gray-700/50" : ""}`}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cl.color || "#3b82f6" }} />
              {cl.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function VaultInspectorModal({ doc, onClose }) {
  const [data, setData] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [chunkIdx, setChunkIdx] = useState(0);
  const [copied, setCopied] = useState(null);

  // Fetch on mount
  useEffect(() => {
    fetchVaultData(doc.id)
      .then(setData)
      .catch(e => setLoadErr(e.message));
  }, [doc.id]);

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const chunk = data?.chunks?.[chunkIdx];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔐</span>
            <div>
              <h2 className="text-white font-bold text-lg">Vault Inspector</h2>
              <p className="text-gray-400 text-xs font-mono truncate max-w-xs">{doc.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-xl">✕</button>
        </div>

        <div className="p-5">
          {loadErr && (
            <div className="p-4 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">{loadErr}</div>
          )}

          {!data && !loadErr && (
            <div className="text-center py-10 text-gray-400">
              <div className="animate-spin text-3xl mb-3">⚙️</div>
              Loading encrypted vault data…
            </div>
          )}

          {data && (
            <>
              {/* Algorithm banner */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { label: 'Algorithm', value: data.algorithm },
                  { label: 'KDF', value: data.kdf },
                  { label: 'Encrypted Chunks', value: data.total_chunks },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-center">
                    <p className="text-gray-400 text-xs mb-1">{label}</p>
                    <p className="text-green-400 font-mono font-bold text-sm">{value}</p>
                  </div>
                ))}
              </div>

              {/* Chunk navigator */}
              <div className="bg-black border border-gray-700 rounded-lg p-4 font-mono text-sm space-y-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-gray-400 text-xs">
                    Chunk {chunkIdx + 1} of {data.total_chunks}
                    {chunk?.created_at && (
                      <span className="ml-2 text-gray-600">· {chunk.created_at.slice(0, 19)}</span>
                    )}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setChunkIdx(i => Math.max(0, i - 1))}
                      disabled={chunkIdx === 0}
                      className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-xs disabled:opacity-40 transition-colors"
                    >← prev</button>
                    <button
                      onClick={() => setChunkIdx(i => Math.min(data.total_chunks - 1, i + 1))}
                      disabled={chunkIdx === data.total_chunks - 1}
                      className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-xs disabled:opacity-40 transition-colors"
                    >next →</button>
                  </div>
                </div>

                {chunk && [
                  { label: 'Key Version', value: `v${chunk.key_version}`, field: 'kv' },
                  { label: 'Nonce (96-bit)', value: chunk.nonce_hex, field: 'nonce' },
                  { label: 'Auth Tag (128-bit)', value: chunk.auth_tag_hex, field: 'tag' },
                  { label: `Ciphertext (${chunk.ciphertext_bytes} bytes, preview)`, value: chunk.ciphertext_hex, field: 'ct' },
                ].map(({ label, value, field }) => (
                  <div key={field}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-500 text-xs">{label}</span>
                      <button
                        onClick={() => copyToClipboard(value, field)}
                        className="text-gray-600 hover:text-gray-300 text-xs transition-colors"
                      >
                        {copied === field ? '✓ copied' : 'copy'}
                      </button>
                    </div>
                    <p className="text-green-400 break-all text-xs leading-relaxed">{value}</p>
                  </div>
                ))}
              </div>

              <p className="text-gray-600 text-xs text-center mt-4">
                Plaintext never stored — this is all that exists on disk
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Documents() {  const router = useRouter();
  const { documents, loading, error, uploading, upload, remove } = useDocuments();
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [sensitivity, setSensitivity] = useState("medium");
  const [vaultDoc, setVaultDoc] = useState(null);
  const [clearanceLevelId, setClearanceLevelId] = useState(null);
  const [clearanceLevels, setClearanceLevels] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    getClearanceLevels()
      .then(levels => setClearanceLevels(levels))
      .catch(() => setClearanceLevels([]));
  }, []);

  const viewDocument = (documentId) => {
    router.push(`/documents/${documentId}`);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploadSuccess(null);

    try {
      await upload(file, sensitivity, clearanceLevelId);
      setUploadSuccess(`File "${file.name}" uploaded successfully!`);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
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

  const getSensitivityColor = (sens) => {
    switch (sens?.toLowerCase()) {
      case "high":   return "text-red-400";
      case "medium": return "text-yellow-400";
      case "low":    return "text-green-400";
      default:       return "text-gray-400";
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (isoString) => {
    try {
      return new Date(isoString).toLocaleString();
    } catch {
      return isoString;
    }
  };
  
  const totalSize = documents?.reduce((sum, doc) => sum + (doc.size || 0), 0) || 0;

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
            <ClearanceDropdown
              value={clearanceLevelId}
              onChange={setClearanceLevelId}
              levels={clearanceLevels}
              disabled={uploading}
            />
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
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Clearance</th>
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
                      {doc.clearance_level
                        ? <span className="px-2 py-1 bg-blue-900/40 text-blue-300 border border-blue-700/50 rounded text-xs font-medium">{doc.clearance_level}</span>
                        : <span className="text-gray-500">—</span>}
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
                        {doc.sensitivity?.toLowerCase() === "high" && (
                          <button
                            onClick={() => setVaultDoc(doc)}
                            className="px-3 py-1 rounded text-sm transition-colors font-medium"
                            style={{ background: '#29b519', color: '#ffffff' }}
                            title="View encrypted cipher data"
                          >
                            Cipher
                          </button>
                        )}
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
              Are you sure you want to delete{" "}
              <span className="font-semibold text-white">&quot;{deleteConfirm.name}&quot;</span>?
              {" "}This action cannot be undone.
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

      {/* Vault Inspector Modal */}
      {vaultDoc && (
        <VaultInspectorModal doc={vaultDoc} onClose={() => setVaultDoc(null)} />
      )}

      {/* Info Footer */}
      <div className="bg-gray-800 border-t border-gray-700 p-4">
        <p className="text-gray-400 text-sm">
          <span className="font-semibold text-gray-300">{documents?.length || 0}</span>
          {" "}document(s) in the RAG system
          {documents?.length > 0 && (
            <span className="ml-4">
              {"Total size: "}
              <span className="font-semibold text-gray-300">{formatFileSize(totalSize)}</span>
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
