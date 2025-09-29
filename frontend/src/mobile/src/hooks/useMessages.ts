import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../config';
import { getAuthHeaders } from '@common/auth/api';
import type { Message } from '@common/core/types';

export function useMessages(authToken: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    if (!authToken) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/get_messages`, {
        headers: getAuthHeaders(authToken)
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      } else {
        setError('Failed to load messages');
      }
    } catch (err) {
      setError('Network error');
      console.error('Error loading messages:', err);
    } finally {
      setIsLoading(false);
    }
  }, [authToken]);

  const addMessage = useCallback((message: Message) => {
    setMessages(prev => {
      // Check if message already exists to prevent duplicates
      const exists = prev.some(msg => msg.id === message.id);
      if (exists) return prev;
      return [...prev, message];
    });
  }, []);

  const updateMessage = useCallback((messageId: number, updates: Partial<Message>) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, ...updates } : msg
    ));
  }, []);

  const removeMessage = useCallback((messageId: number) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  useEffect(() => {
    if (authToken) {
      loadMessages();
    } else {
      clearMessages();
    }
  }, [authToken, loadMessages, clearMessages]);

  return {
    messages,
    isLoading,
    error,
    addMessage,
    updateMessage,
    removeMessage,
    clearMessages,
    loadMessages
  };
}
