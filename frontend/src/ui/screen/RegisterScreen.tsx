import { useImmer } from "use-immer";
// import { showLogin } from "../../navigation";
import { AuthContainer, AuthHeader } from "../components/Auth";
import { AlertsContainer, type Alert, type AlertType } from "../components/Alerts";
import { useRef } from "react";
import { TextField } from "mdui/components/text-field";
import type { ErrorResponse, RegisterRequest } from "../../core/types";
import { API_BASE_URL } from "../../core/config";
import { delay } from "../../utils/utils";
import { useAppState } from "../state";
import { MaterialTextField } from "../components/core/TextField";

export default function RegisterScreen() {
    const [alerts, updateAlerts] = useImmer<Alert[]>([]);
    const setCurrentPage = useAppState(state => state.setCurrentPage);

    function showAlert(type: AlertType, message: string) {
        updateAlerts((alerts) => { alerts.push({type: type, message: message}) });
    }

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
                    
                    const username = usernameElement.current!.value.trim();
                    const password = passwordElement.current!.value.trim();
                    const confirmPassword = confirmPasswordElement.current!.value.trim();
                    
                    if (!username || !password || !confirmPassword) {
                        showAlert("danger", "Пожалуйста, заполните все поля");
                        return;
                    }
                    
                    if (password !== confirmPassword) {
                        showAlert("danger", "Пароли не совпадают");
                        return;
                    }
                    
                    if (username.length < 3 || username.length > 20) {
                        showAlert("danger", "Имя пользователя должно быть от 3 до 20 символов");
                        return;
                    }
                    
                    if (password.length < 5 || password.length > 50) {
                        showAlert("danger", "Пароль должен быть от 5 до 50 символов");
                        return;
                    }
                    
                    try {
                        const request: RegisterRequest = {
                            username: username,
                            password: password,
                            confirm_password: confirmPassword
                        }
                
                        const response = await fetch(`${API_BASE_URL}/register`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(request)
                        });
                        
                        if (response.ok) {
                            // Registration successful
                            showAlert("success", "Регистрация прошла успешно! Теперь вы можете войти.");
                            await delay(2000);
                            setCurrentPage("login");
                        } else {
                            const data: ErrorResponse = await response.json();
                            showAlert("danger", data.message || "Ошибка при регистрации");
                        }
                    } catch (error) {
                        showAlert("danger", "Ошибка соединения с сервером");
                    }
                }}>
                    <MaterialTextField
                        label="Имя пользователя" 
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
                            onClick={() => setCurrentPage("login")}>
                            Войдите
                        </a>
                    </p>
                </div>
            </div>
        </AuthContainer>
    )
}