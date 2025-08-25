import { clearAlerts } from "./auth/auth";
import { loadMessages } from "./chat/chat";
import { id } from "./utils/utils";

const loginForm = id("login-form");
const registerForm = id("register-form");
const chatInterface = id("chat-interface");
const titleBar = id("electron-title-bar");

/**
 * Shows the login form and hides other interfaces.
 */
export function showLogin(): void {
    loginForm.style.display = 'flex';
    registerForm.style.display = 'none';
    chatInterface.style.display = 'none';
    clearAlerts();
    titleBar.classList.add("color-surface");
}

/**
 * Shows the registration form and hides other interfaces.
 */
export function showRegister(): void {
    loginForm.style.display = 'none';
    registerForm.style.display = 'flex';
    chatInterface.style.display = 'none';
    clearAlerts();
    titleBar.classList.add("color-surface");
}

/**
 * Shows the chat interface and hides authentication forms.
 */
export function showChat(): void {
    loginForm.style.display = 'none';
    registerForm.style.display = 'none';
    chatInterface.style.display = 'block';
    loadMessages();
    titleBar.classList.remove("color-surface");
}

/**
 * Loads the chat interface and initializes messaging.
 */
export function loadChat(): void {
    showChat();
    loadMessages();
}