import { useState, useCallback, useEffect } from "react";
import { queryRag } from "@/services/ragService";

/**
 * Custom hook for managing RAG chat functionality
 * Handles message state, API calls, error handling, and persistence
 */
export function useRagChat() {
  // Initialize messages from localStorage
  const [messages, setMessages] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('ragChatHistory');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Error loading chat history from localStorage:', error);
      return [];
    }
  });

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('ragChatHistory', JSON.stringify(messages));
    } catch (error) {
      console.error('Error saving chat history to localStorage:', error);
    }
  }, [messages]);
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
          sources: response.sources || [],
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
   * Clear all messages from the chat and localStorage
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ragChatHistory');
    }
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
