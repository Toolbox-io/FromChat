/**
 * @fileoverview Profile-related API calls
 * @description Handles all profile-related HTTP requests to the backend
 * @author Cursor
 * @version 1.0.0
 */

import { getAuthHeaders } from '../auth';
import type { ProfileData, UploadResponse } from './types';

/**
 * Loads user profile data from the server
 * @async
 * @function loadProfile
 * @returns {Promise<ProfileData | null>} User profile data or null if failed
 * @example
 * const profile = await loadProfile();
 * if (profile) {
 *   console.log('User nickname:', profile.nickname);
 * }
 */
export async function loadProfile(): Promise<ProfileData | null> {
    try {
        const response = await fetch('/api/user/profile', {
            headers: getAuthHeaders()
        });

        if (response.ok) {
            return await response.json();
        }
        
        return null;
    } catch (error) {
        console.error('Error loading profile:', error);
        return null;
    }
}

/**
 * Uploads a profile picture to the server
 * @async
 * @function uploadProfilePicture
 * @param {Blob} file - The image file to upload
 * @returns {Promise<UploadResponse | null>} Upload response with URL or null if failed
 * @example
 * const fileInput = document.getElementById('file-input');
 * const file = fileInput.files[0];
 * const result = await uploadProfilePicture(file);
 * if (result) {
 *   console.log('Uploaded to:', result.profile_picture_url);
 * }
 */
export async function uploadProfilePicture(file: Blob): Promise<UploadResponse | null> {
    try {
        const formData = new FormData();
        formData.append('profile_picture', file, 'profile_picture.jpg');

        const response = await fetch('/api/upload-profile-picture', {
            method: 'POST',
            body: formData,
            headers: getAuthHeaders(false)
        });

        if (response.ok) {
            return await response.json();
        }
        return null;
    } catch (error) {
        console.error('Upload error:', error);
        return null;
    }
}

/**
 * Updates user profile information
 * @async
 * @function updateProfile
 * @param {Partial<ProfileData>} data - Profile data to update
 * @returns {Promise<boolean>} True if update was successful, false otherwise
 * @example
 * const success = await updateProfile({
 *   nickname: 'New Name',
 *   description: 'Updated bio'
 * });
 * if (success) {
 *   console.log('Profile updated successfully');
 * }
 */
export async function updateProfile(data: Partial<ProfileData>): Promise<boolean> {
    try {
        const response = await fetch('/api/user/profile', {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });

        return response.ok;
    } catch (error) {
        console.error('Error updating profile:', error);
        return false;
    }
}

/**
 * Updates user bio
 * @async
 * @function updateBio
 * @param {string} bio - New bio text
 * @returns {Promise<boolean>} True if update was successful, false otherwise
 * @example
 * const success = await updateBio('My new bio text');
 * if (success) {
 *   console.log('Bio updated successfully');
 * }
 */
export async function updateBio(bio: string): Promise<boolean> {
    try {
        const response = await fetch('/api/user/bio', {
            method: 'PUT',
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ bio })
        });

        return response.ok;
    } catch (error) {
        console.error('Error updating bio:', error);
        return false;
    }
}
