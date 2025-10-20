import { useState, useEffect, useCallback } from "react";
import { API_BASE_URL } from "@/core/config";

export type UsernameValidationState = "idle" | "checking" | "available" | "unavailable" | "invalid";

export interface UsernameValidationResult {
    state: UsernameValidationState;
    message: string;
    isValid: boolean;
}

export function useUsernameValidation(username: string, debounceMs: number = 500) {
    const [result, setResult] = useState<UsernameValidationResult>({
        state: "idle",
        message: "",
        isValid: false
    });

    const validateUsername = useCallback(async (usernameToCheck: string) => {
        if (!usernameToCheck.trim()) {
            setResult({
                state: "idle",
                message: "",
                isValid: false
            });
            return;
        }

        // Basic format validation
        if (usernameToCheck.length < 3 || usernameToCheck.length > 20) {
            setResult({
                state: "invalid",
                message: "Имя пользователя должно быть от 3 до 20 символов",
                isValid: false
            });
            return;
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(usernameToCheck)) {
            setResult({
                state: "invalid",
                message: "Имя пользователя может содержать только английские буквы, цифры, дефисы и подчеркивания",
                isValid: false
            });
            return;
        }

        setResult({
            state: "checking",
            message: "Проверяем доступность...",
            isValid: false
        });

        try {
            const response = await fetch(`${API_BASE_URL}/check-username`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ username: usernameToCheck })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.available) {
                    setResult({
                        state: "available",
                        message: "Имя пользователя доступно",
                        isValid: true
                    });
                } else {
                    setResult({
                        state: "unavailable",
                        message: "Имя пользователя уже занято",
                        isValid: false
                    });
                }
            } else {
                setResult({
                    state: "unavailable",
                    message: "Ошибка при проверке имени пользователя",
                    isValid: false
                });
            }
        } catch (error) {
            setResult({
                state: "unavailable",
                message: "Ошибка соединения с сервером",
                isValid: false
            });
        }
    }, []);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            validateUsername(username);
        }, debounceMs);

        return () => clearTimeout(timeoutId);
    }, [username, debounceMs, validateUsername]);

    return result;
}
