import { PRODUCT_NAME } from "../../../core/config";
import { useAppState } from "../../state";
import defaultAvatar from "../../../resources/images/default-avatar.png";
import { useState, type FormEvent } from "react";
import { ProfileDialog } from "../profile/ProfileDialog";
import { SettingsDialog } from "../settings/SettingsDialog";
import { DMUsersList } from "./DMUsersList";
import type { Tabs } from "mdui";
import type { ChatTabs } from "../../state";

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


function ChatTabs() {
    const { chat, switchToTab, switchToPublicChat } = useAppState();
    const { activeTab } = chat;

    const handleChatClick = async (chatName: string) => {
        await switchToPublicChat(chatName);
    };

    const handleTabChange = async (e: FormEvent<Tabs>) => {
        const tab = (e.target as Tabs).value as ChatTabs;
        await switchToTab(tab);
    };

    return (
        <div className="chat-tabs">
            <mdui-tabs value={activeTab} full-width onChange={handleTabChange}>
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
                    <DMUsersList />
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
    const { chat } = useAppState();
    const isMobile = chat.isMobileView;
    const showChatList = chat.showChatList;

    return (
        <div className={`chat-list ${isMobile && !showChatList ? "hidden" : ""}`} id="chat-list">
            <ChatHeader />
            <ChatTabs />
            <BottomAppBar />
        </div>
    );
}
