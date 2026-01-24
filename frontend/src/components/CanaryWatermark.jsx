"use client";
import React, { useState, useRef, useEffect } from "react";
import { uploadDocument } from "../services/documentService";

const HISTORY_KEY = 'canary_watermark_history';

function saveHistory(entry) {
  let history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  history.unshift(entry);
  if (history.length > 10) history = history.slice(0, 10);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function loadHistory() {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
}

export default function CanaryWatermark({ fileInputRef, setUploading, uploading }) {
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [progress, setProgress] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [history, setHistory] = useState([]);

  // Load history on client only
  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      setHistory(loadHistory());
    }
  }, []);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadSuccess(null);
    setProgress(0);
    setUploading(true);
    try {
      // Progress bar using XMLHttpRequest
      const formData = new FormData();
      formData.append('file', file);
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'http://localhost:5200/canary/watermark');
        xhr.responseType = 'blob';
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            // Fetch metadata from headers
            let canaryId = xhr.getResponseHeader('X-Canary-ID') || '';
            let outputPath = xhr.getResponseHeader('X-Output-Path') || '';
            let hash = xhr.getResponseHeader('X-Canary-Hash') || '';
            let filename = 'watermarked_file';
            const contentDisp = xhr.getResponseHeader('Content-Disposition');
            if (contentDisp) {
              const match = contentDisp.match(/filename="(.+)"/);
              if (match) filename = match[1];
            }
            
            console.log('Raw headers:', {
              'X-Canary-ID': xhr.getResponseHeader('X-Canary-ID'),
              'X-Output-Path': xhr.getResponseHeader('X-Output-Path'),
              'X-Canary-Hash': xhr.getResponseHeader('X-Canary-Hash'),
              'X-Canary-Meta': xhr.getResponseHeader('X-Canary-Meta')
            });
            
            // Try to get all metadata from X-Canary-Meta header if available
            const metaHeader = xhr.getResponseHeader('X-Canary-Meta');
            if (metaHeader) {
              try {
                const meta = JSON.parse(metaHeader);
                canaryId = meta.canary_id || canaryId;
                outputPath = meta.output_path || outputPath;
                hash = meta.hash || hash;
                filename = meta.filename || filename;
                console.log('Parsed Canary Meta:', meta);
              } catch (e) {
                console.error('Failed to parse X-Canary-Meta:', metaHeader, e);
              }
            } else {
              console.log('Fallback headers:', {canaryId, outputPath, hash, filename});
            }
            
            const newEntry = {
              canaryId,
              outputPath,
              filename,
              hash,
              date: new Date().toISOString(),
              original: file.name,
              size: file.size,
              type: file.type
            };
            console.log('Saving to history:', newEntry);
            saveHistory(newEntry);
            // Immediately update history state with the new entry
            setHistory(prev => [newEntry, ...prev.slice(0, 9)]);
            console.log('History updated with:', newEntry);

            // Auto-download the watermarked file
            const url = window.URL.createObjectURL(xhr.response);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);

            // Auto-upload the watermarked file to RAG with high sensitivity
            const blob = xhr.response;
            const watermarkedFile = new File([blob], filename, { type: blob.type });
            uploadDocument(watermarkedFile, "high")
              .then(() => {
                setUploadSuccess(`File "${file.name}" watermarked and uploaded to RAG with high sensitivity!`);
              })
              .catch((err) => {
                console.error('Failed to upload to RAG:', err);
                setUploadSuccess(`File "${file.name}" watermarked! (RAG upload failed: ${err.message})`);
              });

            resolve();
          } else {
            let errMsg = 'Failed to watermark document.';
            try {
              const reader = new FileReader();
              reader.onload = () => {
                try {
                  const data = JSON.parse(reader.result);
                  errMsg = data.error || errMsg;
                } catch {}
                setUploadError(errMsg);
                reject(new Error(errMsg));
              };
              reader.readAsText(xhr.response);
            } catch {
              setUploadError(errMsg);
              reject(new Error(errMsg));
            }
          }
        };
        xhr.onerror = () => {
          setUploadError('Network error.');
          reject(new Error('Network error.'));
        };
        xhr.send(formData);
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTimeout(() => setUploadSuccess(null), 5000);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleDelete = (idx) => {
    let newHistory = [...history];
    newHistory.splice(idx, 1);
    setHistory(newHistory);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
    setDeleteConfirm(null);
    setUploadSuccess('Entry deleted!');
    setTimeout(() => setUploadSuccess(null), 3000);
  };

  const handleUploadToRAG = async (entry) => {
    try {
      setUploading(true);
      setUploadError(null);
      setUploadSuccess(null);

      // Fetch the watermarked file from the output path
      const response = await fetch(entry.outputPath);
      if (!response.ok) {
        throw new Error('Failed to fetch watermarked file');
      }
      const blob = await response.blob();
      const file = new File([blob], entry.filename, { type: blob.type });

      // Upload to RAG documents with high sensitivity
      await uploadDocument(file, "high");
      setUploadSuccess(`"${entry.filename}" uploaded to RAG with high sensitivity!`);
      setTimeout(() => setUploadSuccess(null), 5000);
    } catch (err) {
      setUploadError(`Failed to upload to RAG: ${err.message}`);
    } finally {
      setUploading(false);
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
    <div className="flex-1 overflow-auto p-6">
      {/* Watermarked Files Table */}
      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <span className="text-6xl mb-4">🔒</span>
          <p className="text-lg mb-2">No watermarked files yet</p>
          <p className="text-sm">Upload your first document to get started</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Name</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Canary ID</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">SHA-256 Hash</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Output Path</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Size</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Date</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry, idx) => (
                <tr key={idx} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                  <td className="py-3 px-4 text-gray-100">
                    <div className="flex items-center gap-2">
                      <span>🔒</span>
                      <span className="font-medium">{entry.filename}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-blue-300 break-all">
                    {entry.canaryId || <span className="text-gray-500">(not available)</span>}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-green-300 break-all">
                    {entry.hash || <span className="text-gray-500">(not available)</span>}
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-400 break-all">
                    {entry.outputPath || <span className="text-gray-500">(not available)</span>}
                  </td>
                  <td className="py-3 px-4 text-gray-300 text-sm">
                    {formatFileSize(entry.size)}
                  </td>
                  <td className="py-3 px-4 text-gray-400 text-sm">
                    {formatDate(entry.date)}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUploadToRAG(entry)}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors"
                        disabled={uploading}
                      >
                        Upload
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(idx)}
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
      {/* Delete Confirmation Modal */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4">Confirm Deletion</h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to delete <span className="font-semibold text-white">"{history[deleteConfirm]?.filename}"</span>?
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
                onClick={() => handleDelete(deleteConfirm)}
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
          <span className="font-semibold text-gray-300">{history.length}</span> watermarked file(s)
          {history.length > 0 && (
            <span className="ml-4">
              Total size: <span className="font-semibold text-gray-300">
                {formatFileSize(history.reduce((acc, entry) => acc + (entry.size || 0), 0))}
              </span>
            </span>
          )}
        </p>
      </div>
      {/* Upload Button (footer) */}
      {/* Hidden file input - handled by parent */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        disabled={uploading}
        className="hidden"
        accept=".pdf,.docx,.txt"
      />
    </div>
  );
}
