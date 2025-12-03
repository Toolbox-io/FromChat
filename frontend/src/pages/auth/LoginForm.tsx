import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, type Transition, type Variants } from "motion/react";
import { useImmer } from "use-immer";
import type { LoginRequest } from "@/core/types";
import { useUserStore } from "@/state/user";
import { MaterialButton } from "@/utils/material";
import api from "@/core/api";
import { AuthTextField, type AuthTextFieldHandle } from "./AuthTextField";
import { initialize, isSupported, startElectronReceiver, subscribe } from "@/core/push-notifications/push-notifications";
import { isElectron } from "@/core/electron/electron";
import type { Alert, AlertType } from "./Auth";
import { AuthHeader, AlertsContainer } from "./Auth";
import styles from "./auth.module.scss";
import { ensureAuthenticated } from "@/core/websocket";

const loginFieldVariants: Variants = {
    initial: {
        opacity: 0,
        y: 10
    },
    animate: {
        opacity: 1,
        y: 0
    }
};

const loginFieldTransition: Transition = {
    duration: 0.3,
    ease: "easeInOut"
};

const loginButtonVariants: Variants = {
    initial: {
        opacity: 0,
        y: 10
    },
    animate: {
        opacity: 1,
        y: 0
    }
};

const loginButtonTransition: Transition = {
    duration: 0.3,
    delay: 0.4,
    ease: "easeInOut"
};

interface LoginFormProps {
    onSwitchMode: () => void;
}

export function LoginForm({ onSwitchMode }: LoginFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [alerts, updateAlerts] = useImmer<Alert[]>([]);
    const setUser = useUserStore(state => state.setUser);
    const navigate = useNavigate();

    function showAlert(type: AlertType, message: string) {
        updateAlerts((alerts) => { alerts.push({type: type, message: message}) });
    }

    const usernameElement = useRef<AuthTextFieldHandle>(null);
    const passwordElement = useRef<AuthTextFieldHandle>(null);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (isLoading) return;

        const username = usernameElement.current!.value.trim();
        const password = passwordElement.current!.value.trim();

        if (!username || !password) {
            showAlert("danger", "Пожалуйста, заполните все поля");
            return;
        }

        setIsLoading(true);

        console.log("========================================");
        console.log("[LoginForm] 🚀 LOGIN FORM SUBMITTED");
        console.log("[LoginForm] Username:", username);
        console.log("[LoginForm] Has password:", !!password);
        console.log("========================================");

        try {
            console.log("[LoginForm] Deriving auth secret...");
            const derived = await api.user.auth.deriveAuthSecret(username, password);
            const request: LoginRequest = {
                username: username,
                password: derived
            }

            try {
                console.log("[LoginForm] Calling login API...");
                const data = await api.user.auth.login(request);
                console.log("[LoginForm] Login successful, user ID:", data.user?.id);
                
                setUser(data.token, data.user);

                try {
                    console.log("[LoginForm] Ensuring keys on login...");
                    await api.user.auth.ensureKeysOnLogin(password, data.token);
                    console.log("[LoginForm] Keys ensured");
                    
                    // Initialize Signal Protocol after keys are set up (non-blocking)
                    if (data.user?.id) {
                        console.log("[LoginForm] ✅ User ID exists, scheduling Signal Protocol initialization");
                        // Run Signal Protocol initialization in background to avoid blocking navigation
                        // Use setTimeout to ensure it runs even if navigation happens
                        setTimeout(async () => {
                            try {
                                console.log("[LoginForm] 🚀 Starting Signal Protocol initialization...");
                                const { initializeSignalProtocol } = await import("@/utils/crypto/signalProtocolInit");
                                await initializeSignalProtocol({
                                    userId: data.user!.id.toString(),
                                    password,
                                    token: data.token,
                                    restoreSessions: true,
                                    uploadSessions: true
                                });
                                console.log("[LoginForm] ✅ Signal Protocol initialization completed");
                            } catch (e) {
                                console.error("[LoginForm] ❌ Signal Protocol initialization failed:", e);
                                console.error("[LoginForm] Error details:", {
                                    message: e instanceof Error ? e.message : String(e),
                                    stack: e instanceof Error ? e.stack : undefined
                                });
                            }
                        }, 0);
                        console.log("[LoginForm] ✅ Signal Protocol initialization scheduled");
                    } else {
                        console.warn("[LoginForm] ⚠️ No user ID, skipping Signal Protocol initialization");
                    }
                } catch (e) {
                    console.error("[LoginForm] ❌ Key setup failed:", e);
                    console.error("[LoginForm] Error details:", {
                        message: e instanceof Error ? e.message : String(e),
                        stack: e instanceof Error ? e.stack : undefined
                    });
                }

                // Ensure WebSocket is connected and authenticated
                try {
                    await ensureAuthenticated();
                } catch (e) {
                    console.error("WebSocket authentication failed:", e);
                }

                navigate("/chat");

                try {
                    if (isSupported()) {
                        const initialized = await initialize();
                        if (initialized) {
                            await subscribe(data.token);

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
            } catch (error: any) {
                if (error.message && error.message.includes("suspension")) {
                    const setSuspended = useUserStore.getState().setSuspended;
                    setSuspended(error.message || "No reason provided");
                    return;
                }
                showAlert("danger", error.message || "Неверное имя пользователя или пароль");
            }
        } catch (error: any) {
            showAlert("danger", error.message || "Ошибка соединения с сервером");
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <>
            <AuthHeader 
                icon="login" 
                title="Добро пожаловать!" 
                subtitle="Войдите в свой аккаунт" 
            />
            <div className={styles.authBody}>
                <AlertsContainer alerts={alerts} />
                <motion.form onSubmit={handleSubmit}>
                    <motion.div
                        initial="initial"
                        animate="animate"
                        variants={loginFieldVariants}
                        transition={loginFieldTransition}
                    >
                        <AuthTextField
                            label="@Имя пользователя"
                            name="username"
                            icon="person--filled"
                            autocomplete="username"
                            required
                            ref={usernameElement} />
                    </motion.div>

                    <motion.div
                        initial="initial"
                        animate="animate"
                        variants={loginFieldVariants}
                        transition={loginFieldTransition}
                    >
                        <AuthTextField
                            label="Пароль"
                            name="password"
                            type="password"
                            toggle-password
                            icon="password--filled"
                            autocomplete="current-password"
                            required
                            ref={passwordElement} />
                    </motion.div>

                    <div className={styles.authButtons}>
                        <motion.div
                            initial="initial"
                            animate="animate"
                            variants={loginButtonVariants}
                            transition={loginButtonTransition}
                        >
                            <MaterialButton type="submit" disabled={isLoading}>
                                {isLoading ? "Вход..." : "Войти"}
                            </MaterialButton>
                        </motion.div>
                    </div>
                </motion.form>

                <p className={styles.registerLink}>
                    Ещё нет аккаунта?
                    <a
                        href="#"
                        className="link"
                        onClick={(e) => {
                            e.preventDefault();
                            onSwitchMode();
                        }}>
                        Зарегистрируйтесь
                    </a>
                </p>
            </div>
        </>
    );
}

