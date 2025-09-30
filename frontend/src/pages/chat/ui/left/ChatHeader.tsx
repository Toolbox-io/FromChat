import { PRODUCT_NAME } from "@/core/config";
import useProfile from "@/pages/chat/hooks/useProfile";
import defaultAvatar from "@/images/default-avatar.png";
import { useState } from "react";
import { ProfileDialog } from "./profile/ProfileDialog";
import { MinimizedCallBar } from "@/pages/chat/ui/right/calls/MinimizedCallBar";

export function ChatHeader() {
    const { profileData } = useProfile();
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    const [profilePictureUrl, setProfilePictureUrl] = useState(profileData?.profile_picture || defaultAvatar);

    return (
        <>
            <header className="chat-header-left">
                <div className="product-name">{PRODUCT_NAME}</div>
                <div className="profile">
                    <a href="#" id="profile-open" onClick={() => setIsProfileOpen(true)}>
                        <img
                            src={profilePictureUrl} 
                            alt=""
                            id="preview1"
                            onError={() => setProfilePictureUrl(defaultAvatar)} />
                    </a>
                </div>
            </header>
            <MinimizedCallBar />
            <ProfileDialog isOpen={isProfileOpen} onOpenChange={setIsProfileOpen} />
        </>
    );
}