import { useAppState } from "../state";

/**
 * Hook for DM-related functionality
 */
export function useDM() {
    const {
        chat,
        switchToDM,
        setActiveDm,
        loadUsers,
    } = useAppState();

    return {
        chat,
        switchToDM,
        setActiveDm,
        loadUsers,
        dmUsers: chat.dmUsers,
        isLoadingUsers: chat.isLoadingUsers,
    };
}
