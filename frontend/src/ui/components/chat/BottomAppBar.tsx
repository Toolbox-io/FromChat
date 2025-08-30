export function BottomAppBar() {
    return (
        <mdui-bottom-app-bar>
            <mdui-button-icon icon="settings--filled" id="settings-open"></mdui-button-icon>
            <mdui-button-icon icon="group_add--filled"></mdui-button-icon>
            <div style={{ flexGrow: 1 }}></div>
            <mdui-fab icon="edit--filled"></mdui-fab>
        </mdui-bottom-app-bar>
    );
}
