import { useAppState } from "@/pages/chat/state";
import { useState } from "react";
import { SettingsDialog } from "./settings/SettingsDialog";
import { UsernameSearch } from "./UsernameSearch";
import { ChatTabs } from "./ChatTabs";
import { ChatHeader } from "./ChatHeader";
import { MaterialBottomAppBar, MaterialFab, MaterialIconButton } from "@/utils/material";

function BottomAppBar() {
    const [settingsOpen, onSettingsOpenChange] = useState(false);
    const { logout } = useAppState();

    return (
        <>
            <MaterialBottomAppBar>
                <MaterialIconButton icon="settings--filled" id="settings-open" onClick={() => onSettingsOpenChange(true)} />
                <MaterialIconButton icon="group_add--filled" />
                <div style={{ flexGrow: 1 }}></div>
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
        <div className="chat-list" id="chat-list">
            <ChatHeader />
            <div className="search-container">
                <UsernameSearch />
            </div>
            <ChatTabs />
            <BottomAppBar />
        </div>
    );
}
