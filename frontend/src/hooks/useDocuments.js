import { useState, useEffect, useCallback } from "react";
import { getDocuments, uploadDocument, deleteDocument } from "@/services/documentService";

export default function useDocuments() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const docs = await getDocuments();
      setDocuments(docs);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const upload = useCallback(async (file, sensitivity = "medium", clearanceLevelId = null) => {
    setUploading(true);
    setError(null);
    try {
      const result = await uploadDocument(file, sensitivity, clearanceLevelId);
      // Optimistic update — add immediately using response data
      const newDoc = result.document;
      if (newDoc) {
        setDocuments(prev => [
          {
            id: newDoc.id,
            name: newDoc.name,
            sensitivity: newDoc.sensitivity,
            size: 0,
            uploaded_at: new Date().toISOString(),
            issues: [],
            status: "active",
            acl_tags: [],
          },
          ...prev,
        ]);
      }
      // Background sync to get full metadata (size, etc.)
      fetchDocuments();
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setUploading(false);
    }
  }, [fetchDocuments]);

  const remove = useCallback(async (documentId) => {
    setError(null);
    // Optimistic update — remove immediately
    setDocuments(prev => prev.filter(d => d.id !== documentId));
    try {
      const result = await deleteDocument(documentId);
      return result;
    } catch (err) {
      // Rollback on failure
      fetchDocuments();
      setError(err.message);
      throw err;
    }
  }, [fetchDocuments]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  return { documents, loading, error, uploading, fetchDocuments, upload, remove };
}
