import { useEffect, useRef, useState } from 'react';
import { API_WS_BASE_URL } from '../../../common/core/config';
import type { WebSocketMessage } from '../../../common/core/types';

export function useWebSocket(authToken: string | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = () => {
    if (!authToken || wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(`${API_WS_BASE_URL}/chat/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        
        // Send ping to authenticate
        ws.send(JSON.stringify({
          type: 'ping',
          credentials: {
            scheme: 'Bearer',
            credentials: authToken
          },
          data: {}
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage<any> = JSON.parse(event.data);
          console.log('WebSocket message received:', message);
          
          // Handle different message types
          if (message.type === 'newMessage') {
            setMessages(prev => [...prev, message.data]);
          } else if (message.type === 'messageEdited') {
            setMessages(prev => prev.map(msg => 
              msg.id === message.data.id ? { ...msg, ...message.data } : msg
            ));
          } else if (message.type === 'messageDeleted') {
            setMessages(prev => prev.filter(msg => msg.id !== message.data.message_id));
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        
        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  };

  const sendMessage = (content: string, replyToId?: number) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(JSON.stringify({
      type: 'sendMessage',
      credentials: {
        scheme: 'Bearer',
        credentials: authToken
      },
      data: {
        content,
        reply_to_id: replyToId || null
      }
    }));
  };

  useEffect(() => {
    if (authToken) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [authToken]);

  return {
    isConnected,
    messages,
    sendMessage,
    connect,
    disconnect
  };
}
