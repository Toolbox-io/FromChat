import { API_BASE_URL } from "../core/config";
import { authToken, getAuthHeaders, currentUser } from "../auth/api";
import { DmPanel } from "./panel";
import { ecdhSharedSecret, deriveWrappingKey } from "../crypto/asymmetric";
import { importAesGcmKey, aesGcmEncrypt, aesGcmDecrypt } from "../crypto/symmetric";
import { randomBytes } from "../crypto/kdf";
import { getCurrentKeys } from "../auth/crypto";
import { request, websocket } from "../websocket";
import type { FetchDMResponse, SendDMRequest, WebSocketMessage, User } from "../core/types";
import type { Tabs } from "mdui/components/tabs";
import { b64, ub64 } from "../utils/utils";

export async function sendDm(recipientId: number, recipientPublicKeyB64: string, plaintext: string): Promise<void> {
	const keys = getCurrentKeys();
	if (!keys) throw new Error("Keys not initialized");
	const mk = randomBytes(32);
	const wkSalt = randomBytes(16);
	const shared = ecdhSharedSecret(keys.privateKey, ub64(recipientPublicKeyB64));
	const wkRaw = await deriveWrappingKey(shared, wkSalt, new Uint8Array([1]));
	const wk = await importAesGcmKey(wkRaw);
	const encMsg = await aesGcmEncrypt(await importAesGcmKey(mk), new TextEncoder().encode(plaintext));
	const wrap = await aesGcmEncrypt(wk, mk);
	
	await fetch(`${API_BASE_URL}/dm/send`, {
		method: "POST",
		headers: getAuthHeaders(true),
		body: JSON.stringify({
			recipientId: recipientId,
			iv: b64(encMsg.iv),
			ciphertext: b64(encMsg.ciphertext),
			salt: b64(wkSalt),
			iv2: b64(wrap.iv),
			wrappedMk: b64(wrap.ciphertext)
		})
	});
}

export interface DmEnvelope {
	id: number;
	senderId: number;
	recipientId: number;
	iv: string;
	ciphertext: string;
	salt: string;
	iv2: string;
	wrappedMk: string;
	timestamp: string;
}

export async function fetchDm(since?: number): Promise<DmEnvelope[]> {
	const url = new URL(`${API_BASE_URL}/dm/fetch`);
	if (since) url.searchParams.set("since", String(since));

	const response = await fetch(url, { 
		headers: getAuthHeaders(true) 
	});

	if (response.ok) {
		const data: FetchDMResponse = await response.json();
		return data.messages ?? [];
	} else {
		return [];
	}
}

export async function decryptDm(envelope: DmEnvelope, senderPublicKeyB64: string): Promise<string> {
	const keys = getCurrentKeys();
	if (!keys) throw new Error("Keys not initialized");

	// Obtain the key
	const shared = ecdhSharedSecret(keys.privateKey, ub64(senderPublicKeyB64));
	const wkRaw = await deriveWrappingKey(shared, ub64(envelope.salt), new Uint8Array([1]));
	const wk = await importAesGcmKey(wkRaw);
	const mk = await aesGcmDecrypt(wk, ub64(envelope.iv2), ub64(envelope.wrappedMk));

	// Decrypt
	const msg = await aesGcmDecrypt(await importAesGcmKey(mk), ub64(envelope.iv), ub64(envelope.ciphertext));
	return new TextDecoder().decode(msg);
}

let activeDm: { userId: number; username: string; publicKey: string | null } | null = null;
let usersLoaded = false;
let dmPanel: DmPanel | null = null;

