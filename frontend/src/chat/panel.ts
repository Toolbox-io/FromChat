import { authToken, currentUser, getAuthHeaders } from "../auth/api";
import { API_BASE_URL } from "../core/config";
import type { Message, Messages, WebSocketMessage } from "../core/types";
import { request } from "../websocket";
import { addMessage } from "./chat";
import { show as showContextMenu } from "./contextMenu";
import { show as showProfileDialog } from "./profileDialog";

const titleEl = document.getElementById("chat-name")!;
const messages = document.getElementById("chat-messages")!;
const input = document.getElementById("message-input") as HTMLInputElement;
const form = document.getElementById("message-form") as HTMLFormElement;

export abstract class ChatPanelController {
	static active: ChatPanelController | null = null;
	static mounted = false;

	activate(): void {
		ChatPanelController.active = this;
		if (currentUser) {
			this.loadMessages();
		}
	}

	setTitle(title: string): void {
		titleEl.textContent = title;
	}

	clearMessages(): void {
		messages.innerHTML = "";
	}

	appendSimple(text: string, isAuthor: boolean): void {
		const div = document.createElement("div");
		div.className = `message ${isAuthor ? "sent" : "received"}`;
		const inner = document.createElement("div");
		inner.className = "message-inner";
		const content = document.createElement("div");
		content.className = "message-content";
		content.textContent = text;
		inner.appendChild(content);
		div.appendChild(inner);
		messages.appendChild(div);
		messages.scrollTop = messages.scrollHeight;
	}

	protected abstract onSubmit(text: string): void | Promise<void>;
	protected abstract loadMessages(): void | Promise<void>;
	public abstract onProfileClicked(): void;

	static mountOnce(): void {
		if (this.mounted) return;
		this.mounted = true;
		if (!form) return;
		form.addEventListener(
			"submit",
			(e) => {
				if (!ChatPanelController.active) return; // let others handle
				e.preventDefault();
				e.stopPropagation();
				e.stopImmediatePropagation();
				const text = input.value.trim();
				if (!text) return;
				Promise.resolve(ChatPanelController.active.onSubmit(text)).finally(() => {
					input.value = "";
				});
			},
			true
		);
	}
}

export class PublicChatPanel extends ChatPanelController {
	protected async onSubmit(text: string): Promise<void> {
		const payload: WebSocketMessage = {
            data: { content: text },
            credentials: { scheme: "Bearer", credentials: authToken! },
            type: "sendMessage"
        };
        await request(payload);
	}

	protected loadMessages(): void {
		fetch(`${API_BASE_URL}/get_messages`, {
			headers: getAuthHeaders()
		})
			.then(response => response.json())
			.then((data: Messages) => {
				if (data.messages && data.messages.length > 0) {
					messages.innerHTML = "";

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

	public onProfileClicked(): void {
		// Public chat doesn't have a specific profile to show
	}
}

export class DmPanel extends ChatPanelController {
	private sender: (text: string) => Promise<void>;
	private loader: () => Promise<void> | void;
	private otherUsername: string | null = null;

	constructor(sender: (text: string) => Promise<void>, loader: () => Promise<void> | void) {
		super();
		this.sender = sender;
		this.loader = loader;
	}

	setOtherUser(username: string): void {
		this.otherUsername = username;
	}

	protected async onSubmit(text: string): Promise<void> {
		this.appendSimple(text, true);
		await this.sender(text);
	}
	
	protected loadMessages(): void | Promise<void> {
		return this.loader();
	}
	
	public onProfileClicked(): void {
		if (this.otherUsername) {
			// Import and show the profile dialog
			showProfileDialog(this.otherUsername!);
		}
	}

	appendMessageWithId(message: Message): void {
		const div = document.createElement("div");
		const isAuthor = message.username === currentUser?.username;
		div.className = `message ${isAuthor ? "sent" : "received"}`;
		div.setAttribute("data-message-id", message.id.toString());
		div.setAttribute("data-timestamp", message.timestamp);
		
		const inner = document.createElement("div");
		inner.className = "message-inner";
		
		const content = document.createElement("div");
		content.className = "message-content";
		content.textContent = message.content;
		
		inner.appendChild(content);
		div.appendChild(inner);
		
		// Add context menu support
		div.addEventListener("contextmenu", (e) => {
			e.preventDefault();
			showContextMenu(message, e.clientX, e.clientY);
		});
		
		messages.appendChild(div);
		messages.scrollTop = messages.scrollHeight;
	}
}

ChatPanelController.mountOnce();