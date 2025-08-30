import { PRODUCT_NAME } from "../../../core/config";
import { useDialog } from "../../contexts/DialogContext";
import { useChat } from "../../hooks/useChat";
import defaultAvatar from "../../../resources/images/default-avatar.png";
import { useState } from "react";
import { ProfileDialog } from "../profile/ProfileDialog";
import { SettingsDialog } from "../settings/SettingsDialog";

function BottomAppBar() {
    const [settingsOpen, onSettingsOpenChange] = useState(false);

    return (
        <>
            <mdui-bottom-app-bar>
                <mdui-button-icon icon="settings--filled" id="settings-open" onClick={() => onSettingsOpenChange(true)}></mdui-button-icon>
                <mdui-button-icon icon="group_add--filled"></mdui-button-icon>
                <div style={{ flexGrow: 1 }}></div>
                <mdui-fab icon="edit--filled"></mdui-fab>
            </mdui-bottom-app-bar>
            <SettingsDialog isOpen={settingsOpen} onOpenChange={onSettingsOpenChange} />
        </>
    );
}


function ChatTabs() {
    const { activeTab, setActiveTab, setCurrentChat } = useChat();

    const handleChatClick = (chatName: string) => {
        setCurrentChat(chatName);
    };

    return (
        <div className="chat-tabs">
            <mdui-tabs value={activeTab} full-width onChange={(e: Event & any) => setActiveTab(e.value)}>
                <mdui-tab value="chats">Чаты</mdui-tab>
                <mdui-tab value="channels">Каналы</mdui-tab>
                <mdui-tab value="contacts">Контакты</mdui-tab>
                <mdui-tab value="dms">ЛС</mdui-tab>

                <mdui-tab-panel slot="panel" value="chats">
                    <mdui-list>
                        <mdui-list-item 
                            headline="Общий чат" 
                            description="Вы: Последнее сообщение" 
                            id="chat-list-chat-1"
                            onClick={() => handleChatClick("Общий чат")}
                            style={{ cursor: "pointer" }}
                        >
                            <img src={defaultAvatar} alt="" slot="icon" />
                        </mdui-list-item>
                        <mdui-list-item 
                            headline="Общий чат 2" 
                            description="Вы: Последнее сообщение" 
                            id="chat-list-chat-2"
                            onClick={() => handleChatClick("Общий чат 2")}
                            style={{ cursor: "pointer" }}
                        >
                            <img src={defaultAvatar} alt="" slot="icon" />
                        </mdui-list-item>
                    </mdui-list>
                </mdui-tab-panel>
                <mdui-tab-panel slot="panel" value="channels">Скоро будет...</mdui-tab-panel>
                <mdui-tab-panel slot="panel" value="contacts">Скоро будет...</mdui-tab-panel>
                <mdui-tab-panel slot="panel" value="dms">
                    <mdui-list id="dm-users"></mdui-list>
                </mdui-tab-panel>
            </mdui-tabs>
        </div>
    );
}


function ChatHeader() {
    const [isProfileOpen, setProfileOpen] = useState(false);

    return (
        <header className="chat-header-left">
            <div className="product-name">{PRODUCT_NAME}</div>
            <div className="profile">
                <a href="#" id="profile-open" onClick={() => setProfileOpen(true)}>
                    <img src={defaultAvatar} alt="" id="preview1" />
                </a>
            </div>
            <ProfileDialog isOpen={isProfileOpen} onOpenChange={setProfileOpen} />
        </header>
    );
}

export function LeftPanel() {
    return (
        <div className="chat-list" id="chat-list">
            <ChatHeader />
            <ChatTabs />
            <BottomAppBar />
        </div>
    );
}
