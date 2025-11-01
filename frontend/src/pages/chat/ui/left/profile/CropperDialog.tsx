import { MaterialButton, MaterialIconButton } from "@/utils/material";
import "./css/cropper-dialog.scss";

export function CropperDialog() {
    return (
        <mdui-dialog id="cropper-dialog" close-on-overlay-click close-on-esc>
            <div className="cropper-dialog-content">
                <div className="cropper-header">
                    <h3>Обрезать фото профиля</h3>
                    <MaterialIconButton icon="close" id="cropper-close" />
                </div>
                <div className="cropper-container">
                    <div id="cropper-area"></div>
                </div>
                <div className="cropper-actions">
                    <MaterialButton id="crop-cancel" variant="outlined">Отмена</MaterialButton>
                    <MaterialButton id="crop-save">Сохранить</MaterialButton>
                </div>
            </div>
        </mdui-dialog>
    );
}
