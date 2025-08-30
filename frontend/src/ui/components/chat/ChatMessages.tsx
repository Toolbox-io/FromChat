import { useChat } from "../../hooks/useChat";
import { Message } from "./Message";
import { useAppState } from "../../state";
import type { Message as MessageType } from "../../../core/types";

export function ChatMessages() {
    const { messages } = useChat();
    const { user } = useAppState();

    const handleProfileClick = (username: string) => {
        // TODO: Show user profile dialog
        console.log("Show profile for:", username);
    };

    const handleContextMenu = (e: React.MouseEvent, message: MessageType) => {
        e.preventDefault();
        // TODO: Show context menu
        console.log("Show context menu for message:", message.id);
    };

    return (
        <div className="chat-messages" id="chat-messages">
            {messages.map((message) => (
                <Message
                    key={message.id}
                    message={message}
                    isAuthor={message.username === user.currentUser?.username}
                    onProfileClick={handleProfileClick}
                    onContextMenu={handleContextMenu}
                />
            ))}
        </div>
    );
}
