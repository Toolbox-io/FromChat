import { useState, useEffect, useRef } from "react";
import { MessagePanel, type MessagePanelState } from "../../panels/MessagePanel";
import { ChatMessages } from "./ChatMessages";
import { ChatInputWrapper } from "./ChatInputWrapper";
import { setGlobalMessageHandler } from "../../../core/websocket";
import type { Message } from "../../../core/types";
import defaultAvatar from "../../../resources/images/default-avatar.png";

interface MessagePanelRendererProps {
    panel: MessagePanel | null;
    isChatSwitching: boolean;
}

export function MessagePanelRenderer({ panel, isChatSwitching }: MessagePanelRendererProps) {
    const [panelState, setPanelState] = useState<MessagePanelState | null>(null);
    const [switchIn, setSwitchIn] = useState(false);
    const [switchOut, setSwitchOut] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [replyTo, setReplyTo] = useState<Message | null>(null);
    const [replyToVisible, setReplyToVisible] = useState(Boolean(replyTo));
    const [editMessage, setEditMessage] = useState<Message | null>(null);
    const [editVisible, setEditVisible] = useState(Boolean(editMessage));
    const [pendingAction, setPendingAction] = useState<null | { type: "reply" | "edit"; message: Message }>(null);

    useEffect(() => {
        if (replyTo) {
            setReplyToVisible(true);
        }
    }, [replyTo]);

    useEffect(() => {
        if (editMessage) {
            setEditVisible(true);
        }
    }, [editMessage]);

    // Handle panel state changes
    useEffect(() => {
        if (panel) {
            setPanelState(panel.getState());
            
            // Set up state change listener
            const handleStateChange = (newState: MessagePanelState) => {
                setPanelState(newState);
            };
            
            // Store the handler for cleanup
            panel.onStateChange = handleStateChange;
            
            // Set up WebSocket message handler for this panel
            if (panel.handleWebSocketMessage) {
                setGlobalMessageHandler(panel.handleWebSocketMessage);
            }
        } else {
            setPanelState(null);
            // Clear global message handler when no panel is active
            setGlobalMessageHandler(null);
        }
        
        // Cleanup function
        return () => {
            if (panel && panel.onStateChange) {
                panel.onStateChange = null;
            }
        };
    }, [panel]);

    // Handle chat switching animation
    useEffect(() => {
        if (isChatSwitching) {
            setSwitchOut(true);
            setTimeout(() => {
                setSwitchOut(false);
                setSwitchIn(true);
                setTimeout(() => setSwitchIn(false), 200);
            }, 250);
        }
    }, [isChatSwitching]);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [panelState?.messages]);

    if (!panel || !panelState) {
        return (
            <div className="chat-container">
                <div className="chat-main" id="chat-inner">
                    <div className="chat-header">
                        <img src={defaultAvatar} alt="Avatar" className="chat-header-avatar" />
                        <div className="chat-header-info">
                            <div className="info-chat">
                                <h4 id="chat-name">Выбор чата</h4>
                                <p>
                                    <span className="online-status"></span>
                                    Выберите чат, чтобы начать переписку
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="chat-messages" id="chat-messages">
                        <div style={{ 
                            display: "flex", 
                            justifyContent: "center", 
                            alignItems: "center", 
                            height: "100%",
                            color: "var(--mdui-color-on-surface-variant)"
                        }}>
                            Выберите чат на боковой панели, чтобы начать переписку
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`chat-container ${switchIn ? "chat-switch-in" : ""} ${switchOut ? "chat-switch-out" : ""}`}>
            <div className="chat-main" id="chat-inner">
                <div className="chat-header">
                    <img 
                        src={panelState.profilePicture || defaultAvatar} 
                        alt="Avatar" 
                        className="chat-header-avatar"
                        onClick={panel.handleProfileClick}
                        style={{ cursor: "pointer" }}
                    />
                    <div className="chat-header-info">
                        <div className="info-chat">
                            <h4 id="chat-name">{panelState.title}</h4>
                            <p>
                                <span className={`online-status ${panelState.online ? "online" : "offline"}`}></span>
                                {panelState.online ? "Online" : "Offline"}
                                {panelState.isTyping && " • Typing..."}
                            </p>
                        </div>
                    </div>
                </div>

                {panelState.isLoading ? (
                    <div className="chat-messages" id="chat-messages">
                        <div style={{ 
                            display: "flex", 
                            justifyContent: "center", 
                            alignItems: "center", 
                            height: "100%",
                            color: "var(--mdui-color-on-surface-variant)"
                        }}>
                            Загрузка сообщений...
                        </div>
                    </div>
                ): (
                    <ChatMessages 
                        messages={panelState.messages} 
                        isDm={panel.isDm()} 
                        onReplySelect={(message) => {
                            if (editMessage || editVisible) {
                                setPendingAction({ type: "reply", message: message });
                                setEditVisible(false); // onCloseEdit will apply pending
                            } else {
                                setReplyTo(message);
                            }
                        }}
                        onEditSelect={(message) => {
                            if (replyTo || replyToVisible) {
                                setPendingAction({ type: "edit", message: message });
                                setReplyToVisible(false); // onCloseReply will apply pending
                            } else {
                                setEditMessage(message);
                            }
                        }}
                    >
                        <div ref={messagesEndRef} />
                    </ChatMessages>
                )}
                
                <ChatInputWrapper 
                    onSendMessage={(text, files) => {
                        panel.handleSendMessage(text, replyTo?.id, files);
                        setReplyTo(null);
                    }} 
                    onSaveEdit={(content) => {
                        if (editMessage) {
                            panel.handleEditMessage(editMessage.id, content);
                            setEditMessage(null);
                        }
                    }}
                    replyTo={replyTo}
                    replyToVisible={replyToVisible}
                    onClearReply={() => {
                        setPendingAction(null);
                        setReplyToVisible(false);
                    }}
                    onCloseReply={() => {
                        setReplyTo(null);
                        if (pendingAction && pendingAction.type === "edit") {
                            setEditMessage(pendingAction.message);
                            setPendingAction(null);
                        }
                    }}
                    editingMessage={editMessage}
                    editVisible={editVisible}
                    onClearEdit={() => {
                        setPendingAction(null);
                        setEditVisible(false);
                    }}
                    onCloseEdit={() => {
                        setEditMessage(null);
                        if (pendingAction && pendingAction.type === "reply") {
                            setReplyTo(pendingAction.message);
                            setPendingAction(null);
                        }
                    }}
                />
            </div>
        </div>
    );
}
