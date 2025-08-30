import { PRODUCT_NAME } from "../../../core/config";

export function ChatHeader() {
    return (
        <header className="chat-header-left">
            <div className="product-name">{PRODUCT_NAME}</div>
            <div className="profile">
                <a href="#" id="profile-open">
                    <img src="./src/resources/images/default-avatar.png" alt="" id="preview1" />
                </a>
            </div>
        </header>
    );
}