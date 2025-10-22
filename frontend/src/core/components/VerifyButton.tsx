import { useState } from "react";
import { verifyUser } from "@/core/api/profileApi";
import { useAppState } from "@/pages/chat/state";

interface VerifyButtonProps {
    userId: number;
    verified: boolean;
    onVerificationChange?: (verified: boolean) => void;
}

export function VerifyButton({ userId, verified, onVerificationChange }: VerifyButtonProps) {
    const [isVerifying, setIsVerifying] = useState(false);
    const { user } = useAppState();

    // Only show for owner
    if (user.currentUser?.id !== 1) {
        return null;
    }

    async function handleVerifyToggle() {
        if (!user.authToken || isVerifying) return;
        
        setIsVerifying(true);
        try {
            const result = await verifyUser(userId, user.authToken);
            if (result) {
                onVerificationChange?.(result.verified);
            }
        } catch (error) {
            console.error('Error toggling verification:', error);
        } finally {
            setIsVerifying(false);
        }
    }

    return (
        <mdui-button 
            variant="filled"
            loading={isVerifying}
            onClick={handleVerifyToggle}
            title={verified ? "Снять подтверждение" : "Подтвердить аккаунт"}
        >
            {verified ? "Отменить подтверждение" : "Подтвердить"}
        </mdui-button>
    );
}