import { create } from "zustand";
import type { Message, User, UserProfile, WebSocketMessage } from "../core/types";
import { request } from "../websocket";

type Page = "login" | "register" | "chat"

interface ChatState {
    messages: Message[];
    currentChat: string;
    activeTab: "chats" | "channels" | "contacts" | "dms";
    dmUsers: User[];
    activeDm: { userId: number; username: string; publicKey: string | null } | null;
}

interface UserState {
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
    
    // User state
    user: UserState;
    setUser: (token: string, user: User) => void;
    logout: () => void;
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
        activeDm: null
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
    logout: () => set(() => ({
        user: {
            currentUser: null,
            authToken: null
        },
        currentPage: "login"
    }))
}));