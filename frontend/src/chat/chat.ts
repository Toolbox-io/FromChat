/**
 * @fileoverview Chat functionality and message management
 * @description Handles message display, loading, sending, and real-time updates
 * @author Cursor
 * @version 1.0.0
 */

import { API_BASE_URL } from "../core/config";
import { request } from "../websocket";
import type { Message, Messages, WebSocketMessage } from "../core/types";
import { formatTime } from "../utils/utils";
import { show as showContextMenu } from "./contextMenu";
import { show as showUserProfileDialog } from "./profileDialog";
import defaultAvatar from "../resources/images/default-avatar.png";
import { authToken, currentUser, getAuthHeaders } from "../auth/api";
import { PublicChatPanel } from "./panel";

/**
 * Adds a new message to the chat interface
 * @param {Message} message - Message object to display
 * @param {boolean} isAuthor - Whether the current user is the message author
 */
export function addMessage(message: Message, isAuthor: boolean): void {
    const messagesContainer = document.querySelector('.chat-messages') as HTMLElement;
    const messageDiv = document.createElement('div');
    messageDiv.classList.add("message");
    if (isAuthor) {
        messageDiv.classList.add("sent");
    } else {
        messageDiv.classList.add("received");
    }
    messageDiv.dataset.id = `${message.id}`;

    const messageInner = document.createElement('div');
    messageInner.classList.add('message-inner');

    // Add profile picture for received messages
    if (!isAuthor) {
        const profilePicDiv = document.createElement('div');
        profilePicDiv.classList.add('message-profile-pic');
        
        const profileImg = document.createElement('img');
        profileImg.src = message.profile_picture || defaultAvatar;
        profileImg.alt = message.username;

        let errorLock = false;

        profileImg.addEventListener("error", () => {
            if (!errorLock) {
                profileImg.src = defaultAvatar;
                errorLock = true;
            }
        });
        
        // Add click handler to profile picture
        profileImg.style.cursor = 'pointer';
        profileImg.addEventListener('click', () => {
            showUserProfileDialog(message.username);
        });
        
        profilePicDiv.appendChild(profileImg);
        messageDiv.appendChild(profilePicDiv);
    }

    if (!isAuthor) {
        const usernameDiv = document.createElement('div');
        usernameDiv.classList.add('message-username');
        usernameDiv.textContent = message.username;
        
        // Add click handler to username
        usernameDiv.style.cursor = 'pointer';
        usernameDiv.addEventListener('click', () => {
            showUserProfileDialog(message.username);
        });
        
        messageInner.appendChild(usernameDiv);
    }

    // Add reply preview if this is a reply
    if (message.reply_to) {
        const replyDiv = document.createElement('div');
        replyDiv.classList.add('message-reply');
        replyDiv.innerHTML = `
            <div class="reply-content">
                <span class="reply-username">${message.reply_to.username}</span>
                <span class="reply-text">${message.reply_to.content}</span>
            </div>
        `;
        messageInner.appendChild(replyDiv);
    }

    const contentDiv = document.createElement('div');
    contentDiv.classList.add('message-content');
    contentDiv.textContent = message.content;
    messageInner.appendChild(contentDiv);

    const timeDiv = document.createElement('div');
    timeDiv.classList.add('message-time');
    
    let timeText = formatTime(message.timestamp);
    if (message.is_edited) {
        timeText += ' (edited)';
    }
    timeDiv.textContent = timeText;

    if (isAuthor && message.is_read) {
        const checkIcon = document.createElement('span');
        checkIcon.classList.add("material-symbols", "outlined");
        timeDiv.appendChild(checkIcon);
    }

    messageInner.appendChild(timeDiv);
    messageDiv.appendChild(messageInner);
    messagesContainer.appendChild(messageDiv);

    // Add right-click context menu
    messageDiv.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showContextMenu(message, e.clientX, e.clientY);
    });

    // Прокрутка к новому сообщению
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Loads chat messages from the server
 */
export function loadMessages(): void {
    fetch(`${API_BASE_URL}/get_messages`, {
        headers: getAuthHeaders()
    })
        .then(response => response.json())
        .then((data: Messages) => {
            if (data.messages && data.messages.length > 0) {
                const messagesContainer = document.querySelector('.chat-messages') as HTMLElement;

                const lastMessage = messagesContainer.lastElementChild as HTMLElement
                let lastMessageId: number = 0
                if (lastMessage) {
                    lastMessageId = Number(lastMessage.dataset.id)
                }
                
                // Добавляем только новые сообщения
                data.messages.forEach(msg => {
                    console.log(msg);
                    if (msg.id > lastMessageId) {
                        addMessage(msg, msg.username == currentUser!.username);
                    }
                });
            }
        });
}

/**
 * Sends a message via WebSocket
 */
export async function sendMessage(): Promise<void> {
    const input = document.querySelector('.message-input') as HTMLInputElement;
    const message = input.value.trim();

    if (message) {
        const response = await request({
            data: {
                content: message
            }, 
            credentials: {
                scheme: "Bearer", 
                credentials: authToken!
            },
            type: "sendMessage"
        })

        console.log(response)
        if (!response.error) {
            input.value = "";
        }
    }
}

/**
 * Updates an existing message in the chat interface
 * @param {Message} message - Updated message object
 */
export function updateMessage(message: Message): void {
    const messageElement = document.querySelector(`[data-id="${message.id}"]`) as HTMLElement;
    if (!messageElement) return;

    const contentDiv = messageElement.querySelector('.message-content') as HTMLElement;
    const timeDiv = messageElement.querySelector('.message-time') as HTMLElement;

    if (contentDiv) {
        contentDiv.textContent = message.content;
    }

    if (timeDiv) {
        let timeText = formatTime(message.timestamp);
        if (message.is_edited) {
            timeText += ' (edited)';
        }
        timeDiv.textContent = timeText;
    }
}

/**
 * Removes a message from the chat interface
 * @param {number} messageId - ID of the message to remove
 */
export function removeMessage(messageId: number): void {
    const messageElement = document.querySelector(`[data-id="${messageId}"]`) as HTMLElement;
    if (messageElement) {
        messageElement.remove();
    }
}

/**
 * Handles WebSocket message updates
 * @param {WebSocketMessage} response - WebSocket response
 */
export function handleWebSocketMessage(response: WebSocketMessage): void {
    switch (response.type) {
        case 'messageEdited':
            if (response.data) {
                updateMessage(response.data);
            }
            break;
        case 'messageDeleted':
            if (response.data && response.data.message_id) {
                removeMessage(response.data.message_id);
            }
            break;
        case 'newMessage':
            if (response.data) {
                const isAuthor = response.data.username === currentUser?.username;
                addMessage(response.data, isAuthor);
            }
            break;
    }
}

export const publicChatPanel = new PublicChatPanel();

publicChatPanel.activate();