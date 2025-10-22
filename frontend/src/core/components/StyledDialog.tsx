import { createPortal } from "react-dom";
import { useEffect, type ReactNode } from "react";
import { motion, AnimatePresence, type Transition } from "motion/react";

interface StyledDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: ReactNode;
    onBackdropClick?: () => void;
    className?: string;
}

export function StyledDialog({ 
    open, 
    onOpenChange, 
    children, 
    onBackdropClick,
    className = ""
}: StyledDialogProps) {
    const transition: Transition = { duration: 0.3, type: "tween", ease: "easeInOut" };

    // Handle ESC key
    useEffect(() => {
        if (open) {
            function handleEsc(e: KeyboardEvent) {
                if (e.key === "Escape") {
                    onOpenChange(false);
                }
            }

            document.addEventListener("keydown", handleEsc);
            return () => document.removeEventListener("keydown", handleEsc);
        }
    }, [open, onOpenChange]);

    return createPortal(
        <AnimatePresence>
            {open && (
                <motion.div
                    className={`styled-dialog-backdrop ${className}`}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            if (onBackdropClick) {
                                onBackdropClick();
                            } else {
                                onOpenChange(false);
                            }
                        }
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={transition}>
                    <motion.div
                        className={`styled-dialog ${className}`}
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        transition={transition}>
                        <div className="styled-dialog-content">
                            {children}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.getElementById("root")!
    );
}
