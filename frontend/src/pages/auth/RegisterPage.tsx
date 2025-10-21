import { useImmer } from "use-immer";
import { AuthContainer, AuthHeader, StepIndicator, OnboardingTip, AlertsContainer, type Alert, type AlertType, LoadingSpinner } from "./Auth";
import { useEffect, useRef, useState } from "react";
import { TextField } from "mdui/components/text-field";
import type { ErrorResponse, RegisterRequest, LoginResponse } from "@/core/types";
import { API_BASE_URL } from "@/core/config";
import { useAppState } from "@/pages/chat/state";
import { MaterialTextField } from "@/core/components/TextField";
import { ensureKeysOnLogin } from "@/core/api/authApi";
import { Link, useNavigate } from "react-router-dom";
import "./auth.scss";
import useDownloadAppScreen from "@/core/hooks/useDownloadAppScreen";
import { PasswordStrengthIndicator } from "./PasswordStrengthIndicator";
import { useUsernameValidation } from "./useUsernameValidation";

export default function RegisterPage() {
    const [alerts, updateAlerts] = useImmer<Alert[]>([]);
    const [currentStep, setCurrentStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        displayName: "",
        username: "",
        password: "",
        confirmPassword: ""
    });
    const [slideDirection, setSlideDirection] = useState<"left" | "right">("right");

    useEffect(() => {  
        document.body.classList.add('auth-page');
        
        return () => {
            document.body.classList.remove('auth-page');
        };
    }, []);
    
    const setUser = useAppState(state => state.setUser);
    const navigate = useNavigate();
    const { navigate: navigateDownloadApp } = useDownloadAppScreen();
    if (navigateDownloadApp) return navigateDownloadApp;

    const usernameValidation = useUsernameValidation(formData.username);

    function showAlert(type: AlertType, message: string) {
        updateAlerts((alerts) => { alerts.push({type: type, message: message}) });
    }

    const displayNameElement = useRef<TextField>(null);
    const usernameElement = useRef<TextField>(null);
    const passwordElement = useRef<TextField>(null);
    const confirmPasswordElement = useRef<TextField>(null);

    const totalSteps = 3;

    const nextStep = () => {
        if (currentStep < totalSteps) {
            setSlideDirection("right");
            setCurrentStep(currentStep + 1);
        }
    };

    const prevStep = () => {
        if (currentStep > 1) {
            setSlideDirection("left");
            setCurrentStep(currentStep - 1);
        }
    };

    const updateFormData = (field: keyof typeof formData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleStepValidation = (step: number): boolean => {
        switch (step) {
            case 1:
                if (!formData.displayName.trim()) {
                    showAlert("danger", "Пожалуйста, введите отображаемое имя");
                    return false;
                }
                if (formData.displayName.length < 1 || formData.displayName.length > 64) {
                    showAlert("danger", "Отображаемое имя должно быть от 1 до 64 символов");
                    return false;
                }
                return true;
            case 2:
                if (!formData.username.trim()) {
                    showAlert("danger", "Пожалуйста, введите имя пользователя");
                    return false;
                }
                if (!usernameValidation.isValid) {
                    showAlert("danger", "Имя пользователя недоступно или неверно");
                    return false;
                }
                return true;
            case 3:
                if (!formData.password.trim()) {
                    showAlert("danger", "Пожалуйста, введите пароль");
                    return false;
                }
                if (formData.password.length < 5 || formData.password.length > 50) {
                    showAlert("danger", "Пароль должен быть от 5 до 50 символов");
                    return false;
                }
                if (formData.password !== formData.confirmPassword) {
                    showAlert("danger", "Пароли не совпадают");
                    return false;
                }
                return true;
            default:
                return false;
        }
    };

    const handleNext = () => {
        if (handleStepValidation(currentStep)) {
            nextStep();
        }
    };

    const handleRegister = async () => {
        if (!handleStepValidation(3)) return;
        if (isLoading) return;

        setIsLoading(true);

        try {
            const request: RegisterRequest = {
                display_name: formData.displayName,
                username: formData.username,
                password: formData.password,
                confirm_password: formData.confirmPassword
            };

            const response = await fetch(`${API_BASE_URL}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request)
            });

            if (response.ok) {
                const data: LoginResponse = await response.json();
                setUser(data.token, data.user);

                try {
                    await ensureKeysOnLogin(formData.password, data.token);
                } catch (e) {
                    console.error("Key setup failed:", e);
                }

                navigate("/chat");
            } else {
                const data: ErrorResponse = await response.json();
                showAlert("danger", data.message || "Ошибка при регистрации");
            }
        } catch (error) {
            showAlert("danger", "Ошибка соединения с сервером");
        } finally {
            setIsLoading(false);
        }
    };

    const getStepContent = () => {
        const slideClass = slideDirection === "right" ? "slide-in-right" : "slide-in-left";
        
        switch (currentStep) {
            case 1:
                return (
                    <div key="step1" className={slideClass}>
                        <OnboardingTip icon="badge--filled">
                            Выберите имя, которое будут видеть другие пользователи. Это может быть ваше настоящее имя или псевдоним.
                        </OnboardingTip>
                        
                        <div className="form-field-enter">
                            <MaterialTextField
                                label="Отображаемое имя"
                                id="register-display-name"
                                name="display_name"
                                variant="outlined"
                                icon="badge--filled"
                                autocomplete="name"
                                maxlength={64}
                                counter
                                required
                                disabled={isLoading}
                                value={formData.displayName}
                                onInput={(e) => updateFormData("displayName", (e.target as HTMLInputElement).value)}
                                ref={displayNameElement} />
                        </div>

                        <div className="form-field-enter">
                            <mdui-button onClick={handleNext} disabled={isLoading}>
                                Продолжить
                            </mdui-button>
                        </div>
                    </div>
                );

            case 2:
                return (
                    <div key="step2" className={slideClass}>
                        <OnboardingTip icon="person--filled">
                            Имя пользователя должно быть уникальным. Оно будет использоваться для входа и упоминаний (@username).
                        </OnboardingTip>
                        
                        <div className="form-field-enter">
                            <MaterialTextField
                                label="@Имя пользователя"
                                id="register-username"
                                name="username"
                                variant="outlined"
                                icon="person--filled"
                                autocomplete="username"
                                maxlength={20}
                                counter
                                required
                                disabled={isLoading}
                                value={formData.username}
                                onInput={(e) => updateFormData("username", (e.target as HTMLInputElement).value)}
                                ref={usernameElement} />
                        </div>

                        {formData.username && (
                            <div className={`username-validation ${usernameValidation.state}`}>
                                <span className="material-symbols filled validation-icon">
                                    {usernameValidation.state === "checking" ? "sync" :
                                     usernameValidation.state === "available" ? "check_circle" :
                                     usernameValidation.state === "unavailable" || usernameValidation.state === "invalid" ? "cancel" : ""}
                                </span>
                                <span>{usernameValidation.message}</span>
                            </div>
                        )}

                        <div className="form-field-enter">
                            <div style={{ display: "flex", gap: "12px" }}>
                                <mdui-button variant="outlined" onClick={prevStep} disabled={isLoading}>
                                    Назад
                                </mdui-button>
                                <mdui-button onClick={handleNext} disabled={isLoading || !usernameValidation.isValid}>
                                    Продолжить
                                </mdui-button>
                            </div>
                        </div>
                    </div>
                );

            case 3:
                return (
                    <div key="step3" className={slideClass}>
                        <OnboardingTip icon="security--filled">
                            Создайте надежный пароль для защиты вашего аккаунта. Используйте комбинацию букв, цифр и специальных символов.
                        </OnboardingTip>
                        
                        <div className="form-field-enter">
                            <MaterialTextField
                                label="Пароль"
                                id="register-password"
                                name="password"
                                variant="outlined"
                                type="password"
                                toggle-password
                                icon="password--filled"
                                autocomplete="new-password"
                                required
                                disabled={isLoading}
                                value={formData.password}
                                onInput={(e) => updateFormData("password", (e.target as HTMLInputElement).value)}
                                ref={passwordElement} />
                        </div>

                        <div className="form-field-enter">
                            <MaterialTextField
                                label="Подтвердите пароль"
                                id="register-confirm-password"
                                name="confirm_password"
                                variant="outlined"
                                type="password"
                                toggle-password
                                icon="password--filled"
                                autocomplete="new-password"
                                required
                                disabled={isLoading}
                                value={formData.confirmPassword}
                                onInput={(e) => updateFormData("confirmPassword", (e.target as HTMLInputElement).value)}
                                ref={confirmPasswordElement} />
                        </div>

                        {formData.password && (
                            <PasswordStrengthIndicator 
                                password={formData.password} 
                                confirmPassword={formData.confirmPassword} 
                            />
                        )}

                        <div className="form-field-enter">
                            <div style={{ display: "flex", gap: "12px" }}>
                                <mdui-button variant="outlined" onClick={prevStep} disabled={isLoading}>
                                    Назад
                                </mdui-button>
                                <mdui-button onClick={handleRegister} disabled={isLoading}>
                                    {isLoading ? <LoadingSpinner text="Регистрация..." /> : "Зарегистрироваться"}
                                </mdui-button>
                            </div>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <AuthContainer>
            <AuthHeader icon="person_add" title="Регистрация" subtitle="Создайте новый аккаунт" />
            <div className="auth-body">
                <AlertsContainer alerts={alerts} />
                
                <StepIndicator currentStep={currentStep} totalSteps={totalSteps} />
                
                {getStepContent()}

                <div className="text-center">
                    <p>
                        Уже есть аккаунт?
                        <Link to="/login" className="link">
                            Войдите
                        </Link>
                    </p>
                </div>
            </div>
        </AuthContainer>
    )
}
