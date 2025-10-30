import { useState, useEffect } from "react";
import { PRODUCT_NAME, API_BASE_URL } from "@/core/config";
import type { DialogProps } from "@/core/types";
import { StyledDialog } from "@/core/components/StyledDialog";
import { initialize, isSupported, startElectronReceiver, stopElectronReceiver, subscribe, unsubscribe } from "@/core/push-notifications/push-notifications";
import { isElectron } from "@/core/electron/electron";
import { useAppState } from "@/pages/chat/state";
import type { Switch } from "mdui/components/switch";
import { getAuthHeaders } from "@/core/api/authApi";
import { changePassword } from "@/core/api/securityApi";
import { listDevices, revokeDevice, logoutAllOtherDevices, type DeviceInfo } from "@/core/api/devicesApi";
import { useImmer } from "use-immer";

export function SettingsDialog({ isOpen, onOpenChange }: DialogProps) {
    const [activePanel, setActivePanel] = useState("notifications-settings");
    const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(false);
    const [pushSupported, setPushSupported] = useState(false);
    const user = useAppState(state => state.user);
    const logout = useAppState(state => state.logout);
    const [devices, updateDevices] = useImmer<DeviceInfo[]>([]);
    const [cpCurrent, setCpCurrent] = useState("");
    const [cpNext, setCpNext] = useState("");
    const [cpConfirm, setCpConfirm] = useState("");
    const [cpLogoutAll, setCpLogoutAll] = useState(true);

    useEffect(() => {
        setPushSupported(isSupported());
        // For Electron, we assume notifications are enabled if supported
        // For web browsers, we check if there's a subscription
        setPushNotificationsEnabled(isSupported());
    }, []);

    useEffect(() => {
        if (activePanel === "devices-settings" && user.authToken) {
            listDevices(user.authToken)
                .then(list => updateDevices(() => list))
                .catch(() => {});
        }
    }, [activePanel, user.authToken, updateDevices]);

    const handlePanelChange = (panelId: string) => {
        setActivePanel(panelId);
    };

    const handlePushNotificationToggle = async (enabled: boolean) => {
        if (!user.authToken) return;

        try {
            if (enabled) {
                const initialized = await initialize();
                if (initialized) {
                    await subscribe(user.authToken);

                    // For Electron, start the notification receiver
                    if (isElectron) {
                        await startElectronReceiver();
                    }

                    setPushNotificationsEnabled(true);
                }
            } else {
                await unsubscribe();

                // For Electron, stop the notification receiver
                if (isElectron) {
                    stopElectronReceiver();
                }

                // Call API to unsubscribe on server (for web browsers)
                await fetch(`${API_BASE_URL}/push/unsubscribe`, {
                    method: "DELETE",
                    headers: getAuthHeaders(user.authToken)
                });
                setPushNotificationsEnabled(false);
            }
        } catch (error) {
            console.error("Failed to toggle notifications:", error);
        }
    };

    return (
        <StyledDialog open={isOpen} onOpenChange={onOpenChange} className="settings-dialog">
            <div id="settings-dialog-inner">
                <div className="header">
                    <mdui-button-icon icon="close" id="settings-close" onClick={() => onOpenChange(false)}></mdui-button-icon>
                    <mdui-top-app-bar-title>Настройки</mdui-top-app-bar-title>
                </div>
                <div id="settings-menu">
                    <mdui-list>
                        <mdui-list-item
                            icon="notifications--filled"
                            rounded
                            active={activePanel === "notifications-settings"}
                            onClick={() => handlePanelChange("notifications-settings")}
                            style={{ cursor: "pointer" }}
                        >
                            Уведомления
                        </mdui-list-item>
                        <mdui-list-item
                            icon="security--filled"
                            rounded
                            active={activePanel === "security-settings"}
                            onClick={() => handlePanelChange("security-settings")}
                            style={{ cursor: "pointer" }}
                        >
                            Безопасность
                        </mdui-list-item>
                        <mdui-list-item
                            icon="devices--filled"
                            rounded
                            active={activePanel === "devices-settings"}
                            onClick={() => handlePanelChange("devices-settings")}
                            style={{ cursor: "pointer" }}
                        >
                            Устройства
                        </mdui-list-item>
                        <mdui-list-item
                            icon="info--filled"
                            rounded
                            active={activePanel === "about-settings"}
                            onClick={() => handlePanelChange("about-settings")}
                            style={{ cursor: "pointer" }}
                        >
                            О приложении
                        </mdui-list-item>
                    </mdui-list>
                    <div className="screen">
                        <div id="notifications-settings" className={`settings-panel ${activePanel === "notifications-settings" ? "active" : ""}`}>
                            <h3>Уведомления</h3>
                            {pushSupported && (
                                <mdui-switch
                                    checked={pushNotificationsEnabled}
                                    onInput={(e) => handlePushNotificationToggle((e.target as Switch).checked)}
                                >
                                    Push уведомления
                                </mdui-switch>
                            )}
                        </div>


                        <div id="security-settings" className={`settings-panel ${activePanel === "security-settings" ? "active" : ""}`}>
                            <h3>Безопасность</h3>
                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                if (!user.authToken || !user.username) return;
                                if (!cpCurrent || !cpNext || cpNext !== cpConfirm) return;
                                try {
                                    await changePassword(user.authToken, user.username, cpCurrent, cpNext, cpLogoutAll);
                                    setCpCurrent("");
                                    setCpNext("");
                                    setCpConfirm("");
                                } catch (err) {
                                    console.error(err);
                                }
                            }}>
                                <mdui-text-field label="Текущий пароль" type="password" value={cpCurrent} onInput={(e: any) => setCpCurrent(e.target.value)} variant="outlined" toggle-password></mdui-text-field>
                                <mdui-text-field label="Новый пароль" type="password" value={cpNext} onInput={(e: any) => setCpNext(e.target.value)} variant="outlined" toggle-password></mdui-text-field>
                                <mdui-text-field label="Подтвердите пароль" type="password" value={cpConfirm} onInput={(e: any) => setCpConfirm(e.target.value)} variant="outlined" toggle-password></mdui-text-field>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <mdui-switch checked={cpLogoutAll} onInput={(e: any) => setCpLogoutAll(e.target.checked)}>Выйти на всех устройствах (кроме текущего)</mdui-switch>
                                    <div style={{ flexGrow: 1 }}></div>
                                    <mdui-button type="submit" variant="tonal">Сохранить</mdui-button>
                                </div>
                            </form>
                        </div>

                        <div id="language-settings" className={`settings-panel ${activePanel === "language-settings" ? "active" : ""}`}>
                            <h3>Язык</h3>
                            <mdui-select label="Выберите язык" variant="outlined">
                                <mdui-menu-item value="ru">Русский</mdui-menu-item>
                                <mdui-menu-item value="en">English</mdui-menu-item>
                                <mdui-menu-item value="es">Español</mdui-menu-item>
                            </mdui-select>
                        </div>

                        <div id="storage-settings" className={`settings-panel ${activePanel === "storage-settings" ? "active" : ""}`}>
                            <h3>Хранилище</h3>
                            <p>Использовано: 2.5 ГБ из 10 ГБ</p>
                            <mdui-linear-progress value={25}></mdui-linear-progress>
                            <mdui-button variant="outlined">Очистить кэш</mdui-button>
                        </div>

                        <div id="devices-settings" className={`settings-panel ${activePanel === "devices-settings" ? "active" : ""}`}>
                            <h3>Устройства</h3>
                            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                                <mdui-button variant="tonal" onClick={async () => { if (!user.authToken) return; await logoutAllOtherDevices(user.authToken); const list = await listDevices(user.authToken); updateDevices(() => list); }}>Выйти на всех остальных устройствах</mdui-button>
                                <mdui-button variant="outlined" onClick={async () => { if (!user.authToken) return; await fetch(`${API_BASE_URL}/logout`, { headers: getAuthHeaders(user.authToken) }); logout(); }}>Выйти на этом устройстве</mdui-button>
                            </div>
                            <mdui-list>
                                {devices.map((d) => (
                                    <mdui-list-item key={d.session_id} icon={d.current ? "devices_other--filled" : "devices--filled"} rounded end-icon={!d.current ? "logout--filled" : undefined} onEndIconClick={async () => { if (!user.authToken || d.current) return; await revokeDevice(user.authToken, d.session_id); const list = await listDevices(user.authToken); updateDevices(() => list); }}>
                                        <div slot="headline">{d.browser_name || "Браузер"} на {d.os_name || "OS"} {d.current ? " (это устройство)" : ""}</div>
                                        <div slot="description">Последняя активность: {d.last_seen || "—"}</div>
                                    </mdui-list-item>
                                ))}
                            </mdui-list>
                        </div>

                        <div id="about-settings" className={`settings-panel ${activePanel === "about-settings" ? "active" : ""}`}>
                            <h3>О приложении</h3>
                            <p>100% open source. Репозиторий на <a href="https://github.com/Toolbox-io/FromChat" target="_blank" rel="noreferrer">GitHub</a>.</p>
                            <p><span className="product-name">{PRODUCT_NAME}</span></p>
                        </div>
                    </div>
                </div>
            </div>
        </StyledDialog>
    );
}
