import { useAppState, type ChatTabs } from "@/pages/chat/state";
import { UnifiedChatsList } from "./UnifiedChatsList";
import type { FormEvent } from "react";
import type { Tabs } from "mdui/components/tabs";

export function ChatTabs() {
    const { chat, setActiveTab } = useAppState();

    function handleChange(e: FormEvent<Tabs> & CustomEvent<{ value: string }>) {
        setActiveTab(e.detail.value as ChatTabs);
    }

    return (
        <div className="chat-tabs">
            <mdui-tabs 
                value={chat.activeTab} 
                full-width
                onChange={handleChange}>
                <mdui-tab value="chats">
                    Чаты
                </mdui-tab>
                <mdui-tab value="channels">
                    Каналы
                </mdui-tab>
                <mdui-tab value="contacts">
                    Контакты
                </mdui-tab>

                <mdui-tab-panel slot="panel" value="chats">
                    <UnifiedChatsList />
                </mdui-tab-panel>
                <mdui-tab-panel slot="panel" value="channels">Скоро будет...</mdui-tab-panel>
                <mdui-tab-panel slot="panel" value="contacts">Скоро будет...</mdui-tab-panel>
            </mdui-tabs>
        </div>
    );
}
