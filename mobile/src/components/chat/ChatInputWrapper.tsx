import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialDialog } from "../core/Dialog";
import { RichTextArea } from "../core/RichTextArea";
import type { Message } from "../../core/types";
import Quote from "../core/Quote";
import AnimatedHeight from "../core/animations/AnimatedHeight";
import { useImmer } from "use-immer";
import { 
    MduiIcon, 
    MduiButtonIcon, 
    MduiChip, 
    MduiButton 
} from "../MDUIToRNMapping";

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
    onProvideFileAdder?: (adder: (files: File[]) => void) => void;
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
        onCloseEdit,
        onProvideFileAdder
    }: ChatInputWrapperProps
) {
    const [message, setMessage] = useState("");
    const [selectedFiles, setSelectedFiles] = useImmer<File[]>([]);
    const [attachmentsVisible, setAttachmentsVisible] = useState(false);
    const [errorOpen, setErrorOpen] = useState(false);

    // Expose a way for parent to programmatically add files
    useEffect(() => {
        if (onProvideFileAdder) {
            const addFiles = (files: File[]) => {
                if (!files || files.length === 0) return;
                setSelectedFiles(draft => { draft.push(...files) });
            };
            onProvideFileAdder(addFiles);
        }
    }, [onProvideFileAdder]);

    // When entering edit mode, preload the message content
    useEffect(() => {
        setMessage(editingMessage ? editingMessage.content || "" : "");
    }, [editingMessage]);

    useEffect(() => {
        setAttachmentsVisible(selectedFiles.length > 0);
    }, [selectedFiles]);

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
        input.addEventListener("change", () => {
            setSelectedFiles(draft => { draft.push(...Array.from(input.files || [])) });
        });
        input.click();
    }

    return (
        <div className="chat-input-wrapper">
            <form className="input-group" id="message-form" onSubmit={handleSubmit}>
                <AnimatedHeight visible={editVisible} onFinish={onCloseEdit}>
                    {editingMessage && (
                        <div className="reply-preview contextual-preview">
                            <MduiIcon name="edit" />
                            <Quote className="reply-content contextual-content" background="surfaceContainer">
                                <span className="reply-username">{editingMessage!.username}</span>
                                <span className="reply-text">{editingMessage!.content}</span>
                            </Quote>
                            <MduiButtonIcon icon="close" onPress={onClearEdit} />
                        </div>
                    )}
                </AnimatedHeight>
                <AnimatedHeight visible={replyToVisible} onFinish={onCloseReply}>
                    {replyTo && (
                        <div className="reply-preview contextual-preview">
                            <MduiIcon name="reply" />
                            <Quote className="reply-content contextual-content" background="surfaceContainer">
                                <span className="reply-username">{replyTo!.username}</span>
                                <span className="reply-text">{replyTo!.content}</span>
                            </Quote>
                            <MduiButtonIcon icon="close" onPress={onClearReply} />
                        </div>
                    )}
                </AnimatedHeight>
                <AnimatedHeight visible={attachmentsVisible} onFinish={() => setSelectedFiles([])}>
                    {selectedFiles.length > 0 && (
                        <div className="attachments-preview contextual-preview">
                            <MduiIcon name="attach_file" />
                            <div className="attachments-chips">
                                {selectedFiles.map((file, i) => (
                                    <MduiChip
                                        key={i}
                                        variant="input"
                                        onClose={() => {
                                            if (selectedFiles.length == 1) {
                                                setAttachmentsVisible(false);
                                            } else {
                                                setSelectedFiles(draft => { draft.splice(i) })
                                            }
                                        }}
                                    >
                                        <MduiIcon name="attach_file" />
                                        <Text>{file.name}</Text>
                                    </MduiChip>
                                ))}
                            </div>
                            <MduiButtonIcon icon="close" onPress={() => setAttachmentsVisible(false)} />
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
                        <MduiButtonIcon icon="attach_file" onPress={handleAttachClick} />
                        <button type="submit" className="send-btn">
                            <span className="material-symbols filled">{editingMessage ? "check" : "send"}</span>
                        </button>
                    </div>
                </div>
            </form>
            <MaterialDialog open={errorOpen} onOpenChange={setErrorOpen} close-on-overlay-click close-on-esc>
                <div slot="headline">Ошибка</div>
                <div>Общий размер вложений превышает 4 ГБ.</div>
                <MduiButton onPress={() => setErrorOpen(false)}>Закрыть</MduiButton>
            </MaterialDialog>
        </div>
    );
}
