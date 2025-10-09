import { create } from "zustand";
import type { Message, User } from "../../core/types";
import { request } from "../../core/websocket";
import { MessagePanel } from "./ui/right/panels/MessagePanel";
import { PublicChatPanel } from "./ui/right/panels/PublicChatPanel";
import { DMPanel, type DMPanelData } from "./ui/right/panels/DMPanel";
import { getAuthHeaders } from "../../core/api/authApi";
import { restoreKeys } from "../../core/api/authApi";
import { API_BASE_URL } from "../../core/config";
import { initialize, subscribe, startElectronReceiver, isSupported } from "../../core/push-notifications/push-notifications";
import { isElectron } from "../../core/electron/electron";

export type ChatTabs = "chats" | "channels" | "contacts" | "dms"

interface ActiveDM {
    userId: number; 
    username: string;
    publicKey: string | null
}

interface ChatState {
    messages: Message[];
    currentChat: string;
    activeTab: ChatTabs;
    dmUsers: User[];
    activeDm: ActiveDM | null;
    isSwitching: boolean;
    setIsSwitching: (value: boolean) => void;
    activePanel: MessagePanel | null;
    publicChatPanel: PublicChatPanel | null;
    dmPanel: DMPanel | null;
    pendingPanel?: MessagePanel | null;
}

export interface UserState {
    currentUser: User | null;
    authToken: string | null;
}

interface AppState {
    // Chat state
    chat: ChatState;
    addMessage: (message: Message) => void;
    updateMessage: (messageId: number, updatedMessage: Partial<Message>) => void;
    removeMessage: (messageId: number) => void;
    setCurrentChat: (chat: string) => void;
    setActiveTab: (tab: ChatState["activeTab"]) => void;
    setDmUsers: (users: User[]) => void;
    setActiveDm: (dm: ChatState["activeDm"]) => void;
    clearMessages: () => void;
    setActivePanel: (panel: MessagePanel | null) => void;
    setPendingPanel: (panel: MessagePanel | null) => void;
    applyPendingPanel: () => void;
    switchToPublicChat: (chatName: string) => Promise<void>;
    switchToDM: (dmData: DMPanelData) => Promise<void>;
    
    // User state
    user: UserState;
    setUser: (token: string, user: User) => void;
    logout: () => void;
    restoreUserFromStorage: () => Promise<void>;
}

