import { useEffect } from "react";
import { useDM, type DMUser } from "@/pages/chat/hooks/useDM";
import { useAppState } from "@/pages/chat/state";
import { fetchUserPublicKey } from "@/core/api/dmApi";
import defaultAvatar from "@/images/default-avatar.png";

export function DMUsersList() {
    const { dmUsers, isLoadingUsers, loadUsers } = useDM();
    const { chat, switchToDM } = useAppState();

    useEffect(() => {
        if (chat.activeTab === "chats") {
            loadUsers();
        }
    }, [chat.activeTab, loadUsers]);

    if (isLoadingUsers) {
        return (
            <mdui-circular-progress />
        );
    }

    async function handleUserClick(user: DMUser) {
        if (!user.publicKey) {
            // Get public key if not already loaded
            const authToken = useAppState.getState().user.authToken;
            if (!authToken) return;
            
            const publicKey = await fetchUserPublicKey(user.id, authToken);
            if (publicKey) {
                user.publicKey = publicKey;
            } else {
                console.error("Failed to get public key for user:", user.id);
                return;
            }
        }
        
        await switchToDM({
            userId: user.id,
            username: user.username,
            publicKey: user.publicKey,
            profilePicture: user.profile_picture,
            online: user.online || false
        });
    };

    return (
        <mdui-list>
            {dmUsers.map((user: DMUser) => (
                <mdui-list-item
                    key={user.id}
                    headline={user.username}
                    description={user.lastMessage || "Нет сообщений"}
                    onClick={() => handleUserClick(user)}
                    style={{ cursor: "pointer" }}
                >
                    <img 
                        src={user.profile_picture || defaultAvatar} 
                        alt={user.username} 
                        slot="icon"
                        style={{
                            width: "40px",
                            height: "40px",
                            borderRadius: "50%",
                            objectFit: "cover"
                        }}
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = defaultAvatar;
                        }}
                    />
                    {user.unreadCount > 0 && (
                        <mdui-badge slot="end-icon">
                            {user.unreadCount}
                        </mdui-badge>
                    )}
                </mdui-list-item>
            ))}
        </mdui-list>
    );
}
