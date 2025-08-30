/**
 * @fileoverview Profile module entry point and initialization
 * @description Coordinates profile system initialization and form handling
 * @author Cursor
 * @version 1.0.0
 */

import type { Dialog } from "mdui/components/dialog";
import { loadProfileData } from './editor';
import { loadProfilePicture, initializeProfileUpload } from "./upload";
import { initializeProfileEditor } from './editor';
import { id } from "../../utils/utils";

// Handle profile form submission
const form = id("profile-form")!;
const dialog = id<Dialog>("profile-dialog");

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    // TODO: Process form data if needed
    // For now, just close the dialog
    dialog.open = false;
});

/**
 * Initializes profile functionality after user login
 */
export function initializeProfile(): void {
    // Initialize profile modules
    initializeProfileUpload();
    initializeProfileEditor();
    
    // Load profile data
    Promise.all([
        loadProfilePicture(),
        loadProfileData()
    ]).catch(error => {
        console.error('Error initializing profile:', error);
    });
}