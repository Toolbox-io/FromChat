import { PRODUCT_NAME } from "../../core/config";

export function ElectronTitleBar() {
    if (window.electronInterface !== undefined) {
        return (
            <div id="electron-title-bar">
                {window.electronInterface.platform == "darwin" ? <div className="macos-padding"></div> : undefined}
                <div id="window-title">{PRODUCT_NAME}</div>
                {/* <div className="window-controls">
                    <mdui-button-icon icon="remove" id="window-minimize"></mdui-button-icon>
                    <mdui-button-icon icon="stack--outlined" id="window-restore" className="hidden"></mdui-button-icon>
                    <mdui-button-icon icon="ad--outlined" id="window-maximize"></mdui-button-icon>
                    <mdui-button-icon icon="close" id="window-close"></mdui-button-icon>
                </div> */}
            </div>
        )
    }
}