import { useState, useEffect } from "react";
import type { Message, Size2D } from "../../../core/types";

interface MessageContextMenuProps {
    message: Message;
    isAuthor: boolean;
    onEdit: (message: Message) => void;
    onReply: (message: Message) => void;
    onDelete: (message: Message) => void;
    position: Size2D;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}

export interface ContextMenuState {
    isOpen: boolean;
    message: Message | null;
    position: Size2D;
}

export function MessageContextMenu({ 
    message, 
    isAuthor, 
    onEdit, 
    onReply, 
    onDelete, 
    position,
    isOpen,
    onOpenChange
}: MessageContextMenuProps) {
    // Internal state for closing animation
    const [isClosing, setIsClosing] = useState(false);
    const [calculatedPosition, setCalculatedPosition] = useState(position);
    const [animationClass, setAnimationClass] = useState('entering');

    // Calculate smart positioning when component opens
    useEffect(() => {
        if (isOpen) {
            const menuWidth = 160; // min-width from CSS
            const menuHeight = isAuthor ? 120 : 60; // Approximate height based on items
            const padding = 10; // Padding from viewport edges
            
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            let x = position.x;
            let y = position.y;
            let animation = 'entering';
            
            // Check if menu would overflow right edge
            if (x + menuWidth + padding > viewportWidth) {
                x = viewportWidth - menuWidth - padding;
                animation = 'entering-left'; // Animation from left side
            }
            
            // Check if menu would overflow bottom edge
            if (y + menuHeight + padding > viewportHeight) {
                y = viewportHeight - menuHeight - padding;
                animation = 'entering-up'; // Animation from bottom
            }
            
            // If both edges would overflow, use top-left positioning
            if (x + menuWidth + padding > viewportWidth && y + menuHeight + padding > viewportHeight) {
                x = Math.max(padding, position.x - menuWidth);
                y = Math.max(padding, position.y - menuHeight);
                animation = 'entering-up-left';
            }
            
            setCalculatedPosition({ x, y });
            setAnimationClass(animation);
        }
    }, [isOpen, position, isAuthor]);

    // Effect to handle clicks outside the context menu
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isOpen && !isClosing) {
                // Check if the click is on a context menu element
                const target = event.target as Element;
                if (!target.closest('.context-menu')) {
                    handleClose();
                }
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isOpen && !isClosing) {
                handleClose();
            }
        };

        const handleWindowBlur = () => {
            // Close context menu when browser window loses focus
            if (isOpen && !isClosing) {
                handleClose();
            }
        };

        // Add event listeners
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        window.addEventListener('blur', handleWindowBlur);

        // Cleanup
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('blur', handleWindowBlur);
        };
    }, [isOpen, isClosing]);
    
    const handleAction = (action: string) => {
        switch (action) {
            case "reply":
                onReply(message);
                handleClose();
                break;
            case "edit":
                if (isAuthor) onEdit(message);
                break;
            case "delete":
                if (isAuthor) {
                    onDelete(message);
                    handleClose();
                }
                break;
        }
    };

    const handleClose = () => {
        setIsClosing(true);
        // Set appropriate closing animation based on opening animation
        const closingAnimation = animationClass.replace('entering', 'closing');
        setAnimationClass(closingAnimation);
        
        // Wait for animation to complete before calling onOpenChange
        setTimeout(() => {
            onOpenChange(false);
            setIsClosing(false);
            setAnimationClass('entering'); // Reset for next opening
        }, 200); // Match the animation duration from _animations.scss
    };

    // Inline edit handled by parent via onEdit


    const content = (
        <div 
            className={`context-menu ${animationClass}`}
            style={{
                position: "fixed",
                display: "block",
                top: calculatedPosition.y,
                left: calculatedPosition.x,
                zIndex: 1000
            }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="context-menu-item" onClick={() => handleAction("reply")}>
                <span className="material-symbols">reply</span>
                Ответить
            </div>
            {isAuthor && (
                <>
                    <div className="context-menu-item" onClick={() => handleAction("edit")}>
                        <span className="material-symbols">edit</span>
                        Редактировать
                    </div>
                    <div className="context-menu-item" onClick={() => handleAction("delete")}>
                        <span className="material-symbols">delete</span>
                        Удалить
                    </div>
                </>
            )}
        </div>
    )

    // Don't render if not open
    if (!isOpen) return null;

    return (
        <>
            {isOpen ? content : null}
        </>
    );
}
