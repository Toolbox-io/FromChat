import { useState, useEffect } from "react";
import { checkUserSimilarity } from "@/core/api/account/profile";
import { useAppState } from "@/pages/chat/state";
import { MaterialIcon } from "@/utils/material";

interface StatusBadgeProps {
    verified: boolean;
    userId?: number;
    size?: "small" | "medium" | "large";
}

export function StatusBadge({ verified, userId, size = "small" }: StatusBadgeProps) {
    const [isSimilarToVerified, setIsSimilarToVerified] = useState(false);
    const { user } = useAppState();
    
    const className = `status-badge ${size}`;

    // Check similarity for unverified users
    useEffect(() => {
        if (!verified && userId && user.authToken) {
            checkUserSimilarity(userId, user.authToken)
                .then(result => {
                    setIsSimilarToVerified(result?.isSimilar || false);
                })
                .catch(error => {
                    console.error('Error checking similarity:', error);
                    setIsSimilarToVerified(false);
                });
        } else {
            setIsSimilarToVerified(false);
        }
    }, [verified, userId, user.authToken]);

    if (verified) {
        return (
            <span className={`${className} verified`} title="Подтверждённый аккаунт">
                <MaterialIcon name="verified--filled" />
            </span>
        );
    }

    if (isSimilarToVerified) {
        return (
            <span className={`${className} warning`} title="Похож на подтверждённый аккаунт">
                <MaterialIcon name="warning--filled" />
            </span>
        );
    }

    // Don't show anything if not verified and not similar
    return null;
}