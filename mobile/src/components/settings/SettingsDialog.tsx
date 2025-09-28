import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { PRODUCT_NAME, API_BASE_URL } from "../../core/config";
import type { DialogProps } from "../../core/types";
import { MaterialDialog } from "../core/Dialog";
import { initialize, isSupported, subscribe, unsubscribe } from "../../utils/push-notifications";
import { useAppState } from "../../state";
import type { Switch } from "mdui/components/switch";
import { getAuthHeaders } from "../../auth/api";

export function SettingsDialog({ isOpen, onOpenChange }: DialogProps) {
    const [activePanel, setActivePanel] = useState("notifications-settings");
    const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(false);
    const [pushSupported, setPushSupported] = useState(false);
    const user = useAppState(state => state.user);

    useEffect(() => {
        setPushSupported(isSupported());
        // For Electron, we assume notifications are enabled if supported
        // For web browsers, we check if there's a subscription
        setPushNotificationsEnabled(isSupported());
    }, []);

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
                    
                    // Mobile push notifications
                    
                    setPushNotificationsEnabled(true);
                }
            } else {
                await unsubscribe();
                
                // Mobile push notifications stopped
                
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
        <MaterialDialog close-on-overlay-click close-on-esc fullscreen open={isOpen} onOpenChange={onOpenChange} id="settings-dialog">
            <div className="fullscreen-wrapper">
                <div id="settings-dialog-inner">
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => onOpenChange(false)}>
                            <Text style={styles.closeIcon}>✕</Text>
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Настройки</Text>
                    </View>
                    <View style={styles.settingsMenu}>
                        <View style={styles.menuList}>
                            <TouchableOpacity 
                                style={[styles.menuItem, activePanel === "notifications-settings" && styles.activeMenuItem]}
                                onPress={() => handlePanelChange("notifications-settings")}
                            >
                                <Text style={styles.menuItemIcon}>🔔</Text>
                                <Text style={styles.menuItemText}>Уведомления</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.menuItem, activePanel === "appearance-settings" && styles.activeMenuItem]}
                                onPress={() => handlePanelChange("appearance-settings")}
                            >
                                Внешний вид
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.menuItem, activePanel === "security-settings" && styles.activeMenuItem]}
                                onPress={() => handlePanelChange("security-settings")}
                            >
                                Безопасность
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.menuItem, activePanel === "language-settings" && styles.activeMenuItem]}
                                onPress={() => handlePanelChange("language-settings")}
                            >
                                Язык
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.menuItem, activePanel === "storage-settings" && styles.activeMenuItem]}
                                onPress={() => handlePanelChange("storage-settings")}
                            >
                                Хранилище
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.menuItem, activePanel === "help-settings" && styles.activeMenuItem]}
                                onPress={() => handlePanelChange("help-settings")}
                            >
                                Помощь
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.menuItem, activePanel === "about-settings" && styles.activeMenuItem]}
                                onPress={() => handlePanelChange("about-settings")}
                            >
                                О приложении
                            </TouchableOpacity>
                        </View>
                    </View>
                    <div className="screen">
                            <div id="notifications-settings" className={`settings-panel ${activePanel === "notifications-settings" ? "active" : ""}`}>
                                <h3>Уведомления</h3>
                                {pushSupported && (
                                    <View style={styles.switchContainer}>
                                        <Text style={styles.switchLabel}>Push уведомления</Text>
                                        <TouchableOpacity 
                                            style={[styles.switch, pushNotificationsEnabled && styles.switchActive]}
                                            onPress={() => handlePushNotificationToggle(!pushNotificationsEnabled)}
                                        >
                                            <Text style={styles.switchText}>
                                                {pushNotificationsEnabled ? 'ON' : 'OFF'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                                <View style={styles.switchContainer}>
                                    <Text style={styles.switchLabel}>Новые сообщения</Text>
                                    <Text style={styles.switchStatus}>✓</Text>
                                </View>
                                <View style={styles.switchContainer}>
                                    <Text style={styles.switchLabel}>Звуковые уведомления</Text>
                                    <Text style={styles.switchStatus}>✓</Text>
                                </View>
                                <View style={styles.switchContainer}>
                                    <Text style={styles.switchLabel}>Уведомления о статусе</Text>
                                    <Text style={styles.switchStatus}>✗</Text>
                                </View>
                                <View style={styles.switchContainer}>
                                    <Text style={styles.switchLabel}>Email уведомления</Text>
                                    <Text style={styles.switchStatus}>✓</Text>
                                </View>
                            </div>
                            
                            <div id="appearance-settings" className={`settings-panel ${activePanel === "appearance-settings" ? "active" : ""}`}>
                                <h3>Внешний вид</h3>
                                <View style={styles.selectContainer}>
                                    <Text style={styles.selectLabel}>Тема</Text>
                                    <View style={styles.selectOptions}>
                                        <Text style={styles.selectOption}>Тёмная</Text>
                                        <Text style={styles.selectOption}>Светлая</Text>
                                        <Text style={styles.selectOption}>Авто</Text>
                                    </View>
                                </View>
                                <View style={styles.selectContainer}>
                                    <Text style={styles.selectLabel}>Размер шрифта</Text>
                                    <View style={styles.selectOptions}>
                                        <Text style={styles.selectOption}>Маленький</Text>
                                        <Text style={styles.selectOption}>Средний</Text>
                                        <Text style={styles.selectOption}>Большой</Text>
                                    </View>
                                </View>
                            </div>
                            
                            <div id="security-settings" className={`settings-panel ${activePanel === "security-settings" ? "active" : ""}`}>
                                <h3>Безопасность</h3>
                                <TouchableOpacity style={styles.button}>
                                    <Text style={styles.buttonText}>Изменить пароль</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.button}>
                                    <Text style={styles.buttonText}>Двухфакторная аутентификация</Text>
                                </TouchableOpacity>
                                <View style={styles.switchContainer}>
                                    <Text style={styles.switchLabel}>Автоматический выход</Text>
                                    <Text style={styles.switchStatus}>✗</Text>
                                </View>
                            </div>
                            
                            <div id="language-settings" className={`settings-panel ${activePanel === "language-settings" ? "active" : ""}`}>
                                <h3>Язык</h3>
                                <View style={styles.selectContainer}>
                                    <Text style={styles.selectLabel}>Выберите язык</Text>
                                    <View style={styles.selectOptions}>
                                        <Text style={styles.selectOption}>Русский</Text>
                                        <Text style={styles.selectOption}>English</Text>
                                        <Text style={styles.selectOption}>Español</Text>
                                    </View>
                                </View>
                            </div>
                            
                            <div id="storage-settings" className={`settings-panel ${activePanel === "storage-settings" ? "active" : ""}`}>
                                <h3>Хранилище</h3>
                                <Text style={styles.storageText}>Использовано: 2.5 ГБ из 10 ГБ</Text>
                                <View style={styles.progressBar}>
                                    <View style={[styles.progressFill, { width: '25%' }]} />
                                </View>
                                <TouchableOpacity style={styles.button}>
                                    <Text style={styles.buttonText}>Очистить кэш</Text>
                                </TouchableOpacity>
                            </div>
                            
                            <div id="help-settings" className={`settings-panel ${activePanel === "help-settings" ? "active" : ""}`}>
                                <h3>Помощь</h3>
                                <TouchableOpacity style={styles.button}>
                                    <Text style={styles.buttonText}>Руководство пользователя</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.button}>
                                    <Text style={styles.buttonText}>Связаться с поддержкой</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.button}>
                                    <Text style={styles.buttonText}>FAQ</Text>
                                </TouchableOpacity>
                            </div>
                            
                            <div id="about-settings" className={`settings-panel ${activePanel === "about-settings" ? "active" : ""}`}>
                                <h3>О приложении</h3>
                                <p>Версия: 1.0.0</p>
                                <p>© 2025 <span className="product-name">{PRODUCT_NAME}</span>. Все права защищены.</p>
                                <TouchableOpacity style={styles.button}>
                                    <Text style={styles.buttonText}>Политика конфиденциальности</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.button}>
                                    <Text style={styles.buttonText}>Условия использования</Text>
                                </TouchableOpacity>
                            </div>
                        </div>
                    </div>
                </div>
        </MaterialDialog>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    closeIcon: {
        fontSize: 20,
        color: '#666',
        marginRight: 16,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    settingsMenu: {
        flex: 1,
        padding: 16,
    },
    menuList: {
        gap: 8,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: '#f5f5f5',
    },
    activeMenuItem: {
        backgroundColor: '#e3f2fd',
    },
    menuItemIcon: {
        fontSize: 20,
        marginRight: 12,
    },
    menuItemText: {
        fontSize: 16,
        color: '#333',
    },
    switchContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    switchLabel: {
        fontSize: 16,
        color: '#333',
    },
    switch: {
        backgroundColor: '#f0f0f0',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    switchActive: {
        backgroundColor: '#1976d2',
    },
    switchText: {
        fontSize: 12,
        color: '#666',
        fontWeight: 'bold',
    },
    switchStatus: {
        fontSize: 16,
        color: '#4caf50',
        fontWeight: 'bold',
    },
    selectContainer: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    selectLabel: {
        fontSize: 16,
        color: '#333',
        marginBottom: 8,
    },
    selectOptions: {
        flexDirection: 'row',
        gap: 12,
    },
    selectOption: {
        fontSize: 14,
        color: '#666',
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#f5f5f5',
        borderRadius: 4,
    },
    button: {
        backgroundColor: '#f5f5f5',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 8,
        marginVertical: 4,
    },
    buttonText: {
        fontSize: 16,
        color: '#333',
        textAlign: 'center',
    },
    storageText: {
        fontSize: 16,
        color: '#333',
        marginBottom: 8,
    },
    progressBar: {
        height: 8,
        backgroundColor: '#f0f0f0',
        borderRadius: 4,
        marginBottom: 16,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#1976d2',
    },
});
