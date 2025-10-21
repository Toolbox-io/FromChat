import { useImmer } from "use-immer";
import { AlertsContainer, type Alert, type AlertType, LoadingSpinner } from "./Auth";
import { AuthContainer, AuthHeader } from "./Auth";
import type { ErrorResponse, LoginRequest, LoginResponse } from "@/core/types";
import { ensureKeysOnLogin } from "@/core/api/authApi";
import { API_BASE_URL } from "@/core/config";
import { useEffect, useRef, useState } from "react";
import type { TextField } from "mdui/components/text-field";
import { useAppState } from "@/pages/chat/state";
import { MaterialTextField } from "@/core/components/TextField";
import { initialize, isSupported, startElectronReceiver, subscribe } from "@/core/push-notifications/push-notifications";
import { isElectron } from "@/core/electron/electron";
import { Link, useNavigate } from "react-router-dom";
import "./auth.scss";
import useDownloadAppScreen from "@/core/hooks/useDownloadAppScreen";

export default function LoginPage() {
    const [alerts, updateAlerts] = useImmer<Alert[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const setUser = useAppState(state => state.setUser);
    const navigate = useNavigate();
    const { navigate: navigateDownloadApp } = useDownloadAppScreen();
    if (navigateDownloadApp) return navigateDownloadApp;

    useEffect(() => {  
        document.body.classList.add('auth-page');
        
        return () => {
            document.body.classList.remove('auth-page');
        };
    }, []);

    function showAlert(type: AlertType, message: string) {
        updateAlerts((alerts) => { alerts.push({type: type, message: message}) });
    }

    const usernameElement = useRef<TextField>(null);
    const passwordElement = useRef<TextField>(null);

    return (
        <AuthContainer>
            <AuthHeader icon="login" title="Добро пожаловать!" subtitle="Войдите в свой аккаунт" />
            <div className="auth-body">
                <AlertsContainer alerts={alerts} />

                <form
                    onSubmit={async (e) => {
                        e.preventDefault();

                        if (isLoading) return;

                        const username = usernameElement.current!.value.trim();
                        const password = passwordElement.current!.value.trim();

                        if (!username || !password) {
                            showAlert("danger", "Пожалуйста, заполните все поля");
                            return;
                        }

                        setIsLoading(true);

                        try {
                            const request: LoginRequest = {
                                username: username,
                                password: password
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
                                showAlert("danger", data.message || "Неверное имя пользователя или пароль");
                            }
                        } catch (error) {
                            showAlert("danger", "Ошибка соединения с сервером");
                        } finally {
                            setIsLoading(false);
                        }
                    }}>
                    <div className="form-field-enter">
                        <MaterialTextField
                            label="@Имя пользователя"
                            id="login-username"
                            name="username"
                            variant="outlined"
                            icon="person--filled"
                            autocomplete="username"
                            required
                            disabled={isLoading}
                            ref={usernameElement} />
                    </div>

                    <div className="form-field-enter">
                        <MaterialTextField
                            label="Пароль"
                            id="login-password"
                            name="password"
                            variant="outlined"
                            type="password"
                            toggle-password
                            icon="password--filled"
                            autocomplete="current-password"
                            required
                            disabled={isLoading}
                            ref={passwordElement} />
                    </div>

                    <div className="form-field-enter">
                        <mdui-button type="submit" disabled={isLoading}>
                            {isLoading ? <LoadingSpinner text="Вход..." /> : "Войти"}
                        </mdui-button>
                    </div>
                </form>

                <div className="text-center">
                    <p>
                        Ещё нет аккаунта?
                        <Link to="/register" className="link">
                            Зарегистрируйтесь
                        </Link>
                    </p>
                </div>
            </div>
        </AuthContainer>
    )
}
