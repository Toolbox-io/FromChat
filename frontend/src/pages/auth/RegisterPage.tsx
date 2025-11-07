import { useImmer } from "use-immer";
import { AuthContainer, AuthHeader } from "./Auth";
import { AlertsContainer, type Alert, type AlertType } from "./Auth";
import { useRef, useState } from "react";
import type { ErrorResponse, RegisterRequest, LoginResponse } from "@/core/types";
import { API_BASE_URL } from "@/core/config";
import { useAppState } from "@/pages/chat/state";
import { MaterialButton } from "@/utils/material";
import { ensureKeysOnLogin, deriveAuthSecret } from "@/core/api/authApi";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import styles from "./auth.module.scss";
import useDownloadAppScreen from "@/core/hooks/useDownloadAppScreen";
import { AuthTextField, type AuthTextFieldHandle } from "./AuthTextField";

const formVariants = {
    initial: {
        opacity: 0
    },
    animate: {
        opacity: 1
    }
};

const formTransition = {
    staggerChildren: 0.1,
    delayChildren: 0.2
};

const fieldVariants = {
    initial: {
        opacity: 0,
        y: 10
    },
    animate: {
        opacity: 1,
        y: 0
    }
};

const fieldTransition = {
    duration: 0.3,
    ease: "easeInOut" as const
};

const buttonVariants = {
    initial: {
        opacity: 0,
        y: 10
    },
    animate: {
        opacity: 1,
        y: 0
    }
};

const buttonTransition = {
    duration: 0.3,
    delay: 0.6,
    ease: "easeInOut" as const
};

export default function RegisterPage() {
    const [alerts, updateAlerts] = useImmer<Alert[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const setUser = useAppState(state => state.setUser);
    const navigate = useNavigate();
    const { navigate: navigateDownloadApp } = useDownloadAppScreen();
    if (navigateDownloadApp) return navigateDownloadApp;

    function showAlert(type: AlertType, message: string) {
        updateAlerts((alerts) => { alerts.push({type: type, message: message}) });
    }

    const displayNameElement = useRef<AuthTextFieldHandle>(null);
    const usernameElement = useRef<AuthTextFieldHandle>(null);
    const passwordElement = useRef<AuthTextFieldHandle>(null);
    const confirmPasswordElement = useRef<AuthTextFieldHandle>(null);

    return (
        <AuthContainer>
            <AuthHeader icon="person_add" title="Регистрация" subtitle="Создайте новый аккаунт" />
            <div className={styles.authBody}>
                <AlertsContainer alerts={alerts} />

                <motion.form 
                    variants={formVariants}
                    initial="initial"
                    animate="animate"
                    transition={formTransition}
                    onSubmit={async (e) => {
                    e.preventDefault();

                    if (isLoading) return;

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

                    setIsLoading(true);

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
                    } finally {
                        setIsLoading(false);
                    }
                }}>
                    <motion.div variants={fieldVariants} transition={fieldTransition}>
                        <AuthTextField
                            label="Отображаемое имя"
                            name="display_name"
                            icon="badge--filled"
                            autocomplete="name"
                            maxlength={64}
                            counter
                            required
                            ref={displayNameElement} />
                    </motion.div>
                    <motion.div variants={fieldVariants} transition={fieldTransition}>
                        <AuthTextField
                            label="@Имя пользователя"
                            name="username"
                            icon="person--filled"
                            autocomplete="username"
                            maxlength={20}
                            counter
                            required
                            ref={usernameElement} />
                    </motion.div>
                    <motion.div variants={fieldVariants} transition={fieldTransition}>
                        <AuthTextField
                            label="Пароль"
                            name="password"
                            type="password"
                            toggle-password
                            icon="password--filled"
                            autocomplete="new-password"
                            required
                            ref={passwordElement} />
                    </motion.div>
                    <motion.div variants={fieldVariants} transition={fieldTransition}>
                        <AuthTextField
                            label="Подтвердите пароль"
                            name="confirm_password"
                            type="password"
                            toggle-password
                            icon="password--filled"
                            autocomplete="new-password"
                            required
                            ref={confirmPasswordElement} />
                    </motion.div>

                    <motion.div variants={buttonVariants} transition={buttonTransition}>
                        <MaterialButton type="submit" disabled={isLoading}>
                            {isLoading ? "Регистрация..." : "Зарегистрироваться"}
                        </MaterialButton>
                    </motion.div>
                </motion.form>

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
