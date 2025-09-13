import type { Message } from "../../core/types";
import type { UserState } from "../state";

export interface MessagePanelState {
    id: string;
    title: string;
    profilePicture?: string;
    online: boolean;
    messages: Message[];
    isLoading: boolean;
    isTyping: boolean;
}

export interface MessagePanelCallbacks {
    onSendMessage: (content: string) => void;
    onEditMessage: (messageId: number, content: string) => void;
    onDeleteMessage: (messageId: number) => void;
    onReplyToMessage: (messageId: number, content: string) => void;
    onProfileClick: () => void;
}

export abstract class MessagePanel {
    protected state: MessagePanelState;
    protected callbacks: MessagePanelCallbacks;
    public onStateChange: ((state: MessagePanelState) => void) | null;
    protected currentUser: UserState;

    constructor(
        id: string,
        currentUser: UserState,
        callbacks: MessagePanelCallbacks,
        onStateChange: (state: MessagePanelState) => void
    ) {
        this.state = {
            id,
            title: "",
            online: false,
            messages: [],
            isLoading: false,
            isTyping: false
        };
        this.currentUser = currentUser;
        this.callbacks = callbacks;
        this.onStateChange = onStateChange;
    }

    // Abstract methods that must be implemented by subclasses
    abstract activate(): Promise<void>;
    abstract deactivate(): void;
    abstract loadMessages(): Promise<void>;
    abstract sendMessage(content: string): Promise<void>;
    abstract isDm(): boolean;
    
    // Optional WebSocket message handler (can be overridden by subclasses)
    handleWebSocketMessage?: (response: any) => void;

    // Common methods
    protected updateState(updates: Partial<MessagePanelState>): void {
        this.state = { ...this.state, ...updates };
        if (this.onStateChange) {
            this.onStateChange(this.state);
        }
    }

    protected addMessage(message: Message): void {
        const messageExists = this.state.messages.some(msg => msg.id === message.id);
        if (!messageExists) {
            this.updateState({
                messages: [...this.state.messages, message]
            });
        }
    }

    protected updateMessage(messageId: number, updates: Partial<Message>): void {
        this.updateState({
            messages: this.state.messages.map(msg => 
                msg.id === messageId ? { ...msg, ...updates } : msg
            )
        });
    }

    protected removeMessage(messageId: number): void {
        this.updateState({
            messages: this.state.messages.filter(msg => msg.id !== messageId)
        });
    }

    protected clearMessages(): void {
        this.updateState({ messages: [] });
    }

    protected setLoading(loading: boolean): void {
        this.updateState({ isLoading: loading });
    }

    protected setTyping(typing: boolean): void {
        this.updateState({ isTyping: typing });
    }

    // Getters
    getState(): MessagePanelState {
        return { ...this.state };
    }

    getId(): string {
        return this.state.id;
    }

    getTitle(): string {
        return this.state.title;
    }

    getMessages(): Message[] {
        return [...this.state.messages];
    }

    // Event handlers
    handleSendMessage = (content: string): void => {
        this.sendMessage(content);
    };

    handleEditMessage = (messageId: number, content: string): void => {
        this.callbacks.onEditMessage(messageId, content);
    };

    handleDeleteMessage = (messageId: number): void => {
        this.callbacks.onDeleteMessage(messageId);
    };

    handleReplyToMessage = (messageId: number, content: string): void => {
        this.callbacks.onReplyToMessage(messageId, content);
    };

    handleProfileClick = (): void => {
        this.callbacks.onProfileClick();
    };
}
