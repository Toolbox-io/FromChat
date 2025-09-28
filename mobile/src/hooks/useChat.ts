import { useAppState } from "../state";

/**
 * Hook for chat-related functionality
 */
export function useChat() {
    const {
        chat,
        switchToPublicChat,
        switchToDM,
        switchToTab,
        setActiveTab,
        setActivePanel,
        clearMessages,
        setIsChatSwitching,
        setCurrentChat,
    } = useAppState();

    return {
        chat,
        switchToPublicChat,
        switchToDM,
        switchToTab,
        setActiveTab,
        setActivePanel,
        clearMessages,
        setIsChatSwitching,
        setCurrentChat,
        currentChat: chat.currentChat,
        activeTab: chat.activeTab,
        messages: chat.messages,
    };
}
