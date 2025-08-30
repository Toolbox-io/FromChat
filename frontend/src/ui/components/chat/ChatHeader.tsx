import { PRODUCT_NAME } from "../../../core/config";
import { useDialog } from "../../contexts/DialogContext";
import { useProfile } from "../../hooks/useProfile";
import defaultAvatar from "../../../resources/images/default-avatar.png";

export function ChatHeader() {
    const { openProfile } = useDialog();
    const { profileData } = useProfile();

    const handleProfileClick = () => {
        openProfile();
    };

    const profilePictureUrl = profileData?.profile_picture || defaultAvatar;

    return (
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
                            target.src = defaultAvatar;
                        }}
                    />
                </a>
            </div>
        </header>
    );
}