/**
 * @fileoverview Left panel UI controls and interactions
 * @description Handles chat collapse/expand, chat switching, and profile dialog
 * @author Cursor
 * @version 1.0.0
 */

import { Dialog } from "mdui/components/dialog";
import { loadProfilePicture } from "./profile/upload";
import { id } from "../utils/utils";

// сварачивание и разворачивание чата
const chatCollapseBtn = id('hide-chat')!;
const chat1 = id('chat-list-chat-1')!;
const chat2 = id('chat-list-chat-2')!;
const chatInner = id('chat-inner')!;
const chatName = id('chat-name')!;
const profileButton = id('profile-open')!;
const dialog = id<Dialog>("profile-dialog");
const dialogClose = id("profile-dialog-close")!;

/**
 * Sets up chat collapse functionality
 * @private
 */
function setupChatCollapse(): void {
    chatCollapseBtn.addEventListener('click', () => {
        chatCollapseBtn.style.display = 'none';
        chatInner.style.display = 'none';
    });
}

/**
 * Sets up chat switching functionality
 * @private
 */
function setupChatSwitching(): void {
    chat1.addEventListener('click', () => {
        chatCollapseBtn.style.display = 'flex';
        chatInner.style.display = 'flex';
        chatName.textContent = 'общий чат';
    });
    
    chat2.addEventListener('click', () => {
        chatCollapseBtn.style.display = 'flex';
        chatInner.style.display = 'flex';
        chatName.textContent = 'общий чат 2';
    });
}

/**
 * Sets up profile dialog functionality
 * @private
 */
function setupProfileDialog(): void {
    profileButton.addEventListener('click', () => {
        dialog.open = true;
        loadProfilePicture();
    });

    dialogClose.addEventListener("click", () => {
        dialog.open = false;
    });
}

setupChatCollapse();
setupChatSwitching();
setupProfileDialog();