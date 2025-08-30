/**
 * @fileoverview Profile picture upload functionality
 * @description Handles file selection, image cropping, and profile picture upload
 * @author Cursor
 * @version 1.0.0
 */

import type { Dialog } from "mdui/components/dialog";
import { ImageCropper } from './imageCropper';
import { uploadProfilePicture } from './api';
import { loadProfile } from './api';
import { showSuccess, showError } from '../../utils/notification';
import { id } from "../../utils/utils";

/**
 * Global image cropper instance
 */
let cropper: ImageCropper | null = null;

/**
 * Initialization state flag
 */
let isInitialized = false;

let cropperDialog = id<Dialog>('cropper-dialog');
let fileInput = id<HTMLInputElement>('pfp-file-input');
let uploadBtn = id('upload-pfp-btn');
let cropSaveBtn = id('crop-save');
let cropCancelBtn = id('crop-cancel');
let cropperCloseBtn = id('cropper-close');
let cropperArea = id('cropper-area');

/**
 * Opens the image cropper with the selected file
 * @param {File} file - The image file to crop
 * @private
 */
async function openCropper(file: File): Promise<void> {
    // Clear previous cropper
    cropperArea.innerHTML = '';
    
    // Create new cropper
    cropper = new ImageCropper(cropperArea);
    
    // Load image
    await cropper.loadImage(file);
    
    // Open dialog
    cropperDialog.open = true;
}

/**
 * Closes the image cropper and cleans up resources
 * @private
 */
function closeCropper(): void {
    cropperDialog.open = false;
    cropperArea.innerHTML = '';
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
    fileInput.value = '';
}

/**
 * Saves the cropped image and uploads it to the server
 * @private
 */
async function saveCroppedImage(): Promise<void> {
    if (!cropper) return;

    const croppedImageData = cropper.getCroppedImage();
    
    // Convert data URL to blob
    const response = await fetch(croppedImageData);
    const blob = await response.blob();
    
    const result = await uploadProfilePicture(blob);
    
    if (result) {
        // Update profile picture display
        const profilePicture = id<HTMLInputElement>('profile-picture');
        profilePicture.src = `${result.profile_picture_url}?t=${Date.now()}`; // Cache bust
        
        // Close cropper
        closeCropper();
        
        // Show success message
        showSuccess('Фото профиля обновлено!');
    } else {
        showError('Ошибка при загрузке фото');
    }
}

/**
 * Sets up event listeners for upload functionality
 * @private
 */
function setupEventListeners(): void {
    if (isInitialized) return;

    uploadBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
            openCropper(file);
        }
    });

    cropSaveBtn.addEventListener('click', () => {
        saveCroppedImage();
    });

    cropCancelBtn.addEventListener('click', () => {
        closeCropper();
    });

    cropperCloseBtn.addEventListener('click', () => {
        closeCropper();
    });

    isInitialized = true;
}

/**
 * Loads and displays the user's profile picture
 * @async
 */
export async function loadProfilePicture(): Promise<void> {
    const userData = await loadProfile();
    if (userData?.profile_picture) {
        const url = `${userData.profile_picture}?t=${Date.now()}`;

        const profilePicture = id<HTMLImageElement>('profile-picture');
        const profilePicture2 = id<HTMLImageElement>("preview1");
        profilePicture.src = url;
        profilePicture2.src = url;
    }
}

/**
 * Initializes profile upload functionality
 */
export function initializeProfileUpload(): void {
    setupEventListeners();
}
