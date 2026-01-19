import { useState, useCallback } from "react";
import { queryRag } from "@/services/ragService";

/**
 * Custom hook for managing RAG chat functionality
 * Handles message state, API calls, and error handling
 */
export function useRagChat() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Send a query to the RAG system
   * @param {string} question - The user's question
   */
  const sendQuery = useCallback(async (question) => {
    if (!question.trim()) return;

    // Add user message to chat
    const userMessage = {
      role: "user",
      content: question,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      // Call the RAG API
      // TODO: This connects to your backend - make sure the endpoint is correct
      const response = await queryRag(question);

      // Add assistant message to chat
      const assistantMessage = {
        role: "assistant",
        content: response.answer,
        timestamp: new Date().toISOString(),
        metadata: {
          sources: response.sources?.length || 0,
          ...response.metadata,
        },
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err.message || "Failed to get response");

      // Add error message to chat
      const errorMessage = {
        role: "assistant",
        content: `I encountered an error: ${err.message}. Please check your backend connection.`,
        timestamp: new Date().toISOString(),
        isError: true,
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Clear all messages from the chat
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  /**
   * Retry the last failed query
   */
  const retryLastQuery = useCallback(() => {
    const lastUserMessage = [...messages]
      .reverse()
      .find((msg) => msg.role === "user");

    if (lastUserMessage) {
      // Remove the last error message if exists
      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg.isError) {
          return prev.slice(0, -1);
        }
        return prev;
      });

      sendQuery(lastUserMessage.content);
    }
  }, [messages, sendQuery]);

  return {
    messages,
    isLoading,
    error,
    sendQuery,
    clearMessages,
    retryLastQuery,
  };
}
