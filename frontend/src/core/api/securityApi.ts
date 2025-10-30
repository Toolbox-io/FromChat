import { API_BASE_URL } from "@/core/config";
import { getAuthHeaders, deriveAuthSecret } from "@/core/api/authApi";

export async function changePassword(
    token: string,
    username: string,
    currentPassword: string,
    newPassword: string,
    logoutAllExceptCurrent: boolean
): Promise<void> {
    const currentDerived = await deriveAuthSecret(username, currentPassword);
    const newDerived = await deriveAuthSecret(username, newPassword);
    const res = await fetch(`${API_BASE_URL}/change-password`, {
        method: "POST",
        headers: getAuthHeaders(token),
        body: JSON.stringify({
            currentPasswordDerived: currentDerived,
            newPasswordDerived: newDerived,
            logoutAllExceptCurrent
        })
    });
    if (!res.ok) throw new Error("Failed to change password");
}


