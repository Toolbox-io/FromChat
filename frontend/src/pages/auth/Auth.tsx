import React from "react";

export function AuthContainer({ children }: { children?: React.ReactNode }) {
    return (
        <div className="auth-container">
            <div className="auth-card scale-in">
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
    const iconType = typeof icon == "string" ? "filled" : icon.type;
    const iconName = typeof icon == "string" ? icon : icon.name;

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

export interface StepIndicatorProps {
    currentStep: number;
    totalSteps: number;
}

export function StepIndicator({ currentStep, totalSteps }: StepIndicatorProps) {
    return (
        <div className="step-indicator">
            {Array.from({ length: totalSteps }, (_, index) => {
                const stepNumber = index + 1;
                const isActive = stepNumber === currentStep;
                const isCompleted = stepNumber < currentStep;
                
                return (
                    <React.Fragment key={stepNumber}>
                        <div className={`step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`} />
                        {index < totalSteps - 1 && (
                            <div className={`step-line ${isCompleted ? 'active' : ''}`} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}

export interface OnboardingTipProps {
    icon?: string;
    children: React.ReactNode;
}

export function OnboardingTip({ icon = "lightbulb--filled", children }: OnboardingTipProps) {
    return (
        <div className="onboarding-tip">
            <span className={`material-symbols filled tip-icon`}>{icon}</span>
            <p className="tip-text">{children}</p>
        </div>
    );
}

export interface LoadingSpinnerProps {
    text?: string;
}

export function LoadingSpinner({ text = "Загрузка..." }: LoadingSpinnerProps) {
    return (
        <div className="loading">
            <div className="spinner"></div>
            <span>{text}</span>
        </div>
    );
}