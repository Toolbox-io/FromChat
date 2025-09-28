import { PRODUCT_NAME } from "../../core/config";
import { useProfile } from "../../hooks/useProfile";
import { useState } from "react";
import { ProfileDialog } from "../profile/ProfileDialog";

export function ChatHeader() {
    const { profileData } = useProfile();
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    const handleProfileClick = () => {
        setIsProfileOpen(true);
    };

    const profilePictureUrl = profileData?.profile_picture || "https://via.placeholder.com/40x40/cccccc/ffffff?text=U";

    return (
        <>
            <header className="chat-header-left">
                <div className="product-name">{PRODUCT_NAME}</div>
                <div className="profile">
                    <a href="#" id="profile-open" onClick={handleProfileClick}>
                        <img 
                            src={profilePictureUrl} 
                            alt="" 
                            id="preview1"
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = "https://via.placeholder.com/40x40/cccccc/ffffff?text=U";
                            }}
                        />
                    </a>
                </div>
            </header>
            <ProfileDialog isOpen={isProfileOpen} onOpenChange={setIsProfileOpen} />
        </>
    );
}