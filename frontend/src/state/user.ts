import { create } from "zustand";
import type { User } from "@/core/types";
import api from "@/core/api";
import { API_BASE_URL } from "@/core/config";
import { initialize, subscribe, startElectronReceiver, isSupported } from "@/core/push-notifications/push-notifications";
import { isElectron } from "@/core/electron/electron";
import { onlineStatusManager } from "@/core/onlineStatusManager";
import { typingManager } from "@/core/typingManager";
import type { UserState } from "./types";
import { clearSessionSync } from "@/utils/crypto/sessionSync";
import { clearMessagePlaintextSync } from "@/utils/crypto/messagePlaintextSync";

interface UserStore {
    user: UserState;
    setUser: (token: string, user: User) => void;
    logout: () => void;
    restoreFromStorage: () => Promise<void>;
    setSuspended: (reason: string) => void;
}

export const useUserStore = create<UserStore>((set) => ({
    user: {
        currentUser: null,
        authToken: null,
        isSuspended: false,
        suspensionReason: null
    },
    setUser: (token: string, user: User) => {
        set({
            user: {
                currentUser: user,
                authToken: token,
                isSuspended: user.suspended || false,
                suspensionReason: user.suspension_reason || null
            }
        });

        onlineStatusManager.setAuthToken(token);
        typingManager.setAuthToken(token);

        try {
            localStorage.setItem('authToken', token);
            localStorage.setItem('currentUser', JSON.stringify(user));
        } catch (error) {
            console.error('Failed to store credentials in localStorage:', error);
        }

        // Ping will be sent automatically on WebSocket reconnect
        // No need to send here to avoid duplicate pings
    },
    logout: () => {
        try {
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            sessionStorage.removeItem('sessionPassword');
        } catch (error) {
            console.error('Failed to clear storage:', error);
        }

        onlineStatusManager.setAuthToken(null);
        typingManager.setAuthToken(null);
        onlineStatusManager.cleanup();
        typingManager.cleanup();
        
        // Clear session sync
        clearSessionSync();
        clearMessagePlaintextSync();

        set({
            user: {
                currentUser: null,
                authToken: null,
                isSuspended: false,
                suspensionReason: null
            }
        });
    },
    restoreFromStorage: async () => {
        try {
            const token = localStorage.getItem('authToken');

            if (token) {
                const fullResponse = await fetch(`${API_BASE_URL}/user/profile`, {
                    headers: api.user.auth.getAuthHeaders(token, true)
                });
                if (fullResponse.ok) {
                    const user: User = await fullResponse.json();
                    api.user.auth.restoreKeys();

                    if (user.suspended) {
                        set({
                            user: {
                                currentUser: user,
                                authToken: token,
                                isSuspended: true,
                                suspensionReason: user.suspension_reason || null
                            }
                        });
                        return;
                    }

                    set({
                        user: {
                            currentUser: user,
                            authToken: token,
                            isSuspended: false,
                            suspensionReason: null
                        }
                    });

                    onlineStatusManager.setAuthToken(token);
                    typingManager.setAuthToken(token);

                    // Initialize Signal Protocol after restoring user (non-blocking)
                    // Note: We can't restore sessions without password, but we can initialize Signal Protocol
                    if (user.id) {
                        (async () => {
                            try {
                                const { SignalProtocolService } = await import("@/utils/crypto/signalProtocol");
                                const { uploadAllPreKeys } = await import("@/core/api/crypto/prekeys");
                                const { getStoredSessionKey } = await import("@/utils/crypto/sessionKeyStorage");
                                const { restoreSessionsFromServer } = await import("@/utils/crypto/sessionSync");
                                
                                console.log("[RestoreFromStorage] Starting Signal Protocol setup...");
                                
                                const signalService = new SignalProtocolService(user.id.toString());
                                await signalService.initialize();
                                console.log("[RestoreFromStorage] Signal Protocol initialized");
                                
                                // Check if we have a stored session key (derived from password)
                                const storedKey = getStoredSessionKey(user.id.toString());
                                if (storedKey) {
                                    console.log("[RestoreFromStorage] Stored session key found, restoring sessions from server...");
                                    // We can restore sessions using the stored key (password not needed)
                                    try {
                                        await restoreSessionsFromServer(user.id.toString(), null, token);
                                        console.log("[RestoreFromStorage] Sessions restored from server using stored key");
                                    } catch (error) {
                                        console.error("[RestoreFromStorage] Failed to restore sessions:", error);
                                    }
                                } else {
                                    console.warn("[RestoreFromStorage] No stored session key - user needs to log in to derive key");
                                }
                                
                                // Re-upload prekeys to ensure they are fresh
                                try {
                                    const baseBundle = await signalService.getBaseBundle();
                                    const prekeys = await signalService.getAllPreKeys();
                                    await uploadAllPreKeys(baseBundle, prekeys, token);
                                    console.log(`[RestoreFromStorage] Uploaded ${prekeys.length} prekeys to server`);
                                } catch (error) {
                                    console.error("[RestoreFromStorage] Failed to upload prekeys:", error);
                                }
                            } catch (e) {
                                console.error("[RestoreFromStorage] Signal Protocol setup failed:", e);
                            }
                        })();
                    }

                    // Ping will be sent automatically on WebSocket reconnect
                    // No need to send here to avoid duplicate pings

                    try {
                        if (isSupported()) {
                            const initialized = await initialize();
                            if (initialized) {
                                await subscribe(token);

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
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
        }
    },
    setSuspended: (reason: string) => set((state) => ({
        user: {
            ...state.user,
            isSuspended: true,
            suspensionReason: reason
        }
    }))
}));
