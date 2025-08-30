import { useState } from "react";
import { useDialog } from "../../contexts/DialogContext";
import defaultAvatar from "../../../resources/images/default-avatar.png";

export function ProfileDialog() {
    const [username, setUsername] = useState("user123");
    const [description, setDescription] = useState("");
    const { isProfileOpen, closeProfile } = useDialog();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // TODO: Implement profile update logic
        console.log("Profile update:", { username, description });
        closeProfile();
    };

    return (
        <mdui-dialog id="profile-dialog" close-on-overlay-click close-on-esc open={isProfileOpen}>
            <div className="content">
                <div className="header-top">
                    <div className="profile-picture-container">
                        <img id="profile-picture" src={defaultAvatar} alt="Ваше фото" />
                        <mdui-button-icon icon="camera_alt--filled" id="upload-pfp-btn" className="upload-overlay" variant="filled"></mdui-button-icon>
                        <input type="file" id="pfp-file-input" accept="image/*" style={{ display: "none" }} />
                    </div>
                    <mdui-text-field 
                        id="username-field" 
                        label="Имя пользователя" 
                        variant="outlined" 
                        value={username}
                        onChange={(e: any) => setUsername(e.target.value)}
                        autocomplete="username">
                    </mdui-text-field>
                </div>

                <form id="profile-form" onSubmit={handleSubmit}>
                    <mdui-text-field 
                        id="description-field"
                        label="О себе" 
                        variant="outlined" 
                        value={description}
                        onChange={(e: any) => setDescription(e.target.value)}
                        placeholder="Расскажите о себе..."
                        autocomplete="none">
                    </mdui-text-field>
                    <div className="dialog-actions">
                        <mdui-button type="submit" id="profile-submit">Сохранить изменения</mdui-button>
                        <mdui-button id="profile-dialog-close" variant="outlined" onClick={closeProfile}>Закрыть</mdui-button>
                    </div>
                </form>
            </div>
        </mdui-dialog>
    );
}
