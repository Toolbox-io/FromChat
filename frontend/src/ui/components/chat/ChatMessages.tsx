import { useChat } from "../../hooks/useChat";
import { Message } from "./Message";
import { useAppState } from "../../state";
import type { Message as MessageType } from "../../../core/types";
import type { UserProfile } from "../../../core/types";
import { UserProfileDialog } from "./UserProfileDialog";
import { MessageContextMenu, type ContextMenuState } from "./MessageContextMenu";
import { fetchUserProfile } from "../../api/profileApi";
import { useState, useEffect } from "react";
import { delay } from "../../../utils/utils";
import { request } from "../../../websocket";

export function ChatMessages() {
    const { messages } = useChat();
    const { user } = useAppState();
    const [profileDialogOpen, setProfileDialogOpen] = useState(false);
    const [selectedUserProfile, setSelectedUserProfile] = useState<UserProfile | null>(null);
    const [isLoadingProfile, setIsLoadingProfile] = useState(false);
    
    // Context menu state
    const [contextMenu, setContextMenu] = useState<ContextMenuState>({
        isOpen: false,
        message: null,
        position: { x: 0, y: 0 }
    });
    const [isContextMenuClosing, setIsContextMenuClosing] = useState(false);

    // Effect to handle clicks outside the context menu
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (contextMenu.isOpen && !isContextMenuClosing) {
                // Check if the click is on a context menu element
                const target = event.target as Element;
                if (!target.closest('.context-menu')) {
                    handleContextMenuClose();
                }
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && contextMenu.isOpen && !isContextMenuClosing) {
                handleContextMenuClose();
            }
        };

        const handleWindowBlur = () => {
            // Close context menu when browser window loses focus
            if (contextMenu.isOpen && !isContextMenuClosing) {
                handleContextMenuClose();
            }
        };

        // Add event listeners
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        window.addEventListener('blur', handleWindowBlur);

        // Cleanup
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('blur', handleWindowBlur);
        };
    }, [contextMenu.isOpen, isContextMenuClosing]);

    const handleProfileClick = async (username: string) => {
        if (!user.authToken) return;
        
        setIsLoadingProfile(true);
        try {
            const profile = await fetchUserProfile(user.authToken, username);
            if (profile) {
                setSelectedUserProfile(profile);
                setProfileDialogOpen(true);
            }
        } catch (error) {
            console.error("Failed to fetch user profile:", error);
        } finally {
            setIsLoadingProfile(false);
        }
    };

    const handleContextMenu = (e: React.MouseEvent, message: MessageType) => {
        e.preventDefault();
        console.log("Context menu triggered for message:", message.id, "at position:", e.clientX, e.clientY);
        setIsContextMenuClosing(false);
        setContextMenu({
            isOpen: true,
            message,
            position: { x: e.clientX, y: e.clientY }
        });
    };

    const handleContextMenuClose = () => {
        setIsContextMenuClosing(true);
        // Wait for animation to complete before removing from DOM
        setTimeout(() => {
            setContextMenu({
                isOpen: false,
                message: null,
                position: { x: 0, y: 0 }
            });
            setIsContextMenuClosing(false);
        }, 200); // Match the animation duration from _animations.scss
    };

    const handleEdit = async (message: MessageType) => {
        // This will be called when the edit dialog is saved
        if (!user.authToken) return;
        
        try {
            await request({
                type: "editMessage",
                data: { 
                    message_id: message.id,
                    content: message.content // This should be updated content from the dialog
                },
                credentials: {
                    scheme: "Bearer",
                    credentials: user.authToken
                }
            });
        } catch (error) {
            console.error("Failed to edit message:", error);
        }
    };

    const handleReply = async (message: MessageType) => {
        // This will be called when the reply dialog is sent
        if (!user.authToken) return;
        
        try {
            await request({
                type: "replyMessage",
                data: {
                    content: message.content, // This should be the reply content from the dialog
                    reply_to_id: message.id
                },
                credentials: {
                    scheme: "Bearer",
                    credentials: user.authToken
                }
            });
        } catch (error) {
            console.error("Failed to send reply:", error);
        }
    };

    const handleDelete = async (message: MessageType) => {
        if (!user.authToken) return;
        
        try {
            await request({
                type: "deleteMessage",
                data: { message_id: message.id },
                credentials: {
                    scheme: "Bearer",
                    credentials: user.authToken
                }
            });
        } catch (error) {
            console.error("Failed to delete message:", error);
        }
    };

    return (
        <>
            <div className="chat-messages" id="chat-messages">
                {messages.map((message) => (
                    <Message
                        key={message.id}
                        message={message}
                        isAuthor={message.username === user.currentUser?.username}
                        onProfileClick={handleProfileClick}
                        onContextMenu={handleContextMenu}
                        isLoadingProfile={isLoadingProfile}
                    />
                ))}
            </div>
            
            <UserProfileDialog
                isOpen={profileDialogOpen}
                onOpenChange={async (value) => {
                    setProfileDialogOpen(value);
                    if (!value) {
                        await delay(1000);
                        setSelectedUserProfile(null);
                    }
                }}
                userProfile={selectedUserProfile}
            />
            
            {/* Context Menu */}
            {contextMenu.isOpen && contextMenu.message && (
                <MessageContextMenu
                    message={contextMenu.message}
                    isAuthor={contextMenu.message.username === user.currentUser?.username}
                    onEdit={handleEdit}
                    onReply={handleReply}
                    onDelete={handleDelete}
                    onClose={handleContextMenuClose}
                    position={contextMenu.position}
                    isClosing={isContextMenuClosing}
                />
            )}
        </>
    );
}
