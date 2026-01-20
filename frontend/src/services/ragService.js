// RAG API Service
// Handles communication with the backend RAG endpoints
// Backend is running on port 5200 and endpoint is at /query

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5200";

/**
 * Send a query to the RAG system
 * @param {string} question - The user's question
 * @returns {Promise<Object>} - The RAG response with answer and metadata
 */
export async function queryRag(question) {
  try {
    // Connected to Backend/app.py /query endpoint (line 15-23)
    // Backend response format from rag_service.py:
    // - BLOCK: { "decision": "BLOCK", "reason": "..." }
    // - ALLOW: { "decision": "ALLOW", "answer": "..." }
    const response = await fetch(`${API_BASE_URL}/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Handle BLOCK decision from firewall
    if (data.decision === "BLOCK") {
      throw new Error(`Query blocked by security firewall: ${data.reason || "Unknown reason"}`);
    }

    // Handle ALLOW decision
    return {
      answer: data.answer || "No answer provided",
      sources: data.sources || [],
      metadata: {
        decision: data.decision,
        reason: data.reason,
        ...data.metadata,
      },
    };
  } catch (error) {
    console.error("Error querying RAG:", error);
    throw new Error(`Failed to get response: ${error.message}`);
  }
}

/**
 * Get chat history (if backend supports it)
 * @returns {Promise<Array>} - Array of chat messages
 */
export async function getChatHistory() {
  try {
    // TODO: Implement if your backend has a chat history endpoint
    const response = await fetch(`${API_BASE_URL}/chat/history`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        // TODO: Add authentication headers if needed
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.history || [];
  } catch (error) {
    console.error("Error fetching chat history:", error);
    return [];
  }
}

/**
 * Clear chat history (if backend supports it)
 * @returns {Promise<boolean>} - Success status
 */
export async function clearChatHistory() {
  try {
    // TODO: Implement if your backend has a clear history endpoint
    const response = await fetch(`${API_BASE_URL}/chat/clear`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        // TODO: Add authentication headers if needed
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error("Error clearing chat history:", error);
    return false;
  }
}

export default {
  queryRag,
  getChatHistory,
  clearChatHistory,
};
