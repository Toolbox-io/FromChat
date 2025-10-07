import { useState, useEffect, useRef } from "react";
import type { Message, Size2D } from "../../../core/types";
import { EmojiMenu } from "./EmojiMenu";

interface MessageContextMenuProps {
    message: Message;
    isAuthor: boolean;
    onEdit: (message: Message) => void;
    onReply: (message: Message) => void;
    onDelete: (message: Message) => void;
    onRetry?: (message: Message) => void;
    onReactionClick?: (messageId: number, emoji: string) => Promise<void>;
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
    onRetry,
    onReactionClick,
    position,
    isOpen,
    onOpenChange
}: MessageContextMenuProps) {
    // Internal state for closing animation
    const [isClosing, setIsClosing] = useState(false);
    const [calculatedPosition, setCalculatedPosition] = useState(position);
    const [animationClass, setAnimationClass] = useState('entering');
    const [reactionBarPosition, setReactionBarPosition] = useState<'left' | 'right'>('left');
    const [isEmojiMenuExpanded, setIsEmojiMenuExpanded] = useState(false);
    const [initialDimensions, setInitialDimensions] = useState<{ width: number; height: number } | null>(null);
    const [expandUpward, setExpandUpward] = useState(false);
    const [contextMenuHeight, setContextMenuHeight] = useState<number | null>(null);
    
    // Refs for measuring actual dimensions
    const wrapperRef = useRef<HTMLDivElement>(null);
    const reactionBarRef = useRef<HTMLDivElement>(null);
    const contextMenuRef = useRef<HTMLDivElement>(null);
    const emojiMenuRef = useRef<HTMLDivElement>(null);

    // Calculate smart positioning when component opens
    useEffect(() => {
        if (isOpen) {
            // Use a small delay to ensure elements are rendered before measuring
            const frameId = requestAnimationFrame(() => {
                if (wrapperRef.current && reactionBarRef.current && contextMenuRef.current) {
                    // Get actual dimensions from DOM elements
                    const reactionBarRect = reactionBarRef.current.getBoundingClientRect();
                    const contextMenuRect = contextMenuRef.current.getBoundingClientRect();

                    const viewportWidth = window.innerWidth;
                    const viewportHeight = window.innerHeight;

                    // Calculate shared/combined rect dimensions
                    const sharedRect = {
                        width: Math.max(reactionBarRect.width, contextMenuRect.width),
                        height: reactionBarRect.height + contextMenuRect.height
                    };

                    let x = position.x;
                    let y = position.y;
                    let animation = 'entering';
                    let reactionPosition: 'left' | 'right' = 'left';

                    // Check if shared rect would overflow and adjust position
                    if (x + sharedRect.width > viewportWidth) {
                        x = position.x - contextMenuRect.width - 25;
                        animation = 'entering-left';
                        reactionPosition = 'right';
                    } else {
                        reactionPosition = 'left';
                    }

                    // Ensure menu doesn't go off the left edge
                    if (x < 0) {
                        x = 0;
                    }

                    // Check if shared rect would overflow bottom edge
                    if (y + sharedRect.height > viewportHeight) {
                        y = viewportHeight - sharedRect.height;
                        animation = 'entering-up';
                    }
                    
                    setCalculatedPosition({ x, y });
                    setAnimationClass(animation);
                    setReactionBarPosition(reactionPosition);
                }
            });
            
            return () => cancelAnimationFrame(frameId);
        }
    }, [isOpen, position, isAuthor]);

    // Effect to handle clicks outside the context menu
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (isOpen && !isClosing) {
                // Check if the click is on a context menu element or reaction bar
                const target = event.target as Element;
                if (!target.closest('.context-menu') && !target.closest('.context-menu-reaction-bar')) {
                    handleClose();
                }
            }
        };

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape' && isOpen && !isClosing) {
                handleClose();
            }
        };

        function handleWindowBlur() {
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

    function handleClose() {
        setIsClosing(true);
        // Set appropriate closing animation based on opening animation
        const closingAnimation = animationClass.replace('entering', 'closing');
        setAnimationClass(closingAnimation);
        
        // Wait for animation to complete before calling onOpenChange
        setTimeout(() => {
            onOpenChange(false);
            setIsClosing(false);
            setAnimationClass('entering'); // Reset for next opening
                   // Reset emoji menu state after context menu animation completes
                   setIsEmojiMenuExpanded(false);
                   setInitialDimensions(null);
                   setExpandUpward(false);
                   setContextMenuHeight(null);
        }, 200); // Match the animation duration from _animations.scss
    }

    interface Action {
        label: string;
        icon: string;
        onClick: () => void;
        show: boolean;
    }

    // Check if message is sending or failed
    const isSending = message.runtimeData?.sendingState?.status === 'sending';
    const isFailed = message.runtimeData?.sendingState?.status === 'failed';
    const isSendingOrFailed = isSending || isFailed;

    const actions: Action[] = [
        {
            label: "Reply",
            icon: "reply",
            onClick: () => {
                onReply(message);
                handleClose();
            },
            show: !isSendingOrFailed
        },
        {
            label: "Edit",
            icon: "edit",
            onClick: () => {
                onEdit(message);
                handleClose();
            },
            show: isAuthor && !isSendingOrFailed
        },
        {
            label: "Retry",
            icon: "refresh",
            onClick: () => {
                if (onRetry) {
                    onRetry(message);
                }
                handleClose();
            },
            show: isAuthor && isFailed && !!onRetry
        },
        {
            label: "Delete",
            icon: "delete",
            onClick: () => {
                onDelete(message);
                handleClose();
            },
            show: isAuthor
        },
    ];

    // Quick reactions for the reaction bar
    const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "😡"];

    async function handleReactionClick(emoji: string) {
        if (onReactionClick) {
            await onReactionClick(message.id, emoji);
        }
        handleClose();
    }

    function handleExpandClick() {
        if (!reactionBarRef.current || !wrapperRef.current) return;

        // Measure the actual dimensions of the reaction bar content
        const reactionBarRect = reactionBarRef.current.getBoundingClientRect();
        const wrapperRect = wrapperRef.current.getBoundingClientRect();
        
        setInitialDimensions({ width: reactionBarRect.width, height: reactionBarRect.height });
        setContextMenuHeight(wrapperRect.height);

        // Check if expanding downward would cause overflow
        // Calculate space from the reaction bar's bottom edge downward
        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - reactionBarRect.bottom;
        const emojiMenuHeight = 400;

        // Only expand upward if there's not enough space below for the emoji menu
        const shouldExpandUpward = spaceBelow < emojiMenuHeight;
        setExpandUpward(shouldExpandUpward);

        // Use requestAnimationFrame to ensure the dimensions are applied before expansion
        requestAnimationFrame(() => {
            setIsEmojiMenuExpanded(true);
        });
    }

    function handleEmojiMenuClose() {
        setIsEmojiMenuExpanded(false);
        setInitialDimensions(null);
        setExpandUpward(false);
        setContextMenuHeight(null);
    }

    function handleEmojiSelect(emoji: string) {
        if (onReactionClick) {
            onReactionClick(message.id, emoji);
        }
        handleEmojiMenuClose();
    }

    return isOpen && (
        <div 
            ref={wrapperRef}
            className={`context-menu-wrapper ${animationClass}`}
            style={{
                position: "fixed",
                top: calculatedPosition.y,
                left: calculatedPosition.x,
                zIndex: 1000
            }}
            onClick={(e) => e.stopPropagation()}>
            
            {/* Reaction Bar */}
            <div
                ref={reactionBarRef}
                className={`context-menu-reaction-bar ${reactionBarPosition} ${isEmojiMenuExpanded ? "expanded" : ""} ${expandUpward ? "expand-upward" : ""}`}
                style={isEmojiMenuExpanded && !expandUpward ? {
                    position: 'fixed',
                    top: `${(-(contextMenuHeight || 0) + 5)}px`,
                    width: '320px',
                    height: '400px',
                    zIndex: 1001
                } : initialDimensions && !isEmojiMenuExpanded ? {
                    width: `${initialDimensions.width}px`,
                    height: `${initialDimensions.height}px`
                } : {}}>
                {!isEmojiMenuExpanded ? (
                    <div className="reaction-bar-content">
                        {QUICK_REACTIONS.map((emoji, index) => (
                            <button
                                key={index}
                                className="reaction-emoji-button"
                                onClick={async () => await handleReactionClick(emoji)}
                                title={emoji}
                            >
                                {emoji}
                            </button>
                        ))}
                        <button
                            className="reaction-expand-button"
                            onClick={handleExpandClick}
                            title="More emojis"
                        >
                            <span className="material-symbols">add</span>
                        </button>
                    </div>
                       ) : (
                           <div 
                               ref={emojiMenuRef} 
                               className="emoji-menu-wrapper">
                               <EmojiMenu
                                   isOpen={true}
                                   onClose={handleEmojiMenuClose}
                                   onEmojiSelect={handleEmojiSelect}
                                   mode="integrated"
                               />
                           </div>
                       )}
            </div>

            {/* Context Menu */}
            <div 
                ref={contextMenuRef}
                className={`context-menu ${isEmojiMenuExpanded ? "faded" : ""}`}>
                {actions.map((action, i) => (
                    action.show && (
                        <div 
                            className="context-menu-item"
                            onClick={action.onClick}
                            key={i}
                        >
                            <span className="material-symbols">{action.icon}</span>
                            {action.label}
                        </div>
                    )
                ))}
            </div>

        </div>
    )
}
