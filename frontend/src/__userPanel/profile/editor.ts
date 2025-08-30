/**
 * @fileoverview Profile editing functionality
 * @description Handles profile form editing and MDUI text field integration
 * @author Cursor
 * @version 1.0.0
 */

import { updateProfile } from './api';
import { loadProfile } from './api';
import { showSuccess, showError } from '../../utils/notification';
import { TextField } from 'mdui/components/text-field';
import { id } from '../../utils/utils';

let profileForm = id('profile-form')!;
let nicknameField = id<TextField>('username-field');
let descriptionField = id<TextField>('description-field');

/**
 * Initialization state flag
 * @type {boolean}
 */
let isInitialized = false;

/**
 * Sets the username field value
 * @param {string} value - The username value to set
 */
export function setUsernameValue(value: string): void {
    if (nicknameField && nicknameField.value !== undefined) {
        nicknameField.value = value;
    }
}

/**
 * Sets the description field value
 * @param {string} value - The description value to set
 */
export function setDescriptionValue(value: string): void {
    if (descriptionField && descriptionField.value !== undefined) {
        descriptionField.value = value;
    }
}

/**
 * Gets the current username field value
 * @returns {string} The current username value
 */
export function getUsernameValue(): string {
    if (nicknameField && nicknameField.value !== undefined) {
        return nicknameField.value;
    }
    return '';
}

/**
 * Gets the current description field value
 * @returns {string} The current description value
 */
export function getDescriptionValue(): string {
    if (descriptionField && descriptionField.value !== undefined) {
        return descriptionField.value;
    }
    return '';
}

/**
 * Loads profile data from the server and populates the form fields
 */
export async function loadProfileData(): Promise<void> {
    const userData = await loadProfile();
    if (userData) {
        if (userData.nickname) {
            setUsernameValue(userData.nickname);
        }
        if (userData.description) {
            setDescriptionValue(userData.description);
        }
    }
}

/**
 * Handles profile form submission
 * @param {Event} e - Form submission event
 * @private
 */
async function handleFormSubmission(e: Event): Promise<void> {
    e.preventDefault();
    
    const nickname = getUsernameValue();
    const description = getDescriptionValue();
    
    if (nickname || description) {
        const success = await updateProfile({ 
            nickname: nickname || undefined,
            description: description || undefined
        });
        
        if (success) {
            showSuccess('Профиль обновлен!');
        } else {
            showError('Ошибка при обновлении профиля');
        }
    }
}

/**
 * Sets up form submission handler
 * @private
 */
function setupFormHandler(): void {
    if (!isInitialized) {
        profileForm.addEventListener('submit', handleFormSubmission);
        isInitialized = true;
    }
}

/**
 * Initializes profile editor functionality
 */
export function initializeProfileEditor(): void {
    setupFormHandler();
}
