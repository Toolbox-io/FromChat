/**
 * @fileoverview User profile dialog functionality
 * @description Handles displaying user profiles in a modal dialog
 * @author Cursor
 * @version 1.0.0
 */

import { getAuthHeaders, currentUser } from "../auth/api";
import { API_BASE_URL } from "../core/config";
import type { UserProfile } from "../core/types";
import { showError, showSuccess } from "../utils/notification";
import { delay, formatTime, id } from "../utils/utils";
import defaultAvatar from "../resources/images/default-avatar.png";
import type { Dialog } from "mdui/components/dialog";
import type { TextField } from "mdui/components/text-field";


let dialog = id<Dialog>("user-profile-dialog");
let currentProfile: UserProfile | null = null;
let isOwnProfile: boolean = false;

function init() {
    bindEvents();
}

/**
 * Binds event listeners
 * @private
 */
function bindEvents(): void {
    // Edit bio events
    const editBioBtn = dialog?.querySelector('#edit-bio-btn');
    const saveBioBtn = dialog?.querySelector('#save-bio-btn');
    const cancelBioBtn = dialog?.querySelector('#cancel-bio-btn');

    editBioBtn?.addEventListener('click', () => startEditBio());
    saveBioBtn?.addEventListener('click', () => saveBio());
    cancelBioBtn?.addEventListener('click', () => cancelEditBio());

    // DM button event
    const dmButton = dialog?.querySelector('#dm-button');
    dmButton?.addEventListener('click', () => startDm());
}

/**
 * Starts a direct message conversation
 * @private
 */
async function startDm(): Promise<void> {
    if (!currentProfile || isOwnProfile) return;
    
    // Hide the profile dialog
    hide();
    
    // Switch to DMs tab
    const tabs = document.querySelector('.chat-tabs mdui-tabs') as any;
    if (tabs) {
        tabs.value = 'dms';
    }
    
    // Find and click on the user in the DM users list
    await delay(100);
    const dmUsersList = document.getElementById("dm-users");
    if (dmUsersList) {
        const userItems = dmUsersList.querySelectorAll('mdui-list-item');
        for (const item of userItems) {
            const headline = item.getAttribute('headline');
            if (headline === currentProfile?.username) {
                (item as HTMLElement).click();
                break;
            }
        }
    }
}

/**
 * Shows the profile dialog for a specific user
 * @param {string} username - Username to show profile for
 */
export async function show(username: string): Promise<void> {
    if (!dialog) return;

    try {
        const response = await fetch(`${API_BASE_URL}/user/${username}`, {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to load user profile');
        }

        const profile: UserProfile = await response.json();
        currentProfile = profile;
        isOwnProfile = profile.username === currentUser?.username;
        populateDialog(profile);
        dialog.open = true;

    } catch (error) {
        showError('Failed to load user profile');
        console.error('Error loading user profile:', error);
    }
}

/**
 * Populates the dialog with user data
 * @param {UserProfile} profile - User profile data
 * @private
 */
function populateDialog(profile: UserProfile): void {
    if (!dialog) return;

    // Profile picture
    const profilePic = dialog.querySelector('.profile-picture') as HTMLImageElement;
    profilePic.src = profile.profile_picture || defaultAvatar;

    let errorLock = false

    profilePic.addEventListener("error", () => {
        if (!errorLock) {
            profilePic.src = defaultAvatar;
            errorLock = true;
        }
    });

    // Username
    const usernameEl = dialog.querySelector('.username') as HTMLElement;
    usernameEl.textContent = profile.username;

    // Online status
    const onlineStatus = dialog.querySelector('.online-status') as HTMLElement;
    if (profile.online) {
        onlineStatus.innerHTML = '<span class="online-indicator"></span> Online';
        onlineStatus.classList.add("online-status", "online");
    } else {
        onlineStatus.innerHTML = `<span class="offline-indicator"></span> Last seen ${formatTime(profile.last_seen)}`;
        onlineStatus.classList.add("online-status", "offline");
    }

    // Bio
    const bioDisplay = dialog.querySelector('.bio-display') as HTMLElement;
    const bioEdit = dialog.querySelector('#bio-edit-field') as TextField;
    
    if (profile.bio) {
        bioDisplay.textContent = profile.bio;
    } else {
        bioDisplay.textContent = isOwnProfile ? 'No bio yet. Click "Edit Bio" to add one!' : 'No bio available.';
    }

    if (bioEdit) {
        bioEdit.value = profile.bio || '';
    }

    // Stats
    const memberSince = dialog.querySelector('.member-since') as HTMLElement;
    const lastSeen = dialog.querySelector('.last-seen') as HTMLElement;
    
    memberSince.textContent = formatTime(profile.created_at);
    lastSeen.textContent = formatTime(profile.last_seen);
}

/**
 * Starts editing the bio
 * @private
 */
function startEditBio(): void {
    if (!dialog) return;

    const bioDisplay = dialog.querySelector('.bio-display') as HTMLElement;
    const bioEdit = dialog.querySelector('#bio-edit-field') as TextField;
    const bioActions = dialog.querySelector('.bio-actions') as HTMLElement;
    const editBioBtn = dialog.querySelector('#edit-bio-btn') as HTMLElement;

    bioDisplay.style.display = 'none';
    if (bioEdit) bioEdit.style.display = 'block';
    bioActions.style.display = 'flex';
    editBioBtn.style.display = 'none';

    if (bioEdit) {
        bioEdit.focus();
        bioEdit.setSelectionRange(bioEdit.value.length, bioEdit.value.length);
    }
}

/**
 * Saves the bio
 * @private
 */
export async function saveBio(): Promise<void> {
    if (!dialog || !currentProfile) return;

    const bioEdit = dialog.querySelector('#bio-edit-field') as TextField;
    const newBio = bioEdit?.value?.trim() || '';

    try {
        const response = await fetch(`${API_BASE_URL}/user/bio`, {
            method: 'PUT',
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ bio: newBio })
        });

        if (!response.ok) {
            throw new Error('Failed to update bio');
        }

        const result = await response.json();
        currentProfile.bio = result.bio;
        populateDialog(currentProfile);
        cancelEditBio();
        showSuccess('Bio updated successfully');

    } catch (error) {
        showError('Failed to update bio');
        console.error('Error updating bio:', error);
    }
}

/**
 * Cancels bio editing
 * @private
 */
function cancelEditBio(): void {
    if (!dialog) return;

    const bioDisplay = dialog.querySelector('.bio-display') as HTMLElement;
    const bioEdit = dialog.querySelector('#bio-edit-field') as TextField;
    const bioActions = dialog.querySelector('.bio-actions') as HTMLElement;
    const editBioBtn = dialog.querySelector('#edit-bio-btn') as HTMLElement;

    bioDisplay.style.display = 'block';
    if (bioEdit) bioEdit.style.display = 'none';
    bioActions.style.display = 'none';
    editBioBtn.style.display = isOwnProfile ? 'block' : 'none';

    // Reset bio edit to current value
    if (bioEdit) {
        bioEdit.value = currentProfile?.bio || '';
    }
}

/**
 * Hides the dialog
 */
export function hide(): void {
    dialog.open = false;
    currentProfile = null;
    isOwnProfile = false;
}

init();