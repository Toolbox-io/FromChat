import { API_BASE_URL } from "../core/config";
import { getAuthHeaders } from "../auth/api";
import { ecdhSharedSecret, deriveWrappingKey } from "../crypto/asymmetric";
import { importAesGcmKey, aesGcmEncrypt, aesGcmDecrypt } from "../crypto/symmetric";
import { randomBytes } from "../crypto/kdf";
import { getCurrentKeys } from "../auth/crypto";

function b64(a: Uint8Array): string { return btoa(String.fromCharCode(...a)); }
function ub64(s: string): Uint8Array {
	const bin = atob(s);
	const arr = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
	return arr;
}

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
			recipientId,
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
	const res = await fetch(url, { headers: getAuthHeaders(true) });
	if (!res.ok) return [];
	const data = await res.json();
	return data.messages ?? [];
}

export async function decryptDm(envelope: DmEnvelope, senderPublicKeyB64: string): Promise<string> {
	const keys = getCurrentKeys();
	if (!keys) throw new Error("Keys not initialized");
	const shared = ecdhSharedSecret(keys.privateKey, ub64(senderPublicKeyB64));
	const wkRaw = await deriveWrappingKey(shared, ub64(envelope.salt), new Uint8Array([1]));
	const wk = await importAesGcmKey(wkRaw);
	const mk = await aesGcmDecrypt(wk, ub64(envelope.iv2), ub64(envelope.wrappedMk));
	const msg = await aesGcmDecrypt(await importAesGcmKey(mk), ub64(envelope.iv), ub64(envelope.ciphertext));
	return new TextDecoder().decode(msg);
}

function appendDmMessage(text: string, isAuthor: boolean) {
	const container = document.getElementById("chat-messages")!;
	const div = document.createElement("div");
	div.className = `message ${isAuthor ? "sent" : "received"}`;
	const inner = document.createElement("div");
	inner.className = "message-inner";
	const content = document.createElement("div");
	content.className = "message-content";
	content.textContent = text;
	inner.appendChild(content);
	div.appendChild(inner);
	container.appendChild(div);
	container.scrollTop = container.scrollHeight;
}

// removed unused helper

let activeDm: { userId: number; username: string; publicKey: string | null } | null = null;
let usersLoaded = false;

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
			document.getElementById("chat-name")!.textContent = u.username;
			(document.getElementById("chat-messages") as HTMLElement).innerHTML = "";
			const resPk = await fetch(`${API_BASE_URL}/crypto/public-key/of/${u.id}`, { headers: getAuthHeaders(true) });
			if (resPk.ok) {
				const pkData = await resPk.json();
				activeDm!.publicKey = pkData.publicKey;
			}
		});
		list.appendChild(item);
	});
}

document.addEventListener("DOMContentLoaded", () => {
	const tabs = document.querySelector(".chat-tabs mdui-tabs");
	const dmTab = tabs?.querySelector('mdui-tab[value="dms"]');
	function ensureUsersLoaded() {
		if (!usersLoaded) {
			usersLoaded = true;
			loadUsers();
		}
	}
	dmTab?.addEventListener("click", ensureUsersLoaded);
	(tabs as any)?.addEventListener("change", (e: any) => {
		if (e?.detail?.value === "dms") ensureUsersLoaded();
	});
	const form = document.getElementById("message-form");
	if (form) {
		form.addEventListener("submit", async (e) => {
			if (!activeDm) return; // Let global chat handler proceed
			e.preventDefault();
			const input = document.getElementById("message-input") as HTMLInputElement;
			const text = input.value.trim();
			if (!text) return;
			appendDmMessage(text, true);
			input.value = "";
			if (activeDm.publicKey) {
				try {
					await sendDm(activeDm.userId, activeDm.publicKey, text);
				} catch {}
			}
		});
	}
});


