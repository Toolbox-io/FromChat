/**
 * @fileoverview Authentication system implementation
 * @description Handles user authentication, registration, and session management
 * @author Cursor
 * @version 1.0.0
 */

import type { ErrorResponse, RegisterRequest } from "../core/types";
import { API_BASE_URL } from "../core/config";
import { showLogin } from "../navigation";
import { id } from "../utils/utils";

/**
 * Clears all alert messages from authentication forms
 * @private
 */
export function clearAlerts(): void {
    id('login-alerts').innerHTML = '';
    id('register-alerts').innerHTML = '';
}

/**
 * Shows an alert message in the specified container
 * @param {string} containerId - ID of the container to show the alert in
 * @param {string} message - Alert message to display
 * @param {'success' | 'danger'} type - Type of alert (success or danger)
 */
export function showAlert(containerId: string, message: string, type: "success" | "danger" = 'danger'): void {
    const container = id(containerId);
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    container.appendChild(alertDiv);
}

/**
 * Handles registration form submission
 * @param {Event} e - Form submission event
 * @private
 */
async function handleRegister(e: Event): Promise<void> {
    e.preventDefault();

    const usernameElement = id<HTMLInputElement>('register-username');
    const passwordElement = id<HTMLInputElement>('register-password');
    const confirmPasswordElement = id<HTMLInputElement>('register-confirm-password');
    
    const username = usernameElement.value.trim();
    const password = passwordElement.value.trim();
    const confirmPassword = confirmPasswordElement.value.trim();
    
    if (!username || !password || !confirmPassword) {
        showAlert('register-alerts', 'Пожалуйста, заполните все поля', 'danger');
        return;
    }
    
    if (password !== confirmPassword) {
        showAlert('register-alerts', 'Пароли не совпадают', 'danger');
        return;
    }
    
    if (username.length < 3 || username.length > 20) {
        showAlert('register-alerts', 'Имя пользователя должно быть от 3 до 20 символов', 'danger');
        return;
    }
    
    if (password.length < 5 || password.length > 50) {
        showAlert('register-alerts', 'Пароль должен быть от 5 до 50 символов', 'danger');
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
            showAlert('register-alerts', 'Регистрация прошла успешно! Теперь вы можете войти.', 'success');
            setTimeout(() => {
                showLogin();
            }, 2000);
        } else {
            const data: ErrorResponse = await response.json();
            showAlert('register-alerts', data.message || 'Ошибка при регистрации', 'danger');
        }
    } catch (error) {
        showAlert('register-alerts', 'Ошибка соединения с сервером', 'danger');
    }
}

/**
 * Initializes authentication functionality
 * @private
 */
function init(): void {
    id('register-form-element').addEventListener('submit', handleRegister);
}

init();