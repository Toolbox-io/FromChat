/**
 * @fileoverview Authentication system implementation
 * @description Handles user authentication, registration, and session management
 * @author Cursor
 * @version 1.0.0
 */

import { id } from "../utils/utils";

/**
 * Clears all alert messages from authentication forms
 * @private
 */
export function clearAlerts(): void {
    id('login-alerts').innerHTML = '';
    id('register-alerts').innerHTML = '';
}