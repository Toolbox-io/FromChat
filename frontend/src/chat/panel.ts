import { authToken, currentUser } from "../auth/api";
import type { WebSocketMessage } from "../core/types";
import { websocket } from "../websocket";
import { loadMessages } from "./chat";

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
        await new Promise<void>((resolve) => {
            let callback: ((e: MessageEvent) => void) | null = null;
            callback = (e) => {
                websocket.removeEventListener("message", callback!);
                resolve();
            };
            websocket.addEventListener("message", callback);
            websocket.send(JSON.stringify(payload));
        });
	}

	protected loadMessages(): void {
		return loadMessages();
	}
}

export class DmPanel extends ChatPanelController {
	private sender: (text: string) => Promise<void>;
	private loader: () => Promise<void> | void;
	constructor(sender: (text: string) => Promise<void>, loader: () => Promise<void> | void) {
		super();
		this.sender = sender;
		this.loader = loader;
	}
	protected async onSubmit(text: string): Promise<void> {
		this.appendSimple(text, true);
		await this.sender(text);
	}
	protected loadMessages(): void | Promise<void> {
		return this.loader();
	}
}

ChatPanelController.mountOnce();