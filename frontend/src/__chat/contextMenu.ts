/**
 * @fileoverview Message context menu functionality
 * @description Handles right-click context menu for message actions (edit, delete, reply)
 * @author Cursor
 * @version 1.0.0
 */

import { request } from "../websocket";
import type { Message } from "../core/types";
import { showSuccess, showError } from "../utils/notification";
import { delay, id } from "../utils/utils";
import type { Dialog } from "mdui/components/dialog";
import type { TextField } from "mdui/components/text-field";
import { currentUser, authToken } from "../auth/api";


let menu = id("message-context-menu")!;
let editDialog = id<Dialog>("edit-message-dialog");
let replyDialog = id<Dialog>("reply-message-dialog");
let currentMessage: Message | null = null;

function init() {
    bindEvents();
}

/**
 * Binds event listeners
 * @private
 */
function bindEvents(): void {
    // Context menu events
    menu?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const action = target.closest('.context-menu-item')?.getAttribute('data-action');
        
        if (action && currentMessage) {
            handleAction(action, currentMessage);
        }
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!menu?.contains(e.target as Node)) {
            hide();
        }
    });

    // Edit dialog events
    const editCancelBtn = editDialog?.querySelector('#edit-cancel');
    const editSaveBtn = editDialog?.querySelector('#edit-save');

    editCancelBtn?.addEventListener('click', () => hideEditDialog());
    editSaveBtn?.addEventListener('click', () => saveEdit());

    // Reply dialog events
    const replyCancelBtn = replyDialog?.querySelector('#reply-cancel');
    const replySendBtn = replyDialog?.querySelector('#reply-send');

    replyCancelBtn?.addEventListener('click', () => hideReplyDialog());
    replySendBtn?.addEventListener('click', () => sendReply());

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hide();
            hideEditDialog();
            hideReplyDialog();
        }
    });
}

/**
 * Shows the context menu at the specified position
 * @param {Message} message - The message to show menu for
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 */
export function show(message: Message, x: number, y: number): void {
    currentMessage = message;
    
    // Show delete for own messages and for owner on any message
    const editItem = menu.querySelector('[data-action="edit"]') as HTMLElement;
    const deleteItem = menu.querySelector('[data-action="delete"]') as HTMLElement;
    
    const isAuthor = message.username === currentUser?.username;
    const isOwner = currentUser?.admin;
    
    // Check if we're in a DM conversation
    const isInDm = document.querySelector('.chat-tabs mdui-tab[value="dms"]')?.getAttribute('active') === 'true';
    
    // Show edit only for own messages
    editItem.style.display = isAuthor ? 'flex' : 'none';
    
    // Show delete for own messages, admin on any message, or in DMs for any message
    const canDelete = isAuthor || isOwner || isInDm;
    deleteItem.style.display = canDelete ? 'flex' : 'none';
    
    // Position the menu properly
    menu.style.display = 'block';

    let menuWidth = menu.offsetWidth;
    let menuHeight = menu.offsetHeight;
    
    let adjustedX = x;
    let adjustedY = y;
    let vertical = "top";
    let horizontal = "right";

    // Adjust horizontal position if menu would go off-screen
    if (x + menuWidth > window.innerWidth) {
        adjustedX = x - menuWidth;
        horizontal = "left";
    }

    // Adjust vertical position if menu would go off-screen
    if (y + menuHeight > window.innerHeight) {
        adjustedY = y - menuHeight;
        vertical = "bottom";
    }

    // Ensure menu doesn't go off the left or top edges
    adjustedX = Math.max(0, adjustedX);
    adjustedY = Math.max(0, adjustedY);

    menu.style.left = `${adjustedX}px`;
    menu.style.top = `${adjustedY}px`;
    menu.classList.add(`pos-${vertical}-${horizontal}`, "open");
}

/**
 * Hides the context menu
 */
export function hide(): void {
    menu.style.display = 'none';
    menu.classList.forEach((name) => {
        if (name.match(/pos-\w+-\w+/)) {
            menu.classList.remove(name);
        }
    })
    currentMessage = null;
}

/**
 * Handles context menu actions
 * @param {string} action - The action to perform
 * @param {Message} message - The message to act on
 * @private
 */
function handleAction(action: string, message: Message): void {
    hide();

    switch (action) {
        case 'edit':
            showEditDialog(message);
            break;
        case 'delete':
            deleteMessage(message);
            break;
        case 'reply':
            showReplyDialog(message);
            break;
    }
}

/**
 * Shows the edit dialog
 * @param {Message} message - The message to edit
 * @private
 */
async function showEditDialog(message: Message): Promise<void> {
    const textField = editDialog.querySelector('#edit-message-input') as TextField;
    textField.value = message.content;
    
    currentMessage = message;
    editDialog.open = true;
    
    // Focus the text field
    await delay(100);
    textField?.focus();
}

/**
 * Hides the edit dialog
 * @private
 */
function hideEditDialog(): void {
    editDialog.open = false;
}

/**
 * Saves the edited message
 * @private
 */
async function saveEdit(): Promise<void> {
    if (!currentMessage) return;

    const textField = editDialog.querySelector('#edit-message-input') as TextField;
    const newContent = textField?.value?.trim() || '';

    if (!newContent) {
        showError('Message cannot be empty');
        return;
    }

    const response = await request({
        type: "editMessage",
        data: {
            message_id: currentMessage.id,
            content: newContent
        },
        credentials: {
            scheme: "Bearer",
            credentials: authToken!
        }
    });

    if (response.error) {
        showError(response.error.detail);
    } else {
        showSuccess('Message edited successfully');
        hideEditDialog();
    }
}

/**
 * Shows the reply dialog
 * @param {Message} message - The message to reply to
 * @private
 */
async function showReplyDialog(message: Message): Promise<void> {
    const preview = replyDialog.querySelector('#reply-preview') as HTMLElement;
    preview.innerHTML = `
        <div class="reply-preview-content">
            <strong>${message.username}</strong>: ${message.content}
        </div>
    `;
    
    currentMessage = message;
    replyDialog.open = true;
    
    // Focus the text field
    await delay(100);
    const textField = replyDialog?.querySelector('#reply-message-input') as TextField;
    textField?.focus();
}

/**
 * Hides the reply dialog
 * @private
 */
function hideReplyDialog(): void {
    replyDialog.open = false;
}

/**
 * Sends the reply message
 * @private
 */
async function sendReply(): Promise<void> {
    if (!currentMessage) return;

    const textField = replyDialog.querySelector('#reply-message-input') as TextField;
    const content = textField?.value?.trim() || '';

    if (!content) {
        showError('Reply cannot be empty');
        return;
    }

    const response = await request({
        type: "replyMessage",
        data: {
            content: content,
            reply_to_id: currentMessage.id
        },
        credentials: {
            scheme: "Bearer",
            credentials: authToken!
        }
    });

    if (response.error) {
        showError(response.error.detail);
    } else {
        showSuccess('Reply sent successfully');
        hideReplyDialog();
        if (textField) {
            textField.value = '';
        }
    }
}

/**
 * Deletes a message
 * @param {Message} message - The message to delete
 * @private
 */
async function deleteMessage(message: Message): Promise<void> {
    if (!confirm('Are you sure you want to delete this message?')) {
        return;
    }

    const response = await request({
        type: "deleteMessage",
        data: {
            message_id: message.id
        },
        credentials: {
            scheme: "Bearer",
            credentials: authToken!
        }
    });

    if (response.error) {
        showError(response.error.detail);
    } else {
        showSuccess('Message deleted successfully');
    }
}

init();