async function loadUsers() {
	const res = await fetch(`${API_BASE_URL}/users`, { headers: getAuthHeaders(true) });
	if (!res.ok) return;
	const data = await res.json();
	const list = document.getElementById("dm-users")!;
	list.innerHTML = "";
	(data.users || []).forEach((u: User) => {
		const item = document.createElement("mdui-list-item");
		
		// Add avatar
		const avatar = document.createElement("img");
		avatar.src = u.profile_picture || "./src/resources/images/default-avatar.png";
		avatar.alt = u.username;
		avatar.slot = "icon";
		avatar.style.width = "40px";
		avatar.style.height = "40px";
		avatar.style.borderRadius = "50%";
		avatar.style.objectFit = "cover";
		
		// Handle avatar load error
		avatar.addEventListener("error", () => {
			avatar.src = "./src/resources/images/default-avatar.png";
		});
		
		item.appendChild(avatar);
		
		// Set headline (username)
		item.setAttribute("headline", u.username);
		
		// Add last message placeholder (will be loaded lazily)
		const lastMessageEl = document.createElement("div");
		lastMessageEl.slot = "supporting-text";
		lastMessageEl.textContent = "Loading...";
		lastMessageEl.style.fontSize = "12px";
		lastMessageEl.style.color = "var(--mdui-color-on-surface-variant)";
		item.appendChild(lastMessageEl);
		
		// Load last message when element becomes visible
		const observer = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					loadLastMessage(u.id, lastMessageEl);
					observer.unobserve(entry.target);
				}
			});
		});
		observer.observe(item);
		
		item.addEventListener("click", async () => {
			activeDm = { userId: u.id, username: u.username, publicKey: null };
			if (!dmPanel) {
				dmPanel = new DmPanel(
					async (text: string) => {
						if (activeDm?.publicKey) {
							// WebSocket realtime send
							const keys = getCurrentKeys();
							if (!keys) return;

							// Encryption key
							const mk = randomBytes(32);
							const wkSalt = randomBytes(16);
							const shared = ecdhSharedSecret(keys.privateKey, ub64(activeDm.publicKey));
							const wkRaw = await deriveWrappingKey(shared, wkSalt, new Uint8Array([1]));
							const wk = await importAesGcmKey(wkRaw);

							// Encrypt the message
							const encMsg = await aesGcmEncrypt(await importAesGcmKey(mk), new TextEncoder().encode(text));
							const wrap = await aesGcmEncrypt(wk, mk);

							const payload: SendDMRequest = {
								recipientId: activeDm.userId,
								iv: b64(encMsg.iv),
								ciphertext: b64(encMsg.ciphertext),
								salt: b64(wkSalt),
								iv2: b64(wrap.iv),
								wrappedMk: b64(wrap.ciphertext)
							}

							request({
								type: "dmSend",
								credentials: { 
									scheme: "Bearer", 
									credentials: authToken!
								},
								data: payload
							});
						}
					},
					async () => {
						// Load DM history for the active conversation
						if (!activeDm?.publicKey || !dmPanel) return;
						const response = await fetch(`${API_BASE_URL}/dm/history/${activeDm.userId}`, { 
							headers: getAuthHeaders(true) 
						});
						if (response.ok) {
							const data = await response.json();
							const messages: DmEnvelope[] = data.messages || [];
							const container = document.getElementById("chat-messages")!;
							container.innerHTML = "";
							for (const env of messages) {
								try {
									const text = await decryptDm(env, activeDm.publicKey);
									const isAuthor = env.senderId !== activeDm.userId;
									const username = isAuthor ? (currentUser?.username || "Unknown") : (activeDm.username || "Unknown");
									dmPanel.appendMessageWithId({
										id: env.id,
										content: text,
										username: username,
										timestamp: env.timestamp,
										is_read: false,
										is_edited: false
									});
								} catch {}
							}
							container.scrollTop = container.scrollHeight;
						}
					}
				);
			}
			dmPanel.setOtherUser(u.username);
			dmPanel.setTitle(u.username);
			dmPanel.clearMessages();
			dmPanel.activate();
			
			// Add profile click functionality to chat header
			const chatHeaderAvatar = document.querySelector('.chat-header-avatar') as HTMLElement;
			if (chatHeaderAvatar) {
				chatHeaderAvatar.style.cursor = 'pointer';
				chatHeaderAvatar.onclick = () => dmPanel?.onProfileClicked();
			}
			
			const resPk = await fetch(`${API_BASE_URL}/crypto/public-key/of/${u.id}`, { headers: getAuthHeaders(true) });
			if (resPk.ok) {
				const pkData = await resPk.json();
				activeDm!.publicKey = pkData.publicKey;
			}
		});
		list.appendChild(item);
	});
}

async function loadLastMessage(userId: number, element: HTMLElement): Promise<void> {
	try {
		const response = await fetch(`${API_BASE_URL}/dm/history/${userId}?limit=1`, { 
			headers: getAuthHeaders(true) 
		});
		if (response.ok) {
			const data = await response.json();
			const messages: DmEnvelope[] = data.messages || [];
			if (messages.length > 0) {
				const lastMessage = messages[messages.length - 1];
				// For now, just show "Last message" since we can't decrypt without the public key
				// In a real implementation, you'd need to store the public key or decrypt here
				element.textContent = "Last message";
			} else {
				element.textContent = "No messages yet";
			}
		} else {
			element.textContent = "No messages yet";
		}
	} catch (error) {
		element.textContent = "No messages yet";
	}
}

function init() {
	const tabs = document.querySelector(".chat-tabs mdui-tabs") as Tabs;
	const dmTab = tabs?.querySelector('mdui-tab[value="dms"]')!;
	function ensureUsersLoaded() {
		if (!usersLoaded) {
			usersLoaded = true;
			loadUsers();
		}
	}
	dmTab.addEventListener("click", ensureUsersLoaded);
	tabs.addEventListener("change", (e: any) => {
		if (e.detail?.value === "dms") {
			ensureUsersLoaded();
			dmPanel?.activate();
		}
	});
}

init();

// realtime incoming DMs
websocket.addEventListener("message", async (e) => {
	try {
		const msg: WebSocketMessage = JSON.parse((e as MessageEvent).data);
		if (msg.type === "dmNew" && activeDm && (msg.data.senderId === activeDm.userId || msg.data.recipientId === activeDm.userId)) {
			const plaintext = await decryptDm(msg.data, activeDm.publicKey!);
			
			if (dmPanel) {
				const isAuthor = msg.data.senderId !== activeDm.userId;
				dmPanel.appendMessageWithId({
					id: msg.data.id,
					content: plaintext,
					username: isAuthor ? (currentUser?.username || "Unknown") : (activeDm.username || "Unknown"),
					timestamp: msg.data.timestamp,
					is_read: false,
					is_edited: false
				});
			}
		}
	} catch {}
});