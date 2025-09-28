import { create } from "zustand";
import type { Message, User } from "../core/types";
import { request } from "../core/websocket";
import { MessagePanel } from "./panels/MessagePanel";
import { PublicChatPanel } from "./panels/PublicChatPanel";
import { DMPanel, type DMPanelData } from "./panels/DMPanel";
import { getAuthHeaders } from "../auth/api";
import { restoreKeys } from "../auth/crypto";
import { API_BASE_URL } from "../core/config";
import { initialize, subscribe, startElectronReceiver, isSupported } from "../utils/push-notifications";
import { isElectron } from "../electron/electron";

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
    isMobileView: boolean;
    showChatList: boolean;
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
    setIsMobileView: (isMobile: boolean) => void;
    setShowChatList: (show: boolean) => void;
    navigateBack: () => void;
    
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
        dmPanel: null,
        isMobileView: false,
        showChatList: true
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
            },
            currentPage: "login"
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
                        },
                        currentPage: "chat"
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
    
    switchToPublicChat: async (chatName: string) => {
        const state = get();
        const { user, chat } = state;
        
        if (!user.authToken) return;
        
        // Start chat switching animation
        state.setIsChatSwitching(true);
        
        // Create or get public chat panel
        let publicChatPanel = chat.publicChatPanel;
        if (!publicChatPanel) {
            publicChatPanel = new PublicChatPanel(chatName, user);
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
                activeTab: "chats",
                // On mobile, hide chat list when switching to a chat
                showChatList: state.chat.isMobileView ? false : state.chat.showChatList
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
            dmPanel = new DMPanel(user);
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
                activeTab: "dms",
                // On mobile, hide chat list when switching to a DM
                showChatList: state.chat.isMobileView ? false : state.chat.showChatList
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
    },
    
    setIsMobileView: (isMobile: boolean) => set((state) => ({
        chat: {
            ...state.chat,
            isMobileView: isMobile
        }
    })),
    
    setShowChatList: (show: boolean) => set((state) => ({
        chat: {
            ...state.chat,
            showChatList: show
        }
    })),
    
    navigateBack: () => {
        const state = get();
        if (state.chat.isMobileView && state.chat.activePanel) {
            // On mobile, navigate back to chat list
            state.setShowChatList(true);
            state.setActivePanel(null);
        }
    }
}));