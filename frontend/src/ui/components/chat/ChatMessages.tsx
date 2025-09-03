import { useChat } from "../../hooks/useChat";
import { Message } from "./Message";
import { useAppState } from "../../state";
import type { Message as MessageType } from "../../../core/types";
import type { UserProfile } from "../../../core/types";
import { UserProfileDialog } from "./UserProfileDialog";
import { fetchUserProfile } from "../../api/profileApi";
import { useState } from "react";
import { delay } from "../../../utils/utils";

export function ChatMessages() {
    const { messages } = useChat();
    const { user } = useAppState();
    const [profileDialogOpen, setProfileDialogOpen] = useState(false);
    const [selectedUserProfile, setSelectedUserProfile] = useState<UserProfile | null>(null);
    const [isLoadingProfile, setIsLoadingProfile] = useState(false);

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
        // TODO: Show context menu
        console.log("Show context menu for message:", message.id);
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
        </>
    );
}
