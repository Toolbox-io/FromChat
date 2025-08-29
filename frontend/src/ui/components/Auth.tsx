import type React from "react";

export function AuthContainer({ children }: { children?: React.ReactNode }) {
    return (
        <div className="auth-container">
            <div className="auth-card fade-in">
                {children}
            </div>
        </div>
    )
}