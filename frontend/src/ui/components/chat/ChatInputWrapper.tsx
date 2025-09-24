import { useState, useEffect } from "react";
import { MaterialDialog } from "../core/Dialog";
import { RichTextArea } from "../core/RichTextArea";
import type { Message } from "../../../core/types";
import Quote from "../core/Quote";
import AnimatedHeight from "../core/animations/AnimatedHeight";

interface ChatInputWrapperProps {
    onSendMessage: (message: string, files: File[]) => void;
    onSaveEdit?: (content: string) => void;
    replyTo?: Message | null;
    replyToVisible: boolean;
    onClearReply?: () => void;
    onCloseReply?: () => void;
    editingMessage?: Message | null;
    editVisible?: boolean;
    onClearEdit?: () => void;
    onCloseEdit?: () => void;
}

export function ChatInputWrapper(
    { 
        onSendMessage, 
        onSaveEdit, 
        replyTo, 
        replyToVisible, 
        onClearReply,
        onCloseReply, 
        editingMessage, 
        editVisible = false, 
        onClearEdit, 
        onCloseEdit 
    }: ChatInputWrapperProps
) {
    const [message, setMessage] = useState("");
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [attachmentsVisible, setAttachmentsVisible] = useState(false);
    const [errorOpen, setErrorOpen] = useState(false);

    // When entering edit mode, preload the message content
    useEffect(() => {
        if (editingMessage) {
            setMessage(editingMessage.content || "");
        } else {
            setMessage("");
        }
    }, [editingMessage]);

    useEffect(() => {
        if (selectedFiles.length > 0) {
            setAttachmentsVisible(true);
        }
    }, [selectedFiles])

    const handleSubmit = async (e: React.FormEvent | Event) => {
        e.preventDefault();
        const hasText = Boolean(message.trim());
        const hasFiles = selectedFiles.length > 0;
        if (hasText || hasFiles) {
            const totalSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);
            const limit = 4 * 1024 * 1024 * 1024; // 4GB
            if (totalSize > limit) {
                setErrorOpen(true);
                return;
            }
            if (editingMessage && onSaveEdit) {
                onSaveEdit(message);
                setMessage("");
                if (onClearEdit) onClearEdit();
            } else {
                onSendMessage(message, selectedFiles);
                setMessage("");
                setAttachmentsVisible(false);
                if (onClearReply) onClearReply();
            }
        }
    };

    function handleAttachClick() {
        const input = document.createElement("input");
        input.type = "file";
        input.multiple = true;
        input.onchange = () => {
            const files = Array.from(input.files || []);
            setSelectedFiles(files);
        };
        input.click();
    }

    return (
        <div className="chat-input-wrapper">
            <form className="input-group" id="message-form" onSubmit={handleSubmit}>
                <AnimatedHeight visible={editVisible} onFinish={onCloseEdit}>
                    {editingMessage && (
                        <div className="reply-preview contextual-preview">
                            <mdui-icon name="edit" />
                            <Quote className="reply-content contextual-content" background="surfaceContainer">
                                <span className="reply-username">{editingMessage!.username}</span>
                                <span className="reply-text">{editingMessage!.content}</span>
                            </Quote>
                            <mdui-button-icon icon="close" className="reply-cancel" onClick={onClearEdit}></mdui-button-icon>
                        </div>
                    )}
                </AnimatedHeight>
                <AnimatedHeight visible={replyToVisible} onFinish={onCloseReply}>
                    {replyTo && (
                        <div className="reply-preview contextual-preview">
                            <mdui-icon name="reply" />
                            <Quote className="reply-content contextual-content" background="surfaceContainer">
                                <span className="reply-username">{replyTo!.username}</span>
                                <span className="reply-text">{replyTo!.content}</span>
                            </Quote>
                            <mdui-button-icon icon="close" className="reply-cancel" onClick={onClearReply}></mdui-button-icon>
                        </div>
                    )}
                </AnimatedHeight>
                <AnimatedHeight visible={attachmentsVisible} onFinish={() => setSelectedFiles([])}>
                    {selectedFiles.length > 0 && (
                        <div className="attachments-preview contextual-preview">
                            <mdui-icon name="attach_file" />
                            <div className="attachments-chips">
                                {selectedFiles.map((f, i) => (
                                    <mdui-chip
                                        key={i}
                                        variant="input"
                                        end-icon="close"
                                        title={`${f.name} (${Math.round(f.size/1024/1024)} MB)`}
                                        onClick={() => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))}
                                    >
                                        <mdui-icon slot="icon" name="attach_file"></mdui-icon>
                                        <span className="name">{f.name}</span>
                                    </mdui-chip>
                                ))}
                            </div>
                            <mdui-button-icon icon="close" className="reply-cancel" onClick={() => setAttachmentsVisible(false)}></mdui-button-icon>
                        </div>
                    )}
                </AnimatedHeight>
                <div className="chat-input">
                    <RichTextArea
                        className="message-input" 
                        id="message-input" 
                        placeholder="Напишите сообщение..." 
                        autoComplete="off"
                        text={message}
                        rows={1}
                        onTextChange={(value) => setMessage(value)}
                        onEnter={handleSubmit} />
                    <div className="buttons">
                        <mdui-button-icon icon="attach_file" onClick={handleAttachClick} className="attach-btn"></mdui-button-icon>
                        <button type="submit" className="send-btn">
                            <span className="material-symbols filled">{editingMessage ? "check" : "send"}</span>
                        </button>
                    </div>
                </div>
            </form>
            <MaterialDialog open={errorOpen} onOpenChange={setErrorOpen} close-on-overlay-click close-on-esc>
                <div slot="headline">Ошибка</div>
                <div>Общий размер вложений превышает 4 ГБ.</div>
                <mdui-button slot="action" onClick={() => setErrorOpen(false)}>Закрыть</mdui-button>
            </MaterialDialog>
        </div>
    );
}
