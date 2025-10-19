import { useAppState } from "@/pages/chat/state";
import { useState } from "react";
import { SettingsDialog } from "./settings/SettingsDialog";
import { UsernameSearch } from "./UsernameSearch";
import { ChatTabs } from "./ChatTabs";
import { ChatHeader } from "./ChatHeader";

function BottomAppBar() {
    const [settingsOpen, onSettingsOpenChange] = useState(false);
    const { logout } = useAppState();

    const handleLogout = () => {
        logout();
    };

    return (
        <>
            <mdui-bottom-app-bar>
                <mdui-button-icon icon="settings--filled" id="settings-open" onClick={() => onSettingsOpenChange(true)}></mdui-button-icon>
                <mdui-button-icon icon="group_add--filled"></mdui-button-icon>
                <div style={{ flexGrow: 1 }}></div>
                <mdui-button-icon
                    icon="logout--filled"
                    id="logout-btn"
                    onClick={handleLogout}
                    title="Выйти"
                ></mdui-button-icon>
                <mdui-fab icon="edit--filled"></mdui-fab>
            </mdui-bottom-app-bar>
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
