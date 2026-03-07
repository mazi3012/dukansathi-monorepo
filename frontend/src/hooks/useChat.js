import { useContext } from 'react';
import { ChatContext } from '../contexts/ChatContext';

/**
 * Hook to consume the global ChatContext.
 * Provides access to chat messages, WebSocket connection, 
 * audio controls, and AI state across the entire application.
 */
export const useChat = () => {
    const context = useContext(ChatContext);

    if (!context) {
        throw new Error('useChat must be used within a ChatProvider');
    }

    return context;
};
