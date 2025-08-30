/**
 * @fileoverview Profile-specific type definitions
 * @description Contains type definitions for profile-related functionality
 * @author Cursor
 * @version 1.0.0
 */

/**
 * User profile data structure
 * @interface ProfileData
 * @property {string} [profile_picture] - URL to user's profile picture
 * @property {string} [nickname] - User's display name
 * @property {string} [description] - User's bio or description
 */
export interface ProfileData {
    profile_picture?: string;
    nickname?: string;
    description?: string;
}

/**
 * Profile picture upload response structure
 * @interface UploadResponse
 * @property {string} profile_picture_url - URL to the uploaded profile picture
 */
export interface UploadResponse {
    profile_picture_url: string;
}