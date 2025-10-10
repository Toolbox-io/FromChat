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

export type IconType = "filled" | "outlined";

export interface AuthHeaderIcon {
    name: string;
    type: IconType
}

export interface AuthHeaderProps {
    title: string;
    icon: string | AuthHeaderIcon;
    subtitle: string;
}

export function AuthHeader({ title, icon, subtitle }: AuthHeaderProps) {
    const iconType = typeof icon === "string" ? "filled" : icon.type;
    const iconName = typeof icon === "string" ? icon : icon.name;

    return (
        <div className="auth-header">
            <h2>
                <span className={`material-symbols ${iconType} large`}>{iconName}</span> 
                {title}
            </h2>
            <p>{subtitle}</p>
        </div>
    )
}

export type AlertType = "success" | "danger"

export interface Alert {
    type: AlertType;
    message: string;
}

export function AlertsContainer({ alerts }: { alerts: Alert[]}) {
    return (
        <div>
            {alerts.slice(-3).map((alert, i) => {
                return <div className={`alert alert-${alert.type}`} key={i}>{alert.message}</div>
            })}
        </div>
    )
}