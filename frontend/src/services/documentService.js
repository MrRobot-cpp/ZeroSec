// Document API Service
// Handles communication with the backend document endpoints

import apiClient from './apiClient';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5200";

/**
 * Get all documents
 * Uses legacy endpoint for compatibility
 * @returns {Promise<Array>} - Array of documents with metadata
 */
export async function getDocuments() {
  try {
    // Try authenticated endpoint first
    try {
      const response = await apiClient.get('/api/documents');
      if (response.ok) {
        const data = await response.json();
        return data.documents || [];
      }
    } catch (authError) {
      console.log('Trying legacy endpoint without auth...');
    }

    // Fallback to legacy endpoint (no auth required)
    const response = await fetch(`${API_BASE_URL}/documents`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.documents || [];
  } catch (error) {
    console.error("Error fetching documents:", error);
    throw new Error(`Failed to fetch documents: ${error.message}`);
  }
}

/**
 * Upload a new document
 * @param {File} file - The file to upload
 * @param {string} sensitivity - The sensitivity level ("high", "medium", "low")
 * @returns {Promise<Object>} - Upload response with document metadata
 */
export async function uploadDocument(file, sensitivity = "medium") {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("sensitivity", sensitivity);

    // Try authenticated endpoint first
    try {
      const response = await apiClient.post('/api/documents/upload', formData);
      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch (authError) {
      console.log('Auth upload failed, trying legacy...');
    }

    // Fallback to legacy endpoint
    const response = await fetch(`${API_BASE_URL}/documents/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error uploading document:", error);
    throw new Error(`Failed to upload document: ${error.message}`);
  }
}

/**
 * Delete a document
 * @param {number} documentId - The ID of the document to delete
 * @returns {Promise<Object>} - Deletion response
 */
export async function deleteDocument(documentId) {
  try {
    const response = await apiClient.delete(`/api/documents/${documentId}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error deleting document:", error);
    throw new Error(`Failed to delete document: ${error.message}`);
  }
}

export default {
  getDocuments,
  uploadDocument,
  deleteDocument,
};
