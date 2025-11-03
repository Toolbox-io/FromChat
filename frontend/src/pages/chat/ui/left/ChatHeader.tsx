import { PRODUCT_NAME } from "@/core/config";
import useProfile from "@/pages/chat/hooks/useProfile";
import defaultAvatar from "@/images/default-avatar.png";
import { useState } from "react";
import { useAppState } from "@/pages/chat/state";
import { MinimizedCallBar } from "@/pages/chat/ui/right/calls/MinimizedCallBar";
import styles from "@/pages/chat/css/left-panel.module.scss";

export function ChatHeader() {
    const { profileData } = useProfile();
    const { setProfileDialog, user } = useAppState();
    const [profilePictureUrl, setProfilePictureUrl] = useState(profileData?.profile_picture || defaultAvatar);

    const handleProfileClick = () => {
        setProfileDialog({
            userId: user.currentUser?.id,
            username: profileData?.username || "Пользователь",
            display_name: profileData?.display_name || "Пользователь",
            profilePicture: profileData?.profile_picture,
            bio: profileData?.description,
            memberSince: user.currentUser?.created_at,
            online: user.currentUser?.online,
            isOwnProfile: true
        });
    };

    return (
        <>
            <header className={styles.chatHeaderLeft}>
                <div className={styles.productName}>{PRODUCT_NAME}</div>
                <div className={styles.profile}>
                    <a href="#" id="profile-open" onClick={handleProfileClick}>
                        <img
                            src={profilePictureUrl}
                            alt=""
                            id="preview1"
                            onError={() => setProfilePictureUrl(defaultAvatar)} />
                    </a>
                </div>
            </header>
            <MinimizedCallBar />
        </>
    );
}