import { useAppState } from "@/pages/chat/state";

export function ChatTabs() {
    const { chat, setActiveTab, switchToPublicChat } = useAppState();

    return (
        <div className="chat-tabs">
            <mdui-tabs value={chat.activeTab} full-width onChange={(e: any) => setActiveTab(e.detail.value)}>
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
                            onClick={async () => await switchToPublicChat("Общий чат")}
                            style={{ cursor: "pointer" }}
                        >
                            <img src="./src/resources/images/default-avatar.png" alt="" slot="icon" />
                        </mdui-list-item>
                        <mdui-list-item 
                            headline="Общий чат 2" 
                            description="Вы: Последнее сообщение" 
                            id="chat-list-chat-2"
                            onClick={async () => await switchToPublicChat("Общий чат 2")}
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
