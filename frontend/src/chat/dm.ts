import { API_BASE_URL } from "../core/config";
import { authToken, getAuthHeaders } from "../auth/api";
import { DmPanel } from "./panel";
import { ecdhSharedSecret, deriveWrappingKey } from "../crypto/asymmetric";
import { importAesGcmKey, aesGcmEncrypt, aesGcmDecrypt } from "../crypto/symmetric";
import { randomBytes } from "../crypto/kdf";
import { getCurrentKeys } from "../auth/crypto";
import { request, websocket } from "../websocket";
import type { FetchDMResponse, SendDMRequest, WebSocketMessage } from "../core/types";
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
	(data.users || []).forEach((u: any) => {
		const item = document.createElement("mdui-list-item");
		item.setAttribute("headline", u.username);
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
						if (!activeDm?.publicKey) return;
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
									const div = document.createElement("div");
									const isAuthor = env.senderId !== activeDm.userId;
									div.className = `message ${isAuthor ? "sent" : "received"}`;
									const inner = document.createElement("div");
									inner.className = "message-inner";
									const content = document.createElement("div");
									content.className = "message-content";
									content.textContent = text;
									inner.appendChild(content);
									div.appendChild(inner);
									container.appendChild(div);
								} catch {}
							}
							container.scrollTop = container.scrollHeight;
						}
					}
				);
			}
			dmPanel.setTitle(u.username);
			dmPanel.clearMessages();
			dmPanel.activate();
			const resPk = await fetch(`${API_BASE_URL}/crypto/public-key/of/${u.id}`, { headers: getAuthHeaders(true) });
			if (resPk.ok) {
				const pkData = await resPk.json();
				activeDm!.publicKey = pkData.publicKey;
			}
		});
		list.appendChild(item);
	});
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
			
			const container = document.getElementById("chat-messages")!;
			const div = document.createElement("div");
			const isAuthor = msg.data.senderId !== activeDm.userId;
			div.className = `message ${isAuthor ? "sent" : "received"}`;
			const inner = document.createElement("div");
			inner.className = "message-inner";
			const content = document.createElement("div");
			content.className = "message-content";
			content.textContent = plaintext;
			inner.appendChild(content);
			div.appendChild(inner);
			container.appendChild(div);
			container.scrollTop = container.scrollHeight;
		}
	} catch {}
});