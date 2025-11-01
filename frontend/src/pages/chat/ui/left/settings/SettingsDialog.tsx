import { useState, useEffect } from "react";
import { PRODUCT_NAME, API_BASE_URL } from "@/core/config";
import type { DialogProps } from "@/core/types";
import { StyledDialog } from "@/core/components/StyledDialog";
import { initialize, isSupported, startElectronReceiver, stopElectronReceiver, subscribe, unsubscribe } from "@/core/push-notifications/push-notifications";
import { isElectron } from "@/core/electron/electron";
import { useAppState } from "@/pages/chat/state";
import { getAuthHeaders } from "@/core/api/authApi";
import ChangePasswordDialog from "./ChangePasswordDialog";
import { listDevices, revokeDevice, logoutAllOtherDevices, type DeviceInfo } from "@/core/api/devicesApi";
import { useImmer } from "use-immer";
import { MaterialButton, MaterialIconButton, MaterialList, MaterialListItem, MaterialSwitch } from "@/utils/material";

export function SettingsDialog({ isOpen, onOpenChange }: DialogProps) {
    const [activePanel, setActivePanel] = useState("notifications-settings");
    const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(false);
    const [pushSupported, setPushSupported] = useState(false);
    const user = useAppState(state => state.user);
    const logout = useAppState(state => state.logout);
    const [devices, updateDevices] = useImmer<DeviceInfo[]>([]);
    const [cpOpen, setCpOpen] = useState(false);

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
        <>
            <StyledDialog open={isOpen} onOpenChange={onOpenChange} className="settings-dialog">
                <div id="settings-dialog-inner">
                    <div className="header">
                        <MaterialIconButton icon="close" id="settings-close" onClick={() => onOpenChange(false)}></MaterialIconButton>
                        <div className="title">Настройки</div>
                    </div>
                    <div id="settings-menu">
                        <MaterialList>
                            <MaterialListItem
                                icon="notifications--filled"
                                rounded
                                active={activePanel === "notifications-settings"}
                                onClick={() => handlePanelChange("notifications-settings")}
                                style={{ cursor: "pointer" }}
                            >
                                Уведомления
                            </MaterialListItem>
                            <MaterialListItem
                                icon="security--filled"
                                rounded
                                active={activePanel === "security-settings"}
                                onClick={() => handlePanelChange("security-settings")}
                                style={{ cursor: "pointer" }}
                            >
                                Безопасность
                            </MaterialListItem>
                            <MaterialListItem
                                icon="devices--filled"
                                rounded
                                active={activePanel === "devices-settings"}
                                onClick={() => handlePanelChange("devices-settings")}
                                style={{ cursor: "pointer" }}
                            >
                                Устройства
                            </MaterialListItem>
                            <MaterialListItem
                                icon="info--filled"
                                rounded
                                active={activePanel === "about-settings"}
                                onClick={() => handlePanelChange("about-settings")}
                                style={{ cursor: "pointer" }}
                            >
                                О приложении
                            </MaterialListItem>
                        </MaterialList>
                        <div className="screen">
                            <div id="notifications-settings" className={`settings-panel ${activePanel === "notifications-settings" ? "active" : ""}`}>
                                <h3>Уведомления</h3>
                                {pushSupported && (
                                    <MaterialSwitch
                                        checked={pushNotificationsEnabled}
                                        onInput={(e) => handlePushNotificationToggle(e.target.checked)}>
                                        Push уведомления
                                    </MaterialSwitch>
                                )}
                            </div>

                            <div id="security-settings" className={`settings-panel ${activePanel === "security-settings" ? "active" : ""}`}>
                                <h3>Безопасность</h3>
                                <MaterialButton variant="tonal" onClick={() => setCpOpen(true)}>Изменить пароль</MaterialButton>
                            </div>

                            <div id="devices-settings" className={`settings-panel ${activePanel === "devices-settings" ? "active" : ""}`}>
                                <h3>Устройства</h3>
                                <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                                    <MaterialButton variant="tonal" onClick={async () => { if (!user.authToken) return; await logoutAllOtherDevices(user.authToken); const list = await listDevices(user.authToken); updateDevices(() => list); }}>Выйти на всех остальных устройствах</MaterialButton>
                                    <MaterialButton variant="outlined" onClick={async () => { if (!user.authToken) return; await fetch(`${API_BASE_URL}/logout`, { headers: getAuthHeaders(user.authToken) }); logout(); }}>Выйти на этом устройстве</MaterialButton>
                                </div>
                                <MaterialList>
                                    {devices.map((d) => (
                                        <MaterialListItem 
                                            key={d.session_id} 
                                            icon={d.current ? "devices_other--filled" : "devices--filled"} 
                                            rounded 
                                            end-icon={!d.current ? "logout--filled" : undefined} 
                                            onClick={async () => { 
                                                if (!user.authToken || d.current) return; 
                                                await revokeDevice(user.authToken, d.session_id); 
                                                const list = await listDevices(user.authToken); 
                                                updateDevices(() => list); 
                                            }}
                                        >
                                            <div slot="headline">{d.device_name || (d.browser_name || "Браузер")} на {d.os_name || "OS"} {d.current ? " (это устройство)" : ""}</div>
                                            <div slot="description">Последняя активность: {d.last_seen || "—"}</div>
                                        </MaterialListItem>
                                    ))}
                                </MaterialList>
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
            <ChangePasswordDialog isOpen={cpOpen} onOpenChange={setCpOpen} />
        </>
    );
}
