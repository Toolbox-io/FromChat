import { useImmer } from "use-immer";
import { AuthContainer, AuthHeader } from "./Auth";
import { AlertsContainer, type Alert, type AlertType } from "./Auth";
import { useRef } from "react";
import { TextField } from "mdui/components/text-field";
import type { ErrorResponse, RegisterRequest, LoginResponse } from "@/core/types";
import { API_BASE_URL } from "@/core/config";
import { useAppState } from "@/pages/chat/state";
import { MaterialTextField } from "@/core/components/MaterialTextField";
import { ensureKeysOnLogin, deriveAuthSecret } from "@/core/api/authApi";
import { useNavigate } from "react-router-dom";
import "./auth.scss";
import useDownloadAppScreen from "@/core/hooks/useDownloadAppScreen";

export default function RegisterPage() {
    const [alerts, updateAlerts] = useImmer<Alert[]>([]);
    const setUser = useAppState(state => state.setUser);
    const navigate = useNavigate();
    const { navigate: navigateDownloadApp } = useDownloadAppScreen();
    if (navigateDownloadApp) return navigateDownloadApp;

    function showAlert(type: AlertType, message: string) {
        updateAlerts((alerts) => { alerts.push({type: type, message: message}) });
    }

    const displayNameElement = useRef<TextField>(null);
    const usernameElement = useRef<TextField>(null);
    const passwordElement = useRef<TextField>(null);
    const confirmPasswordElement = useRef<TextField>(null);

    return (
        <AuthContainer>
            <AuthHeader icon="person_add" title="Регистрация" subtitle="Создайте новый аккаунт" />
            <div className="auth-body">
                <AlertsContainer alerts={alerts} />

                <form onSubmit={async (e) => {
                    e.preventDefault();

                    const displayName = displayNameElement.current!.value.trim();
                    const username = usernameElement.current!.value.trim();
                    const password = passwordElement.current!.value.trim();
                    const confirmPassword = confirmPasswordElement.current!.value.trim();

                    if (!displayName || !username || !password || !confirmPassword) {
                        showAlert("danger", "Пожалуйста, заполните все поля");
                        return;
                    }

                    if (password !== confirmPassword) {
                        showAlert("danger", "Пароли не совпадают");
                        return;
                    }

                    if (displayName.length < 1 || displayName.length > 64) {
                        showAlert("danger", "Отображаемое имя должно быть от 1 до 64 символов");
                        return;
                    }

                    if (username.length < 3 || username.length > 20) {
                        showAlert("danger", "Имя пользователя должно быть от 3 до 20 символов");
                        return;
                    }

                    // Validate username format (only English letters, numbers, dashes, underscores)
                    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
                        showAlert("danger", "Имя пользователя может содержать только английские буквы, цифры, дефисы и подчеркивания");
                        return;
                    }

                    if (password.length < 5 || password.length > 50) {
                        showAlert("danger", "Пароль должен быть от 5 до 50 символов");
                        return;
                    }

                    try {
                        const derived = await deriveAuthSecret(username, password);
                        const request: RegisterRequest = {
                            display_name: displayName,
                            username: username,
                            password: derived,
                            confirm_password: derived
                        }

                        const response = await fetch(`${API_BASE_URL}/register`, {
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
                        } else {
                            const data: ErrorResponse = await response.json();
                            showAlert("danger", data.message || "Ошибка при регистрации");
                        }
                    } catch (error) {
                        showAlert("danger", "Ошибка соединения с сервером");
                    }
                }}>
                    <MaterialTextField
                        label="Отображаемое имя"
                        id="register-display-name"
                        name="display_name"
                        variant="outlined"
                        icon="badge--filled"
                        autocomplete="name"
                        maxlength={64}
                        counter
                        required
                        ref={displayNameElement} />
                    <MaterialTextField
                        label="@Имя пользователя"
                        id="register-username"
                        name="username"
                        variant="outlined"
                        icon="person--filled"
                        autocomplete="username"
                        maxlength={20}
                        counter
                        required
                        ref={usernameElement} />
                    <MaterialTextField
                        label="Пароль"
                        id="register-password"
                        name="password"
                        variant="outlined"
                        type="password"
                        toggle-password
                        icon="password--filled"
                        autocomplete="new-password"
                        required
                        ref={passwordElement} />
                    <MaterialTextField
                        label="Подтвердите пароль"
                        id="register-confirm-password"
                        name="confirm_password"
                        variant="outlined"
                        type="password"
                        toggle-password
                        icon="password--filled"
                        autocomplete="new-password"
                        required
                        ref={confirmPasswordElement} />

                    <mdui-button type="submit">Зарегистрироваться</mdui-button>
                </form>

                <div className="text-center">
                    <p>
                        Уже есть аккаунт?
                        <a
                            href="#"
                            id="login-link"
                            className="link"
                            onClick={() => navigate("/login")}>
                            Войдите
                        </a>
                    </p>
                </div>
            </div>
        </AuthContainer>
    )
}
