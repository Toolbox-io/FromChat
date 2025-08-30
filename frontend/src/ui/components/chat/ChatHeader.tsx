import { PRODUCT_NAME } from "../../../core/config";
import { useDialog } from "../../contexts/DialogContext";

export function ChatHeader() {
    const { openProfile } = useDialog();

    const handleProfileClick = () => {
        openProfile();
    };

    return (
        <header className="chat-header-left">
            <div className="product-name">{PRODUCT_NAME}</div>
            <div className="profile">
                <a href="#" id="profile-open" onClick={handleProfileClick}>
                    <img src="./src/resources/images/default-avatar.png" alt="" id="preview1" />
                </a>
            </div>
        </header>
    );
}