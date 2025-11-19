import type { StateCreator } from "zustand";
import type { Message, User } from "@/core/types";
import { MessagePanel } from "../ui/right/panels/MessagePanel";
import { PublicChatPanel } from "../ui/right/panels/PublicChatPanel";
import { DMPanel, type DMPanelData } from "../ui/right/panels/DMPanel";
import type { ChatState, ChatTabs, ActiveDM } from "./types";
import { useUserStore } from "@/state/user";

export interface ChatStateSlice {
    chat: ChatState;
    addMessage: (message: Message) => void;
    updateMessage: (messageId: number, updatedMessage: Partial<Message>) => void;
    removeMessage: (messageId: number) => void;
    setCurrentChat: (chat: string) => void;
    setActiveTab: (tab: ChatTabs) => void;
    setDmUsers: (users: User[]) => void;
    setActiveDm: (dm: ActiveDM | null) => void;
    clearMessages: () => void;
    setActivePanel: (panel: MessagePanel | null) => void;
    setPendingPanel: (panel: MessagePanel | null) => void;
    applyPendingPanel: () => void;
    switchToPublicChat: (chatName: string) => Promise<void>;
    switchToDM: (dmData: DMPanelData) => Promise<void>;
}

export const createChatState: StateCreator<
    ChatStateSlice & { user: { authToken: string | null } },
    [],
    [],
    ChatStateSlice
> = (set, get) => ({
    chat: {
        messages: [],
        currentChat: "Общий чат",
        activeTab: "chats",
        dmUsers: [],
        activeDm: null,
        isSwitching: false,
        setIsSwitching: (value: boolean) => set((state) => ({
            chat: {
                ...state.chat,
                isSwitching: value
            }
        })),
        activePanel: null,
        publicChatPanel: null,
        dmPanel: null,
        pendingPanel: null,
        profileDialog: null,
        call: {
            isActive: false,
            status: "ended",
            startTime: null,
            isMuted: false,
            remoteUserId: null,
            remoteUsername: null,
            isInitiator: false,
            isMinimized: false,
            sessionKeyHash: null,
            encryptionEmojis: [],
            isVideoEnabled: false,
            isRemoteVideoEnabled: false,
            isSharingScreen: false,
            isRemoteScreenSharing: false
        },
        onlineStatuses: new Map(),
        typingUsers: new Map(),
        dmTypingUsers: new Map()
    },
    addMessage: (message: Message) => set((state) => {
        const messageExists = state.chat.messages.some(msg => msg.id === message.id);
        if (messageExists) {
            return state;
        }

        return {
            chat: {
                ...state.chat,
                messages: [...state.chat.messages, message]
            }
        };
    }),
    updateMessage: (messageId: number, updatedMessage: Partial<Message>) => set((state) => ({
        chat: {
            ...state.chat,
            messages: state.chat.messages.map(msg =>
                msg.id === messageId ? { ...msg, ...updatedMessage } : msg
            )
        }
    })),
    removeMessage: (messageId: number) => set((state) => ({
        chat: {
            ...state.chat,
            messages: state.chat.messages.filter(msg => msg.id !== messageId)
        }
    })),
    clearMessages: () => set((state) => ({
        chat: {
            ...state.chat,
            messages: []
        }
    })),
    setCurrentChat: (chat: string) => set((state) => ({
        chat: {
            ...state.chat,
            currentChat: chat
        }
    })),
    setActiveTab: (tab: ChatTabs) => set((state) => ({
        chat: {
            ...state.chat,
            activeTab: tab
        }
    })),
    setDmUsers: (users: User[]) => set((state) => ({
        chat: {
            ...state.chat,
            dmUsers: users
        }
    })),
    setActiveDm: (dm: ActiveDM | null) => set((state) => ({
        chat: {
            ...state.chat,
            activeDm: dm
        }
    })),
    setActivePanel: (panel: MessagePanel | null) => {
        const state = get();
        if (state.chat.activePanel && state.chat.activePanel !== panel) {
            state.chat.activePanel.deactivate();
        }
        return set((state) => ({
            chat: {
                ...state.chat,
                activePanel: panel
            }
        }));
    },
    setPendingPanel: (panel: MessagePanel | null) => set((state) => ({
        chat: {
            ...state.chat,
            pendingPanel: panel
        }
    })),
    applyPendingPanel: () => {
        const state = get();
        if (state.chat.activePanel) {
            state.chat.activePanel.deactivate();
        }
        return set((state) => ({
            chat: {
                ...state.chat,
                activePanel: state.chat.pendingPanel || state.chat.activePanel,
                publicChatPanel: (state.chat.pendingPanel instanceof PublicChatPanel)
                    ? (state.chat.pendingPanel as PublicChatPanel)
                    : state.chat.publicChatPanel,
                dmPanel: (state.chat.pendingPanel instanceof DMPanel)
                    ? (state.chat.pendingPanel as DMPanel)
                    : state.chat.dmPanel,
                currentChat: state.chat.pendingPanel ? state.chat.pendingPanel.getState().title || state.chat.currentChat : state.chat.currentChat,
                pendingPanel: null
            }
        }));
    },
    switchToPublicChat: async (chatName: string) => {
        const { chat } = get();
        const { user } = useUserStore();

        if (!user.authToken) return;

        chat.setIsSwitching(true);

        let publicChatPanel = chat.publicChatPanel;
        if (!publicChatPanel) {
            publicChatPanel = new PublicChatPanel(chatName, user);
        } else {
            publicChatPanel.setChatName(chatName);
            publicChatPanel.setAuthToken(user.authToken);
            publicChatPanel.clearMessages();
        }

        await publicChatPanel.activate();

        set((state) => ({
            chat: {
                ...state.chat,
                pendingPanel: publicChatPanel,
                activeTab: "chats"
            }
        }));
    },
    switchToDM: async (dmData: DMPanelData) => {
        const { chat } = get();
        const { user } = useUserStore();

        if (!user.authToken) return;

        chat.setIsSwitching(true);

        let dmPanel = chat.dmPanel;
        if (!dmPanel) {
            dmPanel = new DMPanel(user);
        } else {
            dmPanel.setAuthToken(user.authToken);
            dmPanel.clearMessages();
        }

        dmPanel.setDMData(dmData);

        await dmPanel.activate();

        set((state) => ({
            chat: {
                ...state.chat,
                pendingPanel: dmPanel,
                activeDm: {
                    userId: dmData.userId,
                    username: dmData.username,
                    publicKey: dmData.publicKey
                },
                activeTab: "chats"
            }
        }));
    }
});

