export function ProfileDialog() {
    return (
        <mdui-dialog id="profile-dialog" close-on-overlay-click close-on-esc>
            <div className="content">
                <div className="header-top">
                    <div className="profile-picture-container">
                        <img id="profile-picture" src="./src/resources/images/default-avatar.png" alt="Ваше фото" />
                        <mdui-button-icon icon="camera_alt--filled" id="upload-pfp-btn" className="upload-overlay" variant="filled"></mdui-button-icon>
                        <input type="file" id="pfp-file-input" accept="image/*" style={{ display: "none" }} />
                    </div>
                    <mdui-text-field id="username-field" label="Имя пользователя" variant="outlined" value="user123" autocomplete="username"></mdui-text-field>
                </div>

                <form id="profile-form">
                    <mdui-text-field 
                        id="description-field"
                        label="О себе" 
                        variant="outlined" 
                        // multiline={true}
                        rows={3}
                        placeholder="Расскажите о себе..."
                        autocomplete="none"></mdui-text-field>
                    <div className="dialog-actions">
                        <mdui-button type="submit" id="profile-submit">Сохранить изменения</mdui-button>
                        <mdui-button id="profile-dialog-close" variant="outlined">Закрыть</mdui-button>
                    </div>
                </form>
            </div>
        </mdui-dialog>
    );
}
