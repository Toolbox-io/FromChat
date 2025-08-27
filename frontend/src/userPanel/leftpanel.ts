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
const chatContainer = document.querySelector('#chat-interface .chat-container') as HTMLElement;
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
function animateChatSwitch(updateFn: () => void): Promise<void> {
    return new Promise((resolve, reject) => {
        // Ensure panel is visible
        chatCollapseBtn.style.display = 'flex';
        chatInner.style.display = 'flex';

        // Start out animation
        if (!chatContainer) {
            reject("Chat container is missing");
            return;
        }
        chatContainer.classList.remove('chat-switch-in');
        chatContainer.classList.add('chat-switch-out');

        const onOutEnd = () => {
            chatContainer.removeEventListener('animationend', onOutEnd);
            // Update content while hidden
            updateFn();

            // Then play in animation from the same offset
            chatContainer.classList.remove('chat-switch-out');
            chatContainer.classList.add('chat-switch-in');

            const onInEnd = () => {
                chatContainer.removeEventListener("animationend", onInEnd);
                resolve();
            }

            chatContainer.addEventListener("animationend", onInEnd);
        };

        chatContainer.addEventListener('animationend', onOutEnd);
    });
}

function setupChatSwitching(): void {
    chat1.addEventListener('click', () => {
        animateChatSwitch(() => {
            chatName.textContent = 'Общий чат';
        });
    });
    
    chat2.addEventListener('click', () => {
        animateChatSwitch(() => {
            chatName.textContent = 'Общий чат 2';
        });
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