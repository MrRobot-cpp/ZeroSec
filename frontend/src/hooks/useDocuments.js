import { useState, useEffect, useCallback } from "react";
import { getDocuments, uploadDocument, deleteDocument } from "@/services/documentService";

/**
 * Custom hook for managing documents
 * Handles fetching, uploading, and deleting documents
 */
export default function useDocuments() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);

  /**
   * Fetch all documents from the backend
   */
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const docs = await getDocuments();
      setDocuments(docs);
    } catch (err) {
      setError(err.message);
      console.error("Failed to fetch documents:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Upload a new document
   * @param {File} file - The file to upload
   * @param {string} sensitivity - The sensitivity level ("high", "medium", "low") - defaults to "medium"
   * @returns {Promise<Object>} - Upload result
   */
  const upload = useCallback(async (file, sensitivity = "medium") => {
    setUploading(true);
    setError(null);
    try {
      const result = await uploadDocument(file, sensitivity);
      // Refresh the documents list after successful upload
      await fetchDocuments();
      return result;
    } catch (err) {
      setError(err.message);
      console.error("Failed to upload document:", err);
      throw err;
    } finally {
      setUploading(false);
    }
  }, [fetchDocuments]);

  /**
   * Delete a document
   * @param {string} filename - The name of the file to delete
   * @returns {Promise<Object>} - Deletion result
   */
  const remove = useCallback(async (filename) => {
    setError(null);
    try {
      const result = await deleteDocument(filename);
      // Refresh the documents list after successful deletion
      await fetchDocuments();
      return result;
    } catch (err) {
      setError(err.message);
      console.error("Failed to delete document:", err);
      throw err;
    }
  }, [fetchDocuments]);

  // Fetch documents on mount
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  return {
    documents,
    loading,
    error,
    uploading,
    fetchDocuments,
    upload,
    remove,
  };
}
