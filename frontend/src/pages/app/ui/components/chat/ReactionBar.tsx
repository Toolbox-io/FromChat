import { useState, useEffect } from "react";
import type { Size2D } from "../../../core/types";

interface ReactionBarProps {
    isOpen: boolean;
    onClose: () => void;
    onEmojiSelect: (emoji: string) => void;
    onExpandClick: () => void;
    position: Size2D;
}

// Most common emojis for quick reactions
const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "😡"];

export function ReactionBar({ isOpen, onClose, onEmojiSelect, onExpandClick, position }: ReactionBarProps) {
    const [isClosing, setIsClosing] = useState(false);
    const [calculatedPosition, setCalculatedPosition] = useState(position);

    function handleEmojiClick(emoji: string) {
        onEmojiSelect(emoji);
        handleClose();
    }

    // Smart positioning logic to avoid screen edge clipping
    useEffect(() => {
        if (isOpen) {
            const barWidth = 240; // Approximate width of reaction bar (6 emojis + expand button)
            const barHeight = 48; // Approximate height
            const padding = 10; // Padding from viewport edges
            
            const viewportWidth = window.innerWidth;
            
            let x = position.x;
            let y = position.y - barHeight - 20; // 20px above the position
            
            // Check if bar would overflow right edge
            if (x + barWidth + padding > viewportWidth) {
                x = viewportWidth - barWidth - padding;
            }
            
            // Check if bar would overflow left edge
            if (x < padding) {
                x = padding;
            }
            
            // Check if bar would overflow top edge
            if (y < padding) {
                y = position.y + 40; // Position below instead of above
            }
            
            setCalculatedPosition({ x, y });
        }
    }, [isOpen, position]);

    function handleClose() {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
            setIsClosing(false);
        }, 150);
    }

    if (!isOpen) return null;

    return (
        <div 
            className={`reaction-bar ${isClosing ? "closing" : ""}`}
            style={{
                position: "fixed",
                left: calculatedPosition.x,
                top: calculatedPosition.y,
                zIndex: 1001 // Higher than context menu to appear above it
            }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="reaction-bar-content">
                {QUICK_REACTIONS.map((emoji, index) => (
                    <button
                        key={index}
                        className="reaction-emoji-button"
                        onClick={() => handleEmojiClick(emoji)}
                        title={emoji}
                    >
                        {emoji}
                    </button>
                ))}
                <button
                    className="reaction-expand-button"
                    onClick={() => {
                        handleClose();
                        onExpandClick();
                    }}
                    title="More emojis"
                >
                    <span className="material-symbols">add</span>
                </button>
            </div>
        </div>
    );
}
