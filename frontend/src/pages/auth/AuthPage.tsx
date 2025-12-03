import { AuthContainer } from "./Auth";
import { useState, useRef, useLayoutEffect, useCallback, type RefObject } from "react";
import { useNavigate, useSearchParams, Navigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import useDownloadAppScreen from "@/core/hooks/useDownloadAppScreen";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";
import type { Variants, Transition } from "motion/react";
import styles from "./auth.module.scss";
import { useUserStore } from "@/state/user";

const slideVariants: Variants = {
    enter: (direction: number) => ({
        x: direction > 0 ? 300 : -300,
        opacity: 0
    }),
    center: {
        x: 0,
        opacity: 1
    },
    exit: (direction: number) => ({
        x: direction > 0 ? -300 : 300,
        opacity: 0
    })
};

const slideTransition: Transition = {
    x: { 
        type: "spring", 
        stiffness: 300, 
        damping: 30 
    },
    opacity: { duration: 0.2 }
};



export default function AuthPage() {
    const [searchParams] = useSearchParams();
    const { navigate: navigateDownloadApp } = useDownloadAppScreen();
    const navigate = useNavigate();
    const { user } = useUserStore();
    
    const [direction, setDirection] = useState(0);
    const prevMode = useRef(searchParams.get("mode") || "login");
    const containerRef = useRef<HTMLDivElement>(null);
    const loginFormRef = useRef<HTMLDivElement>(null);
    const registerFormRef = useRef<HTMLDivElement>(null);
    const [containerHeight, setContainerHeight] = useState<number | "auto">("auto");
    const currentMode = searchParams.get("mode") || "login";
    const enteringElementRef = useRef<"login" | "register" | null>(null);
    const [effectActivated, setEffectActivated] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);

    useLayoutEffect(() => {
        if (prevMode.current !== currentMode) {
            const previousMode = prevMode.current;
            
            // Measure the exiting form's height BEFORE changing anything
            // This works whether it's relative or absolute
            const exitingComponent = previousMode === "login" ? loginFormRef.current : registerFormRef.current;
            let measuredHeight: number | null = null;
            if (exitingComponent) {
                const height = exitingComponent.scrollHeight;
                if (height > 0) {
                    measuredHeight = height;
                }
            }
            
            // Update mode and direction first
            prevMode.current = currentMode;
            setDirection(currentMode === "register" ? 1 : -1);
            enteringElementRef.current = currentMode as "login" | "register";
            
            // Set height and transition state together
            if (measuredHeight !== null) {
                setContainerHeight(measuredHeight);
            }
            setIsTransitioning(true);
        }
    }, [currentMode]);

    const measureActiveHeight = useCallback(() => {
        const activeComponent = currentMode === "login" ? loginFormRef.current : registerFormRef.current;
        if (activeComponent) {
            const height = activeComponent.scrollHeight;
            if (height > 0) {
                setContainerHeight(height);
            }
        }
    }, [currentMode, loginFormRef, registerFormRef]);

    useLayoutEffect(() => {
        if (!effectActivated) {
            setEffectActivated(true);
            return;
        }
        
        // Always measure, but prioritize the entering element during transitions
        // Use double requestAnimationFrame to ensure DOM is fully updated and layout is complete
        let rafId2: number | null = null;
        const rafId1 = requestAnimationFrame(() => {
            rafId2 = requestAnimationFrame(() => {
                measureActiveHeight();
            });
        });

        return () => {
            cancelAnimationFrame(rafId1);
            if (rafId2 !== null) {
                cancelAnimationFrame(rafId2);
            }
        };
    }, [currentMode]);

    // Now we can do conditional returns after all hooks are called
    if (navigateDownloadApp) return navigateDownloadApp;
    if (user.authToken && user.currentUser) {
        return <Navigate to="/chat" replace />;
    }
    
    function switchMode(newMode: "login" | "register") {
        navigate(`/auth?mode=${newMode}`, { replace: true });
    }

    function handleAnimationComplete(
        currentMode: "login" | "register", 
        mode: "login" | "register", 
        enteringElementRef: RefObject<"login" | "register" | null>,
        formRef: React.RefObject<HTMLDivElement | null>,
        setContainerHeight: (height: number) => void
    ) {
        return () => {
            if (currentMode === mode && enteringElementRef.current === mode) {
                enteringElementRef.current = null;
                setIsTransitioning(false);

                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        if (formRef.current && currentMode === mode) {
                            const height = formRef.current.scrollHeight;
                            if (height > 0) {
                                setContainerHeight(height);
                            }
                        }
                    });
                });
            }
        }
    }

    return (
        <AuthContainer>
            <div 
                ref={containerRef}
                style={{ 
                    position: "relative", 
                    width: "100%",
                    height: containerHeight === "auto" ? "auto" : `${containerHeight}px`,
                    transition: "height 0.3s ease"
                }}
                onAnimationEnd={() => {
                    setContainerHeight("auto");
                }}
            >
                <AnimatePresence mode="sync" custom={direction}>
                    {currentMode === "login" ? (
                        <motion.div
                            key="login"
                            ref={loginFormRef}
                            custom={direction}
                            variants={slideVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={slideTransition}
                            onAnimationComplete={handleAnimationComplete("login", "login", enteringElementRef, loginFormRef, setContainerHeight)}
                            className={styles.formWrapper}
                            style={{
                                position: (containerHeight === "auto" && !isTransitioning) ? "relative" : "absolute"
                            }}
                        >
                            <LoginForm onSwitchMode={() => switchMode("register")} />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="register"
                            ref={registerFormRef}
                            custom={direction}
                            variants={slideVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={slideTransition}
                            onAnimationComplete={handleAnimationComplete("register", "register", enteringElementRef, registerFormRef, setContainerHeight)}
                            className={styles.formWrapper}
                            style={{
                                position: (containerHeight === "auto" && !isTransitioning) ? "relative" : "absolute"
                            }}
                        >
                            <RegisterForm onSwitchMode={() => switchMode("login")} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </AuthContainer>
    )
}
