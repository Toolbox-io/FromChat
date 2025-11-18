import { MaterialList, MaterialListItem } from "@/utils/material";
import { useAppState } from "@/pages/chat/state";
import { deleteAccount } from "@/core/api/account";
import { confirm } from "mdui/functions/confirm";
import styles from "@/pages/chat/css/settings-dialog.module.scss";

interface AccountPanelProps {
    onClose: () => void;
}

export function AccountPanel({ onClose }: AccountPanelProps) {
    const { user, logout } = useAppState();
    const authToken = user?.authToken;

    async function handleDeleteAccount() {
        if (!authToken) return;

        try {
            await confirm({
                headline: "Delete Account?",
                description: "This will permanently delete your account and all your data. This action cannot be undone.",
                confirmText: "Delete",
                cancelText: "Cancel"
            });

            await deleteAccount(authToken);
            logout();
            onClose();
        } catch (error) {
            if (error !== "cancelled") {
                console.error("Failed to delete account:", error);
                alert(error instanceof Error ? error.message : "Failed to delete account");
            }
        }
    }

    return (
        <>
            <h3 className={styles.panelTitle}>Account</h3>
            <MaterialList>
                <MaterialListItem 
                    onClick={logout}
                    className={styles.clickableItem}
                    headline="Logout"
                    description="Sign out of your account"
                    icon="logout"
                />
                <MaterialListItem 
                    onClick={handleDeleteAccount}
                    className={`${styles.clickableItem} ${styles.dangerItem}`}
                    headline="Delete Account"
                    description="Permanently delete your account"
                    icon="delete_forever"
                />
            </MaterialList>
        </>
    );
}

