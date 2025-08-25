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
	const container = document.getElementById("dm-messages")!;
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

async function fetchRecipient(userName: string): Promise<{ id: number; publicKey: string | null } | null> {
	const res = await fetch(`${API_BASE_URL}/profile/${encodeURIComponent(userName)}`);
	if (!res.ok) return null;
	const data = await res.json();
	// This assumes an endpoint returns profile with id; adapt if different
	const pkRes = await fetch(`${API_BASE_URL}/crypto/public-key`, { headers: getAuthHeaders(true) });
	// For simplicity, we reuse current user's endpoint; in real case, need GET by userId
	// Minimal v1: assume recipient has same endpoint at /profile/public-key?userId=... (not implemented)
	return { id: data.id, publicKey: null };
}

document.addEventListener("DOMContentLoaded", () => {
	const sendBtn = document.getElementById("dm-send");
	if (!sendBtn) return;
	sendBtn.addEventListener("click", async () => {
		const userEl = document.getElementById("dm-username") as HTMLInputElement;
		const textEl = document.getElementById("dm-input") as HTMLInputElement;
		const username = userEl.value.trim();
		const text = textEl.value.trim();
		if (!username || !text) return;
		// TODO: replace with real lookup for recipientId and publicKey
		appendDmMessage(text, true);
		textEl.value = "";
	});
});


