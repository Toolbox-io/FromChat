import { create } from "zustand";
import type { Message, User, WebSocketMessage } from "../core/types";
import { request } from "../core/websocket";
import { MessagePanel } from "./panels/MessagePanel";
import { PublicChatPanel } from "./panels/PublicChatPanel";
import { DMPanel, type DMPanelData } from "./panels/DMPanel";
import { getAuthHeaders } from "../auth/api";

type Page = "login" | "register" | "chat"
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
    isChatSwitching: boolean;
    activePanel: MessagePanel | null;
    publicChatPanel: PublicChatPanel | null;
    dmPanel: DMPanel | null;
}

export interface UserState {
    currentUser: User | null;
    authToken: string | null;
}

interface AppState {
    currentPage: Page;
    setCurrentPage: (page: Page) => void;
    
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
    setIsChatSwitching: (value: boolean) => void;
    setActivePanel: (panel: MessagePanel | null) => void;
    switchToPublicChat: (chatName: string) => Promise<void>;
    switchToDM: (dmData: DMPanelData) => Promise<void>;
    switchToTab: (tab: ChatTabs) => Promise<void>;
    
    // User state
    user: UserState;
    setUser: (token: string, user: User) => void;
    logout: () => void;
    restoreUserFromStorage: () => void;
}

export const useAppState = create<AppState>((set, get) => ({
    currentPage: "login", // default page
    setCurrentPage: (page: Page) => set({ currentPage: page }),
    
    // Chat state
    chat: {
        messages: [],
        currentChat: "Общий чат",
        activeTab: "chats",
        dmUsers: [],
        activeDm: null,
        isChatSwitching: false,
        activePanel: null,
        publicChatPanel: null,
        dmPanel: null
    },
    setIsChatSwitching: (value: boolean) => set((state) => ({
        chat: {
            ...state.chat,
            isChatSwitching: value
        }
    })),
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
            const payload: WebSocketMessage = {
                type: "ping",
                credentials: {
                    scheme: "Bearer",
                    credentials: token
                },
                data: {}
            }
    
            request(payload).then(() => {
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
            },
            currentPage: "login"
        }));
    },
    restoreUserFromStorage: async () => {
        try {
            const token = localStorage.getItem('authToken');
            
            if (token) {
                const user: User = await (await fetch("/api/user/profile", {
                    headers: getAuthHeaders(token)
                })).json();
                
                set(() => ({
                    user: {
                        currentUser: user,
                        authToken: token
                    },
                    currentPage: "chat"
                }));
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
    
    switchToPublicChat: async (chatName: string) => {
        const state = get();
        const { user, chat } = state;
        
        if (!user.authToken) return;
        
        // Start chat switching animation
        state.setIsChatSwitching(true);
        
        // Create or get public chat panel
        let publicChatPanel = chat.publicChatPanel;
        if (!publicChatPanel) {
            const callbacks = {
                onSendMessage: (_content: string) => {},
                onEditMessage: (_messageId: number, _content: string) => {},
                onDeleteMessage: (_messageId: number) => {},
                onReplyToMessage: (_messageId: number, _content: string) => {},
                onProfileClick: () => {}
            };
            
            publicChatPanel = new PublicChatPanel(
                chatName,
                user,
                callbacks,
                () => {} // State change handled by MessagePanelRenderer
            );
        } else {
            publicChatPanel.setChatName(chatName);
            publicChatPanel.setAuthToken(user.authToken);
        }
        
        // Wait for animation
        await new Promise(resolve => setTimeout(resolve, 250));
        
        // Activate panel
        await publicChatPanel.activate();
        
        // Update state
        set((state) => ({
            chat: {
                ...state.chat,
                activePanel: publicChatPanel,
                publicChatPanel: publicChatPanel,
                currentChat: chatName,
                activeTab: "chats"
            }
        }));
        
        // End animation
        state.setIsChatSwitching(false);
    },
    
    switchToDM: async (dmData: DMPanelData) => {
        const state = get();
        const { user, chat } = state;
        
        if (!user.authToken) return;
        
        // Start chat switching animation
        state.setIsChatSwitching(true);
        
        // Create or get DM panel
        let dmPanel = chat.dmPanel;
        if (!dmPanel) {
            const callbacks = {
                onSendMessage: (_content: string) => {},
                onEditMessage: (_messageId: number, _content: string) => {},
                onDeleteMessage: (_messageId: number) => {},
                onReplyToMessage: (_messageId: number, _content: string) => {},
                onProfileClick: () => {}
            };
            
            dmPanel = new DMPanel(
                user,
                callbacks,
                () => {} // State change handled by MessagePanelRenderer
            );
        } else {
            dmPanel.setAuthToken(user.authToken);
        }
        
        // Set DM data
        dmPanel.setDMData(dmData);
        
        // Wait for animation
        await new Promise(resolve => setTimeout(resolve, 250));
        
        // Activate panel
        await dmPanel.activate();
        
        // Update state
        set((state) => ({
            chat: {
                ...state.chat,
                activePanel: dmPanel,
                dmPanel: dmPanel,
                activeDm: {
                    userId: dmData.userId,
                    username: dmData.username,
                    publicKey: dmData.publicKey
                },
                activeTab: "dms"
            }
        }));
        
        // End animation
        state.setIsChatSwitching(false);
    },
    
    switchToTab: async (tab: ChatTabs) => {
        const state = get();
        state.setActiveTab(tab);
        
        if (tab === "chats") {
            await state.switchToPublicChat("Общий чат");
        } else if (tab === "dms") {
            // DM tab - no specific panel until user is selected
            state.setActivePanel(null);
        }
    }
}));