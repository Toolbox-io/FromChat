import { useState, type FormEvent } from "react";
import defaultAvatar from "../../../resources/images/default-avatar.png";
import type { TextField } from "mdui/components/text-field";
import type { DialogProps } from "../../../core/types";
import { MaterialDialog } from "../Dialog";

export function ProfileDialog({ isOpen, onOpenChange }: DialogProps) {
    const [username, setUsername] = useState("user123");
    const [description, setDescription] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // TODO: Implement profile update logic
        console.log("Profile update:", { username, description });
        onOpenChange(false);
    };

    return (
        <MaterialDialog id="profile-dialog" close-on-overlay-click close-on-esc open={isOpen} onOpenChange={onOpenChange}>
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
                        onChange={(e: FormEvent<HTMLElement & TextField>) => setUsername((e.target as TextField).value)}
                        autocomplete="username">
                    </mdui-text-field>
                </div>

                <form id="profile-form" onSubmit={handleSubmit}>
                    <mdui-text-field 
                        id="description-field"
                        label="О себе" 
                        variant="outlined" 
                        value={description}
                        onChange={(e: FormEvent<HTMLElement & TextField>) => setDescription((e.target as TextField).value)}
                        placeholder="Расскажите о себе..."
                        autocomplete="none">
                    </mdui-text-field>
                    <div className="dialog-actions">
                        <mdui-button type="submit" id="profile-submit">Сохранить изменения</mdui-button>
                        <mdui-button id="profile-dialog-close" variant="outlined" onClick={() => onOpenChange(false)}>Закрыть</mdui-button>
                    </div>
                </form>
            </div>
        </MaterialDialog>
    );
}
