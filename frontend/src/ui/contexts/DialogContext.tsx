import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

interface DialogContextType {
    isProfileOpen: boolean;
    isSettingsOpen: boolean;
    openProfile: () => void;
    closeProfile: () => void;
    openSettings: () => void;
    closeSettings: () => void;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export function DialogProvider({ children }: { children: ReactNode }) {
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const openProfile = () => setIsProfileOpen(true);
    const closeProfile = () => setIsProfileOpen(false);
    const openSettings = () => setIsSettingsOpen(true);
    const closeSettings = () => setIsSettingsOpen(false);

    return (
        <DialogContext.Provider value={{
            isProfileOpen,
            isSettingsOpen,
            openProfile,
            closeProfile,
            openSettings,
            closeSettings
        }}>
            {children}
        </DialogContext.Provider>
    );
}

export function useDialog() {
    const context = useContext(DialogContext);
    if (context === undefined) {
        throw new Error("useDialog must be used within a DialogProvider");
    }
    return context;
}
