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
        isChatSwitching: false,
        activePanel: null,
        publicChatPanel: null,
        dmPanel: null
    },
    setIsChatSwitching: (value: boolean) => {
        console.log("🎬 [DEBUG] setIsChatSwitching called with:", value);
        set((state) => ({
            chat: {
                ...state.chat,
                isChatSwitching: value
            }
        }));
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
    
    switchToPublicChat: async (chatName: string) => {
        console.log("🔄 [DEBUG] switchToPublicChat called with:", chatName);
        const state = get();
        const { user, chat } = state;
        
        if (!user.authToken) {
            console.log("❌ [DEBUG] No auth token, returning early");
            return;
        }
        
        console.log("🎬 [DEBUG] Starting chat switching animation for:", chatName);
        console.log("🎬 [DEBUG] Current isChatSwitching state:", chat.isChatSwitching);
        
        // Start chat switching animation
        state.setIsChatSwitching(true);
        
        // Create or get public chat panel
        let publicChatPanel = chat.publicChatPanel;
        if (!publicChatPanel) {
            console.log("🆕 [DEBUG] Creating new PublicChatPanel for:", chatName);
            publicChatPanel = new PublicChatPanel(chatName, user);
        } else {
            console.log("♻️ [DEBUG] Reusing existing PublicChatPanel, setting chat name to:", chatName);
            publicChatPanel.setChatName(chatName);
            publicChatPanel.setAuthToken(user.authToken);
        }
        
        console.log("⏳ [DEBUG] Waiting 250ms for animation...");
        // Wait for animation
        await new Promise(resolve => setTimeout(resolve, 250));
        
        console.log("🚀 [DEBUG] Activating panel...");
        // Activate panel
        await publicChatPanel.activate();
        
        console.log("📝 [DEBUG] Updating state with new panel and chat name");
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
        
        console.log("✅ [DEBUG] Ending chat switching animation");
        // End animation
        state.setIsChatSwitching(false);
    },
    
    switchToDM: async (dmData: DMPanelData) => {
        console.log("🔄 [DEBUG] switchToDM called with:", dmData);
        const state = get();
        const { user, chat } = state;
        
        if (!user.authToken) {
            console.log("❌ [DEBUG] No auth token, returning early");
            return;
        }
        
        console.log("🎬 [DEBUG] Starting DM switching animation for user:", dmData.username);
        console.log("🎬 [DEBUG] Current isChatSwitching state:", chat.isChatSwitching);
        
        // Start chat switching animation
        state.setIsChatSwitching(true);
        
        // Create or get DM panel
        let dmPanel = chat.dmPanel;
        if (!dmPanel) {
            console.log("🆕 [DEBUG] Creating new DMPanel for user:", dmData.username);
            dmPanel = new DMPanel(user);
        } else {
            console.log("♻️ [DEBUG] Reusing existing DMPanel, updating auth token");
            dmPanel.setAuthToken(user.authToken);
        }
        
        // Set DM data
        console.log("📝 [DEBUG] Setting DM data for user:", dmData.username);
        dmPanel.setDMData(dmData);
        
        console.log("⏳ [DEBUG] Waiting 250ms for animation...");
        // Wait for animation
        await new Promise(resolve => setTimeout(resolve, 250));
        
        console.log("🚀 [DEBUG] Activating DM panel...");
        // Activate panel
        await dmPanel.activate();
        
        console.log("📝 [DEBUG] Updating state with new DM panel");
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
        
        console.log("✅ [DEBUG] Ending DM switching animation");
        // End animation
        state.setIsChatSwitching(false);
    },
    
    switchToTab: async (tab: ChatTabs) => {
        console.log("🔄 [DEBUG] switchToTab called with:", tab);
        const state = get();
        console.log("📝 [DEBUG] Setting active tab to:", tab);
        state.setActiveTab(tab);
        
        if (tab === "chats") {
            console.log("💬 [DEBUG] Switching to chats tab, calling switchToPublicChat");
            await state.switchToPublicChat("Общий чат");
        } else if (tab === "dms") {
            console.log("💬 [DEBUG] Switching to DMs tab, clearing active panel");
            // DM tab - no specific panel until user is selected
            state.setActivePanel(null);
        }
    }
}));