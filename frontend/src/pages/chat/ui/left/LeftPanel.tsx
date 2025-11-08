import { useAppState } from "@/pages/chat/state";
import { useState } from "react";
import { SettingsDialog } from "./settings/SettingsDialog";
import { UsernameSearch } from "./UsernameSearch";
import { UnifiedChatsList } from "./UnifiedChatsList";
import { ChatHeader } from "./ChatHeader";
import { MaterialBottomAppBar, MaterialFab, MaterialIconButton } from "@/utils/material";
import styles from "@/pages/chat/css/left-panel.module.scss";

function BottomAppBar() {
    const [settingsOpen, onSettingsOpenChange] = useState(false);
    const { logout } = useAppState();

    return (
        <>
            <MaterialBottomAppBar>
                <MaterialIconButton icon="settings--filled" id="settings-open" onClick={() => onSettingsOpenChange(true)} />
                <div style={{ flexGrow: 1 }} />
                <MaterialIconButton
                    icon="logout--filled"
                    id="logout-btn"
                    onClick={logout}
                    title="Выйти" />
                <MaterialFab icon="edit--filled" />
            </MaterialBottomAppBar>
            <SettingsDialog isOpen={settingsOpen} onOpenChange={onSettingsOpenChange} />
        </>
    );
}

export function LeftPanel() {
    return (
        <div className={styles.chatList}>
            <ChatHeader />
            <div className={styles.searchContainer}>
                <UsernameSearch />
            </div>
            <UnifiedChatsList />
            <BottomAppBar />
        </div>
    );
}
