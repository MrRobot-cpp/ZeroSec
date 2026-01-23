// Document API Service
// Handles communication with the backend document endpoints

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5200";

/**
 * Get all documents
 * @returns {Promise<Array>} - Array of documents with metadata
 */
export async function getDocuments() {
  try {
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

    const response = await fetch(`${API_BASE_URL}/documents/upload`, {
      method: "POST",
      body: formData,
      // Don't set Content-Type header - browser will set it with boundary for multipart/form-data
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
 * @param {string} filename - The name of the file to delete
 * @returns {Promise<Object>} - Deletion response
 */
export async function deleteDocument(filename) {
  try {
    const response = await fetch(`${API_BASE_URL}/documents/${encodeURIComponent(filename)}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    });

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
