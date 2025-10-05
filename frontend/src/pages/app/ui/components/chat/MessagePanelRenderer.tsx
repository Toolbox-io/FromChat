import { useState, useEffect, useRef } from "react";
import { useAppState } from "../../state";
import { MessagePanel, type MessagePanelState } from "../../panels/MessagePanel";
import { ChatMessages } from "./ChatMessages";
import { ChatInputWrapper } from "./ChatInputWrapper";
import { setGlobalMessageHandler } from "../../../core/websocket";
import type { Message, WebSocketMessage } from "../../../core/types";
import defaultAvatar from "../../../resources/images/default-avatar.png";
import AnimatedOpacity from "../core/animations/AnimatedOpacity";
import type { DMPanel } from "../../panels/DMPanel";

interface MessagePanelRendererProps {
    panel: MessagePanel | null;
}

export function MessagePanelRenderer({ panel }: MessagePanelRendererProps) {
    const { applyPendingPanel, chat } = useAppState();
    const messagePanelRef = useRef<HTMLDivElement>(null);
    const [panelState, setPanelState] = useState<MessagePanelState | null>(null);
    const [switchIn, setSwitchIn] = useState(false);
    const [switchOut, setSwitchOut] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [replyTo, setReplyTo] = useState<Message | null>(null);
    const [replyToVisible, setReplyToVisible] = useState(Boolean(replyTo));
    const [editMessage, setEditMessage] = useState<Message | null>(null);
    const [editVisible, setEditVisible] = useState(Boolean(editMessage));
    const [pendingAction, setPendingAction] = useState<null | { type: "reply" | "edit"; message: Message }>(null);


    // Drag & drop
    const [isDragging, setIsDragging] = useState(false);
    const dragCounterRef = useRef(0);
    const addFilesRef = useRef<null | ((files: File[]) => void)>(null);

    useEffect(() => {
        if (!panel || !panelState) return;

        return () => {
            dragCounterRef.current = 0;
            setIsDragging(false);
        };
    }, [panel, panelState]);

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
            
            // Store the handler for cleanup
            panel.onStateChange = (newState: MessagePanelState) => {
                setPanelState(newState);
            };
            
            // Set up WebSocket message handler for this panel
            if (panel.handleWebSocketMessage) {
                setGlobalMessageHandler((message: WebSocketMessage<any>) => panel.handleWebSocketMessage(message));
            }
        } else {
            setPanelState(null);
            setGlobalMessageHandler(null);
        }
        
        return () => {
            if (panel) {
                if (panel.onStateChange) {
                    panel.onStateChange = null;
                }

                if (typeof panel.destroy === 'function') {
                    panel.destroy();
                }
            }
        };
    }, [panel]);

    // Handle chat switching animation with event listeners
    useEffect(() => {
        if (chat.isSwitching) {
            setSwitchOut(true);
            
            // Use animation event listeners instead of hardcoded delays
            function handleAnimationEnd(event: Event) {
                const animationEvent = event as AnimationEvent;
                
                if (animationEvent.animationName === 'fadeOutUp') {
                    // Apply pending panel exactly at the boundary between animations
                    applyPendingPanel();
                    setSwitchOut(false);
                    setSwitchIn(true);
                } else if (animationEvent.animationName === 'fadeInDown') {
                    setSwitchIn(false);
                    // End the chat switching state
                    chat.setIsSwitching(false);
                }
            };
            
            // Add event listener to document to catch all animation events
            document.addEventListener('animationend', handleAnimationEnd);
            
            // Cleanup function
            return () => {
                document.removeEventListener('animationend', handleAnimationEnd);
            };
        }
    }, [chat.isSwitching]);

    // Load messages when panel changes and animation is not running
    useEffect(() => {
        if (!chat.activePanel || chat.isSwitching || switchOut || switchIn) return;
        
        const panelState = chat.activePanel.getState();
        
        if (panelState.messages.length === 0 && !panelState.isLoading) {
            chat.activePanel.loadMessages();
        }
    }, [chat.activePanel, chat.isSwitching, switchOut, switchIn]);

    // Scroll to bottom when messages change, but only when no animation is running
    useEffect(() => {
        if (!panelState || chat.isSwitching || switchOut || switchIn || panelState.isLoading) return;

        const el = messagesEndRef.current;
        if (!el) return;

        // Defer to next frame to ensure layout is stable
        const id = requestAnimationFrame(() => {
            el.scrollIntoView({ behavior: "smooth", block: "end" });
        });
        
        return () => cancelAnimationFrame(id);
    }, [panelState?.messages, panelState?.isLoading, chat.isSwitching, switchOut, switchIn]);

    return (
        <div className={`chat-container ${switchIn ? "chat-switch-in" : ""} ${switchOut ? "chat-switch-out" : ""}`}>
            <div 
                ref={messagePanelRef}
                className="chat-main" 
                id="chat-inner"
                onDragEnter={panel ? (e) => {
                    if (!e.dataTransfer) return;
                    e.preventDefault();
                    e.stopPropagation();
                    dragCounterRef.current += 1;
                    // Only show overlay when actual files are dragged
                    const hasFiles = Array.from(e.dataTransfer.types || []).includes("Files");
                    if (hasFiles) setIsDragging(true);
                } : undefined}
                onDragOver={panel ? (e) => {
                    if (!e.dataTransfer) return;
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = "copy";
                } : undefined}
                onDragLeave={panel ? (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
                    if (dragCounterRef.current === 0) setIsDragging(false);
                } : undefined}
                onDrop={panel ? (e) => {
                    if (!e.dataTransfer) return;
                    e.preventDefault();
                    e.stopPropagation();
                    const files = Array.from(e.dataTransfer.files || []);
                    if (files.length > 0 && addFilesRef.current) {
                        addFilesRef.current(files);
                    }
                    setIsDragging(false);
                    dragCounterRef.current = 0;
                } : undefined}>
                <div className="chat-header">
                    <img 
                        src={panelState?.profilePicture || defaultAvatar} 
                        alt="Avatar" 
                        className="chat-header-avatar"
                        onClick={panel?.handleProfileClick}
                        style={{ cursor: panel ? "pointer" : "default" }}
                    />
                    <div className="chat-header-info">
                        <div className="info-chat">
                            <h4 id="chat-name">{panelState?.title || "Выбор чата"}</h4>
                            <p>
                                <span className={`online-status ${panelState?.online ? "online" : ""}`}></span>
                                {panelState ? (
                                    <>
                                        {panelState.online ? "Online" : "Offline"}
                                        {panelState.isTyping && " • Typing..."}
                                    </>
                                ) : (
                                    "Выберите чат, чтобы начать переписку"
                                )}
                            </p>
                        </div>
                    </div>
                </div>

                {panelState?.isLoading ? (
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
                ) : panelState && panel ? (
                    <ChatMessages 
                        messages={panelState.messages} 
                        isDm={panel.isDm()} 
                        dmRecipientPublicKey={(panel as DMPanel).dmData?.publicKey}
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
                        onDelete={(id) => panel.handleDeleteMessage(id)}
                        onRetryMessage={(id) => panel.retryMessage(id)}
                    >
                        <div ref={messagesEndRef} />
                    </ChatMessages>
                ) : (
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
                )}

                {panel && (
                    <>
                        <AnimatedOpacity 
                            visible={isDragging} 
                            className="file-overlay" 
                            onDragOver={(e) => e.preventDefault()} 
                            onDrop={(e) => e.preventDefault()}>
                            <div className="file-overlay-wrapper">
                                <div className="file-overlay-inner">
                                    <mdui-icon name="upload_file" />
                                    <span>Отпустите файл(ы) для добавления</span>
                                </div>
                            </div>
                        </AnimatedOpacity>
                        
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
                            onProvideFileAdder={(adder) => { addFilesRef.current = adder; }}
                            messagePanelRef={messagePanelRef}
                        />
                    </>
                )}
            </div>
        </div>
    );
}
