import { API_BASE_URL } from "../core/config";
import { getAuthHeaders } from "../auth/api";
import type { UserProfile } from "../core/types";

/**
 * Fetch user profile
 */
export async function fetchUserProfile(
    userId: number,
    token: string
): Promise<UserProfile> {
    const headers = getAuthHeaders(token, true);
    const response = await fetch(`${API_BASE_URL}/profile/${userId}`, {
        headers,
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch user profile: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Update user profile
 */
export async function updateUserProfile(
    profile: Partial<UserProfile>,
    token: string
): Promise<UserProfile> {
    const headers = getAuthHeaders(token, true);
    const response = await fetch(`${API_BASE_URL}/profile`, {
        method: 'PUT',
        headers: {
            ...headers,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(profile),
    });

    if (!response.ok) {
        throw new Error(`Failed to update user profile: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Upload profile picture
 */
export async function uploadProfilePicture(
    imageUri: string,
    token: string
): Promise<string> {
    const formData = new FormData();
    formData.append('file', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'profile.jpg',
    } as any);

    const headers = getAuthHeaders(token, true);
    const response = await fetch(`${API_BASE_URL}/profile/picture`, {
        method: 'POST',
        headers: {
            ...headers,
            'Content-Type': 'multipart/form-data',
        },
        body: formData,
    });

    if (!response.ok) {
        throw new Error(`Failed to upload profile picture: ${response.statusText}`);
    }

    const result = await response.json();
    return result.picture_url;
}