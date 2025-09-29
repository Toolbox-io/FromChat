import { getAuthHeaders } from "../auth/api";
import { API_BASE_URL } from "../core/config";
import type { UserProfile } from "../core/types";

export interface ProfileData {
    profile_picture?: string;
    nickname?: string;
    description?: string;
}

export interface UploadResponse {
    profile_picture_url: string;
}

/**
 * Loads user profile data from the server
 */
export async function loadProfile(token: string): Promise<ProfileData | null> {
    try {
        const response = await fetch(`${API_BASE_URL}/user/profile`, {
            headers: getAuthHeaders(token)
        });

        if (response.ok) {
            const data = await response.json();
            // Map backend fields to frontend fields
            return {
                profile_picture: data.profile_picture,
                nickname: data.username,
                description: data.bio
            };
        }
        
        return null;
    } catch (error) {
        console.error('Error loading profile:', error);
        return null;
    }
}

/**
 * Uploads a profile picture to the server
 */
export async function uploadProfilePicture(token: string, file: Blob): Promise<UploadResponse | null> {
    try {
        const formData = new FormData();
        formData.append('profile_picture', file, 'profile_picture.jpg');

        const response = await fetch(`${API_BASE_URL}/upload-profile-picture`, {
            method: 'POST',
            body: formData,
            headers: getAuthHeaders(token, false)
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
 */
export async function updateProfile(token: string, data: Partial<ProfileData>): Promise<boolean> {
    try {
        // Map frontend fields to backend fields
        const backendData = {
            nickname: data.nickname,
            description: data.description
        };

        const response = await fetch(`${API_BASE_URL}/user/profile`, {
            method: 'PUT',
            headers: {
                ...getAuthHeaders(token),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(backendData)
        });

        return response.ok;
    } catch (error) {
        console.error('Error updating profile:', error);
        return false;
    }
}

/**
 * Updates user bio
 */
export async function updateBio(token: string, bio: string): Promise<boolean> {
    try {
        const response = await fetch(`${API_BASE_URL}/user/bio`, {
            method: 'PUT',
            headers: getAuthHeaders(token),
            body: JSON.stringify({ bio })
        });

        return response.ok;
    } catch (error) {
        console.error('Error updating bio:', error);
        return false;
    }
}

/**
 * Fetches user profile data by username
 */
export async function fetchUserProfile(token: string, username: string): Promise<UserProfile | null> {
    try {
        const response = await fetch(`${API_BASE_URL}/user/${username}`, {
            headers: getAuthHeaders(token)
        });

        if (response.ok) {
            return await response.json();
        }
        
        return null;
    } catch (error) {
        console.error('Error fetching user profile:', error);
        return null;
    }
}
