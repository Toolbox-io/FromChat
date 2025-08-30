import { useDialog } from "../../contexts/DialogContext";

export function BottomAppBar() {
    const { openSettings } = useDialog();

    const handleSettingsClick = () => {
        openSettings();
    };

    return (
        <mdui-bottom-app-bar>
            <mdui-button-icon icon="settings--filled" id="settings-open" onClick={handleSettingsClick}></mdui-button-icon>
            <mdui-button-icon icon="group_add--filled"></mdui-button-icon>
            <div style={{ flexGrow: 1 }}></div>
            <mdui-fab icon="edit--filled"></mdui-fab>
        </mdui-bottom-app-bar>
    );
}
