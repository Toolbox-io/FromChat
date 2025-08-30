import { PRODUCT_NAME } from "../../../core/config";
import { useDialog } from "../../contexts/DialogContext";
import { useChat } from "../../hooks/useChat";

function BottomAppBar() {
    const { openSettings } = useDialog();

    const handleSettingsClick = () => {
        openSettings();
    };

    return (
        <mdui-bottom-app-bar>
            <mdui-button-icon icon="settings--filled" id="settings-open" onClick={handleSettingsClick}></mdui-button-icon>
            <mdui-button-icon icon="group_add--filled"></mdui-button-icon>
            <div style={{ flexGrow: 1 }}></div>
            <mdui-fab icon="edit--filled"></mdui-fab>
        </mdui-bottom-app-bar>
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
                <mdui-tab value="chats">
                    Чаты
                </mdui-tab>
                <mdui-tab value="channels">
                    Каналы
                </mdui-tab>
                <mdui-tab value="contacts">
                    Контакты
                </mdui-tab>
                <mdui-tab value="dms">
                    ЛС
                </mdui-tab>

                <mdui-tab-panel slot="panel" value="chats">
                    <mdui-list>
                        <mdui-list-item 
                            headline="Общий чат" 
                            description="Вы: Последнее сообщение" 
                            id="chat-list-chat-1"
                            onClick={() => handleChatClick("Общий чат")}
                            style={{ cursor: "pointer" }}
                        >
                            <img src="./src/resources/images/default-avatar.png" alt="" slot="icon" />
                        </mdui-list-item>
                        <mdui-list-item 
                            headline="Общий чат 2" 
                            description="Вы: Последнее сообщение" 
                            id="chat-list-chat-2"
                            onClick={() => handleChatClick("Общий чат 2")}
                            style={{ cursor: "pointer" }}
                        >
                            <img src="./src/resources/images/default-avatar.png" alt="" slot="icon" />
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
    const { openProfile } = useDialog();

    const handleProfileClick = () => {
        openProfile();
    };

    return (
        <header className="chat-header-left">
            <div className="product-name">{PRODUCT_NAME}</div>
            <div className="profile">
                <a href="#" id="profile-open" onClick={handleProfileClick}>
                    <img src="./src/resources/images/default-avatar.png" alt="" id="preview1" />
                </a>
            </div>
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
