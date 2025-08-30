import { useState } from "react";
import { PRODUCT_NAME } from "../../../core/config";
import type { DialogProps } from "../../../core/types";
import { MaterialDialog } from "../Dialog";

export function SettingsDialog({ isOpen, onOpenChange }: DialogProps) {
    const [activePanel, setActivePanel] = useState("notifications-settings");

    const handlePanelChange = (panelId: string) => {
        setActivePanel(panelId);
    };

    return (
        <MaterialDialog close-on-overlay-click close-on-esc fullscreen open={isOpen} onOpenChange={onOpenChange}>
            <div className="fullscreen-wrapper">
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
                                icon="palette--filled" 
                                rounded 
                                active={activePanel === "appearance-settings"}
                                onClick={() => handlePanelChange("appearance-settings")}
                                style={{ cursor: "pointer" }}
                            >
                                Внешний вид
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
                                icon="language--filled" 
                                rounded 
                                active={activePanel === "language-settings"}
                                onClick={() => handlePanelChange("language-settings")}
                                style={{ cursor: "pointer" }}
                            >
                                Язык
                            </mdui-list-item>
                            <mdui-list-item 
                                icon="storage--filled" 
                                rounded 
                                active={activePanel === "storage-settings"}
                                onClick={() => handlePanelChange("storage-settings")}
                                style={{ cursor: "pointer" }}
                            >
                                Хранилище
                            </mdui-list-item>
                            <mdui-list-item 
                                icon="help--filled" 
                                rounded 
                                active={activePanel === "help-settings"}
                                onClick={() => handlePanelChange("help-settings")}
                                style={{ cursor: "pointer" }}
                            >
                                Помощь
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
                                <mdui-switch checked>Новые сообщения</mdui-switch>
                                <mdui-switch checked>Звуковые уведомления</mdui-switch>
                                <mdui-switch>Уведомления о статусе</mdui-switch>
                                <mdui-switch checked>Email уведомления</mdui-switch>
                            </div>
                            
                            <div id="appearance-settings" className={`settings-panel ${activePanel === "appearance-settings" ? "active" : ""}`}>
                                <h3>Внешний вид</h3>
                                <mdui-select label="Тема" variant="outlined">
                                    <mdui-menu-item value="dark">Тёмная</mdui-menu-item>
                                    <mdui-menu-item value="light">Светлая</mdui-menu-item>
                                    <mdui-menu-item value="auto">Авто</mdui-menu-item>
                                </mdui-select>
                                <mdui-select label="Размер шрифта" variant="outlined">
                                    <mdui-menu-item value="small">Маленький</mdui-menu-item>
                                    <mdui-menu-item value="medium">Средний</mdui-menu-item>
                                    <mdui-menu-item value="large">Большой</mdui-menu-item>
                                </mdui-select>
                            </div>
                            
                            <div id="security-settings" className={`settings-panel ${activePanel === "security-settings" ? "active" : ""}`}>
                                <h3>Безопасность</h3>
                                <mdui-button variant="outlined">Изменить пароль</mdui-button>
                                <mdui-button variant="outlined">Двухфакторная аутентификация</mdui-button>
                                <mdui-switch>Автоматический выход</mdui-switch>
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
                            
                            <div id="help-settings" className={`settings-panel ${activePanel === "help-settings" ? "active" : ""}`}>
                                <h3>Помощь</h3>
                                <mdui-button variant="outlined">Руководство пользователя</mdui-button>
                                <mdui-button variant="outlined">Связаться с поддержкой</mdui-button>
                                <mdui-button variant="outlined">FAQ</mdui-button>
                            </div>
                            
                            <div id="about-settings" className={`settings-panel ${activePanel === "about-settings" ? "active" : ""}`}>
                                <h3>О приложении</h3>
                                <p>Версия: 1.0.0</p>
                                <p>© 2025 <span className="product-name">{PRODUCT_NAME}</span>. Все права защищены.</p>
                                <mdui-button variant="outlined">Политика конфиденциальности</mdui-button>
                                <mdui-button variant="outlined">Условия использования</mdui-button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </MaterialDialog>
    );
}
