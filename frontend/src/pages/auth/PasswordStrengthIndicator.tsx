
export interface PasswordStrengthIndicatorProps {
    password: string;
    confirmPassword?: string;
}

export type PasswordStrength = "weak" | "medium" | "strong";

export interface PasswordRequirement {
    text: string;
    met: boolean;
}

export function PasswordStrengthIndicator({ password, confirmPassword }: PasswordStrengthIndicatorProps) {
    const getPasswordStrength = (password: string): PasswordStrength => {
        if (password.length < 5) return "weak";
        
        let score = 0;
        
        // Length check
        if (password.length >= 8) score++;
        if (password.length >= 12) score++;
        
        // Character variety checks
        if (/[a-z]/.test(password)) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^a-zA-Z0-9]/.test(password)) score++;
        
        if (score < 3) return "weak";
        if (score < 5) return "medium";
        return "strong";
    };

    const getRequirements = (password: string): PasswordRequirement[] => {
        return [
            {
                text: "Минимум 5 символов",
                met: password.length >= 5
            },
            {
                text: "Рекомендуется 8+ символов",
                met: password.length >= 8
            },
            {
                text: "Содержит строчные буквы",
                met: /[a-z]/.test(password)
            },
            {
                text: "Содержит заглавные буквы",
                met: /[A-Z]/.test(password)
            },
            {
                text: "Содержит цифры",
                met: /[0-9]/.test(password)
            },
            {
                text: "Содержит специальные символы",
                met: /[^a-zA-Z0-9]/.test(password)
            }
        ];
    };

    const strength = getPasswordStrength(password);
    const requirements = getRequirements(password);
    const passwordsMatch = confirmPassword ? password === confirmPassword : true;

    const getStrengthColor = (strength: PasswordStrength): string => {
        switch (strength) {
            case "weak": return "#ef4444";
            case "medium": return "#f59e0b";
            case "strong": return "#10b981";
            default: return "#6b7280";
        }
    };

    const getStrengthLabel = (strength: PasswordStrength): string => {
        switch (strength) {
            case "weak": return "Слабый";
            case "medium": return "Средний";
            case "strong": return "Сильный";
            default: return "";
        }
    };

    const getStrengthWidth = (strength: PasswordStrength): string => {
        switch (strength) {
            case "weak": return "33%";
            case "medium": return "66%";
            case "strong": return "100%";
            default: return "0%";
        }
    };

    if (!password) return null;

    return (
        <div className="password-strength-indicator">
            <div className="strength-bar-container">
                <div className="strength-bar">
                    <div 
                        className="strength-fill"
                        style={{
                            width: getStrengthWidth(strength),
                            backgroundColor: getStrengthColor(strength)
                        }}
                    />
                </div>
                <span className="strength-label" style={{ color: getStrengthColor(strength) }}>
                    {getStrengthLabel(strength)}
                </span>
            </div>
            
            <div className="requirements-list">
                {requirements.map((requirement, index) => (
                    <div key={index} className={`requirement ${requirement.met ? 'met' : 'unmet'}`}>
                        <span className="material-symbols filled requirement-icon">
                            {requirement.met ? 'check_circle' : 'radio_button_unchecked'}
                        </span>
                        <span className="requirement-text">{requirement.text}</span>
                    </div>
                ))}
            </div>

            {confirmPassword && (
                <div className={`password-match ${passwordsMatch ? 'match' : 'no-match'}`}>
                    <span className="material-symbols filled">
                        {passwordsMatch ? 'check_circle' : 'cancel'}
                    </span>
                    <span>
                        {passwordsMatch ? 'Пароли совпадают' : 'Пароли не совпадают'}
                    </span>
                </div>
            )}
        </div>
    );
}
