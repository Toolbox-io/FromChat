import { useEffect } from "react";
import { useDM } from "../../../hooks/useDM";
import { useAppState } from "../../state";
import defaultAvatar from "../../../resources/images/default-avatar.png";

export function DMUsersList() {
    const { dmUsers, isLoadingUsers, loadUsers, startDMConversation } = useDM();
    const { chat } = useAppState();

    useEffect(() => {
        if (chat.activeTab === "dms") {
            loadUsers();
        }
    }, [chat.activeTab, loadUsers]);

    if (isLoadingUsers) {
        return (
            <mdui-list>
                <mdui-list-item headline="Загрузка..." description="Получение списка пользователей...">
                    <img src={defaultAvatar} alt="" slot="icon" />
                </mdui-list-item>
            </mdui-list>
        );
    }

    if (dmUsers.length === 0) {
        return (
            <mdui-list>
                <mdui-list-item headline="Нет пользователей" description="Пользователи не найдены">
                    <img src={defaultAvatar} alt="" slot="icon" />
                </mdui-list-item>
            </mdui-list>
        );
    }

    return (
        <mdui-list>
            {dmUsers.map((user) => (
                <mdui-list-item
                    key={user.id}
                    headline={user.username}
                    description={user.lastMessage || "Нет сообщений"}
                    onClick={() => startDMConversation(user)}
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