export const useAppState = create<AppState>((set, get) => ({
    // Chat state
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
        pendingPanel: null
    },
    addMessage: (message: Message) => set((state) => {
        // Check if message already exists to prevent duplicates
        const messageExists = state.chat.messages.some(msg => msg.id === message.id);
        if (messageExists) {
            return state; // Return unchanged state if message already exists
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
    setActiveTab: (tab: ChatState["activeTab"]) => set((state) => ({
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
    setActiveDm: (dm: ChatState["activeDm"]) => set((state) => ({
        chat: {
            ...state.chat,
            activeDm: dm
        }
    })),
    
    // User state
    user: {
        currentUser: null,
        authToken: null
    },
    setUser: (token: string, user: User) => {
        set(() => ({
            user: {
                currentUser: user,
                authToken: token
            }
        }));

        // Store credentials in localStorage
        try {
            localStorage.setItem('authToken', token);
            localStorage.setItem('currentUser', JSON.stringify(user));
        } catch (error) {
            console.error('Failed to store credentials in localStorage:', error);
        }

        try {
            request({
                type: "ping",
                credentials: {
                    scheme: "Bearer",
                    credentials: token
                },
                data: {}
            }).then(() => {
                console.log("Ping succeeded")
            })
        } catch {}
    },
    logout: () => {
        // Clear localStorage
        try {
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
        } catch (error) {
            console.error('Failed to clear localStorage:', error);
        }

        set(() => ({
            user: {
                currentUser: null,
                authToken: null
            }
        }));
    },
    restoreUserFromStorage: async () => {
        try {
            const token = localStorage.getItem('authToken');
            
            if (token) {
                const response = await fetch(`${API_BASE_URL}/user/profile`, {
                    headers: getAuthHeaders(token)
                });

                if (response.ok) {
                    const user: User = await response.json();
                    restoreKeys();

                    set(() => ({
                        user: {
                            currentUser: user,
                            authToken: token
                        }
                    }));

                    try {
                        request({
                            type: "ping",
                            credentials: {
                                scheme: "Bearer",
                                credentials: token
                            },
                            data: {}
                        }).then(() => {
                            console.log("Ping succeeded")
                        })
                    } catch {}

                    // Initialize notifications after successful credential restoration
                    try {
                        if (isSupported()) {
                            const initialized = await initialize();
                            if (initialized) {
                                await subscribe(token);
                                
                                // For Electron, start the notification receiver
                                if (isElectron) {
                                    await startElectronReceiver();
                                }
                            }
                        }
                    } catch (e) {
                        console.error("Notification setup failed (restored):", e);
                    }
                } else {
                    throw new Error("Unable to authenticate");
                }
            }
        } catch (error) {
            console.error('Failed to restore user from localStorage:', error);
            // Clear invalid data
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
        }
    },
    
    // Panel management
    setActivePanel: (panel: MessagePanel | null) => set((state) => ({
        chat: {
            ...state.chat,
            activePanel: panel
        }
    })),
    // Stash a panel to be applied after switch-out animation ends
    setPendingPanel: (panel: MessagePanel | null) => set((state) => ({
        chat: {
            ...state.chat,
            pendingPanel: panel
        }
    })),
    // Apply pending panel atomically and update related fields
    applyPendingPanel: () => set((state) => ({
        chat: {
            ...state.chat,
            activePanel: state.chat.pendingPanel || state.chat.activePanel,
            // when switching to public chat, keep reference if type matches
            publicChatPanel: (state.chat.pendingPanel instanceof PublicChatPanel)
                ? (state.chat.pendingPanel as PublicChatPanel)
                : state.chat.publicChatPanel,
            dmPanel: (state.chat.pendingPanel instanceof DMPanel)
                ? (state.chat.pendingPanel as DMPanel)
                : state.chat.dmPanel,
            // update currentChat from panel title if available
            currentChat: state.chat.pendingPanel ? state.chat.pendingPanel.getState().title || state.chat.currentChat : state.chat.currentChat,
            pendingPanel: null
        }
    })),
    
    switchToPublicChat: async (chatName: string) => {
        const { user, chat } = get();
        
        if (!user.authToken) return;
        
        // Start chat switching animation
        chat.setIsSwitching(true);
        
        // Create or get public chat panel
        let publicChatPanel = chat.publicChatPanel;
        if (!publicChatPanel) {
            publicChatPanel = new PublicChatPanel(chatName, user);
        } else {
            publicChatPanel.setChatName(chatName);
            publicChatPanel.setAuthToken(user.authToken);
            // Reset messages for the new chat
            publicChatPanel.clearMessages();
        }
        
        // Activate panel
        await publicChatPanel.activate();
        
        // Defer panel swap until animation switch-out completes
        set((state) => ({
            chat: {
                ...state.chat,
                pendingPanel: publicChatPanel,
                activeTab: "chats"
            }
        }));
        
        // Let MessagePanelRenderer handle the animation timing completely
        // It will set isChatSwitching to false when the fadeInDown animation completes
    },
    
    switchToDM: async (dmData: DMPanelData) => {
        const { user, chat } = get();
        
        if (!user.authToken) return;
        
        // Start chat switching animation
        chat.setIsSwitching(true);
        
        // Create or get DM panel
        let dmPanel = chat.dmPanel;
        if (!dmPanel) {
            dmPanel = new DMPanel(user);
        } else {
            dmPanel.setAuthToken(user.authToken);
            // Reset messages for the new DM
            dmPanel.clearMessages();
        }
        
        // Set DM data
        dmPanel.setDMData(dmData);
        
        // Activate panel
        await dmPanel.activate();
        
        // Defer panel swap until animation switch-out completes
        set((state) => ({
            chat: {
                ...state.chat,
                pendingPanel: dmPanel,
                activeDm: {
                    userId: dmData.userId,
                    username: dmData.username,
                    publicKey: dmData.publicKey
                },
                activeTab: "dms"
            }
        }));
        
        // Let MessagePanelRenderer handle the animation timing completely
        // It will set isChatSwitching to false when the fadeInDown animation completes
    }
}));