import { useImmer } from "use-immer";
import { AlertsContainer, type Alert, type AlertType } from "../components/Alerts";
import { AuthContainer, AuthHeader } from "../components/Auth";
import type { ErrorResponse, LoginRequest, LoginResponse } from "../../core/types";
import { ensureKeysOnLogin } from "../../auth/crypto";
import { API_BASE_URL } from "../../core/config";
// import { initializeProfile } from "../../userPanel/profile/profile";
import { useRef } from "react";
import type { TextField } from "mdui/components/text-field";
import { useAppState } from "../state";

export default function LoginScreen() {
    const [alerts, updateAlerts] = useImmer<Alert[]>([]);
    const setCurrentPage = useAppState(state => state.setCurrentPage);
    const setUser = useAppState(state => state.setUser);

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
                        
                        const username = usernameElement.current!.value.trim();
                        const password = passwordElement.current!.value.trim();
                        
                        if (!username || !password) {
                            showAlert("danger", "Пожалуйста, заполните все поля");
                            return;
                        }
                        
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
                                
                                setCurrentPage("chat");
                                // initializeProfile(); // Initialize profile after login
                            } else {
                                const data: ErrorResponse = await response.json();
                                showAlert("danger", data.message || "Неверное имя пользователя или пароль");
                            }
                        } catch (error) {
                            showAlert("danger", "Ошибка соединения с сервером");
                        }
                    }}>
                    <mdui-text-field
                        label="Имя пользователя"
                        id="login-username"
                        name="username"
                        variant="outlined"
                        icon="person--filled"
                        autocomplete="username"
                        required
                        ref={usernameElement as React.RefObject<HTMLElement & TextField>}>
                    </mdui-text-field>
                    <mdui-text-field
                        label="Пароль"
                        id="login-password"
                        name="password"
                        variant="outlined"
                        type="password"
                        toggle-password
                        icon="password--filled"
                        autocomplete="current-password"
                        required
                        ref={passwordElement as React.RefObject<HTMLElement & TextField>}>
                    </mdui-text-field>

                    <mdui-button type="submit">Войти</mdui-button>
                </form>
                
                <div className="text-center">
                    <p>
                        Ещё нет аккаунта? 
                        <a
                            href="#"
                            className="link" 
                            onClick={() => setCurrentPage("register")}>
                            Зарегистрируйтесь
                        </a>
                    </p>
                </div>
            </div>
        </AuthContainer>
    )
}