import { useAppState, type ChatTabs } from "@/pages/chat/state";
import { UnifiedChatsList } from "./UnifiedChatsList";
import { MaterialTab, MaterialTabPanel, MaterialTabs } from "@/utils/material";

export function ChatTabs() {
    const { chat, setActiveTab } = useAppState();

    return (
        <div className="chat-tabs">
            <MaterialTabs
                value={chat.activeTab}
                full-width
                onChange={(e) => setActiveTab(e.target.value as ChatTabs)}>
                <MaterialTab value="chats">
                    Чаты
                </MaterialTab>
                <MaterialTab value="channels">
                    Каналы
                </MaterialTab>
                <MaterialTab value="contacts">
                    Контакты
                </MaterialTab>

                <MaterialTabPanel slot="panel" value="chats">
                    <UnifiedChatsList />
                </MaterialTabPanel>
                <MaterialTabPanel slot="panel" value="channels">Скоро будет...</MaterialTabPanel>
                <MaterialTabPanel slot="panel" value="contacts">Скоро будет...</MaterialTabPanel>
            </MaterialTabs>
        </div>
    );
}
