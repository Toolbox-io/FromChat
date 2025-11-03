import { useImmer } from "use-immer";
import { AlertsContainer, type Alert, type AlertType } from "./Auth";
import { AuthContainer, AuthHeader } from "./Auth";
import type { ErrorResponse, LoginRequest, LoginResponse } from "@/core/types";
import { ensureKeysOnLogin, deriveAuthSecret } from "@/core/api/authApi";
import { API_BASE_URL } from "@/core/config";
import { useRef } from "react";
import type { TextField } from "mdui/components/text-field";
import { useAppState } from "@/pages/chat/state";
import { initialize, isSupported, startElectronReceiver, subscribe } from "@/core/push-notifications/push-notifications";
import { isElectron } from "@/core/electron/electron";
import { useNavigate } from "react-router-dom";
import styles from "./auth.module.scss";
import useDownloadAppScreen from "@/core/hooks/useDownloadAppScreen";
import { MaterialButton, MaterialTextField } from "@/utils/material";

export default function LoginPage() {
    const [alerts, updateAlerts] = useImmer<Alert[]>([]);
    const setUser = useAppState(state => state.setUser);
    const navigate = useNavigate();
    const { navigate: navigateDownloadApp } = useDownloadAppScreen();
    if (navigateDownloadApp) return navigateDownloadApp;

    function showAlert(type: AlertType, message: string) {
        updateAlerts((alerts) => { alerts.push({type: type, message: message}) });
    }

    const usernameElement = useRef<TextField>(null);
    const passwordElement = useRef<TextField>(null);

    return (
        <AuthContainer>
            <AuthHeader icon="login" title="Добро пожаловать!" subtitle="Войдите в свой аккаунт" />
            <div className={styles.authBody}>
                <AlertsContainer alerts={alerts} />

                <form
                    onSubmit={async (e) => {
                        e.preventDefault();

                        const username = usernameElement.current!.value.trim();
                        const password = passwordElement.current!.value.trim();

                        if (!username || !password) {
                            showAlert("danger", "Пожалуйста, заполните все поля");
                            return;
                        }

                        try {
                            const derived = await deriveAuthSecret(username, password);
                            const request: LoginRequest = {
                                username: username,
                                password: derived
                            }

                            const response = await fetch(`${API_BASE_URL}/login`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify(request)
                            });

                            if (response.ok) {
                                const data: LoginResponse = await response.json();
                                // Store the JWT token first
                                setUser(data.token, data.user);

                                // Setup keys with the token we just received
                                try {
                                    await ensureKeysOnLogin(password, data.token);
                                } catch (e) {
                                    console.error("Key setup failed:", e);
                                }

                                navigate("/chat");

                                // Initialize notifications
                                try {
                                    if (isSupported()) {
                                        const initialized = await initialize();
                                        if (initialized) {
                                            await subscribe(data.token);

                                            // For Electron, start the notification receiver
                                            if (isElectron) {
                                                await startElectronReceiver();
                                            }

                                            console.log("Notifications enabled");
                                        } else {
                                            console.log("Notification permission denied");
                                        }
                                    } else {
                                        console.log("Notifications not supported");
                                    }
                                } catch (e) {
                                    console.error("Notification setup failed:", e);
                                }
                            } else {
                                const data: ErrorResponse = await response.json();
                                
                                // Check for suspension
                                if (response.status === 403 && response.headers.get("suspension_reason")) {
                                    const suspensionReason = response.headers.get("suspension_reason");
                                    const setSuspended = useAppState.getState().setSuspended;
                                    setSuspended(suspensionReason || "No reason provided");
                                    return; // Don't show alert, SuspensionDialog will be shown
                                }
                                
                                showAlert("danger", data.message || "Неверное имя пользователя или пароль");
                            }
                        } catch (error) {
                            showAlert("danger", "Ошибка соединения с сервером");
                        }
                    }}>
                    
                    <MaterialTextField
                        label="@Имя пользователя"
                        name="username"
                        variant="outlined"
                        icon="person--filled"
                        autocomplete="username"
                        required
                        ref={usernameElement} />

                    <MaterialTextField
                        label="Пароль"
                        name="password"
                        variant="outlined"
                        type="password"
                        toggle-password
                        icon="password--filled"
                        autocomplete="current-password"
                        required
                        ref={passwordElement} />

                    <MaterialButton type="submit">Войти</MaterialButton>
                </form>

                <div className="text-center">
                    <p>
                        Ещё нет аккаунта?
                        <a
                            href="#"
                            className="link"
                            onClick={() => navigate("/register")}>
                            Зарегистрируйтесь
                        </a>
                    </p>
                </div>
            </div>
        </AuthContainer>
    )
}
