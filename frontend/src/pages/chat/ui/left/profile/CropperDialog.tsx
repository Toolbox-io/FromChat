import "./css/cropper-dialog.scss";

export function CropperDialog() {
    return (
        <mdui-dialog id="cropper-dialog" close-on-overlay-click close-on-esc>
            <div className="cropper-dialog-content">
                <div className="cropper-header">
                    <h3>Обрезать фото профиля</h3>
                    <mdui-button-icon icon="close" id="cropper-close"></mdui-button-icon>
                </div>
                <div className="cropper-container">
                    <div id="cropper-area"></div>
                </div>
                <div className="cropper-actions">
                    <mdui-button id="crop-cancel" variant="outlined">Отмена</mdui-button>
                    <mdui-button id="crop-save">Сохранить</mdui-button>
                </div>
            </div>
        </mdui-dialog>
    );
}
