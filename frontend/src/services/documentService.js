// Document API Service
import apiClient from './apiClient';

export async function getDocuments() {
  const response = await apiClient.get('/api/documents');
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Failed to fetch documents (${response.status})`);
  }
  const data = await response.json();
  return data.documents || [];
}

export async function uploadDocument(file, sensitivity = "medium", clearanceLevelId = null) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("sensitivity", sensitivity);
  if (clearanceLevelId !== null) {
    formData.append("clearance_level_id", String(clearanceLevelId));
  }

  const response = await apiClient.post('/api/documents/upload', formData);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Upload failed (${response.status})`);
  }
  return await response.json();
}

export async function deleteDocument(documentId) {
  const response = await apiClient.delete(`/api/documents/${documentId}`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Delete failed (${response.status})`);
  }
  return await response.json();
}

export async function fetchVaultData(documentId) {
  const response = await apiClient.get(`/api/documents/${documentId}/vault-inspect`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Vault inspect failed (${response.status})`);
  }
  return await response.json();
}

export default { getDocuments, uploadDocument, deleteDocument, fetchVaultData };
