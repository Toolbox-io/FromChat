import { useState, useEffect, useRef } from "react";
import { EMOJI_CATEGORIES, getRecentEmojis, addRecentEmoji } from "./emojiData";
import type { Size2D } from "../../../core/types";

interface EmojiMenuProps {
    isOpen: boolean;
    onClose: () => void;
    onEmojiSelect: (emoji: string) => void;
    position: Size2D;
}

export function EmojiMenu({ isOpen, onClose, onEmojiSelect, position }: EmojiMenuProps) {
    const [activeCategory, setActiveCategory] = useState("recent");
    const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            setRecentEmojis(getRecentEmojis());
        }
    }, [isOpen]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        }

        function handleEscape(event: KeyboardEvent) {
            if (event.key === "Escape") {
                onClose();
            }
        }

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("keydown", handleEscape);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [isOpen, onClose]);

    function handleEmojiClick(emoji: string) {
        addRecentEmoji(emoji);
        onEmojiSelect(emoji);
        onClose();
    };

    function getCurrentEmojis(): string[] {
        if (activeCategory === "recent") {
            return recentEmojis;
        }
        const category = EMOJI_CATEGORIES.find(cat => cat.name === activeCategory);
        return category?.emojis || [];
    };

    return (
        <div 
            ref={menuRef}
            className={`emoji-menu ${isOpen ? "open" : ""}`}
            style={{
                position: "fixed",
                left: position.x,
                bottom: position.y,
                zIndex: 1000,
                pointerEvents: isOpen ? "auto" : "none"
            }}
        >
            <div className="emoji-menu-header">
                <div className="emoji-category-tabs">
                    {EMOJI_CATEGORIES.map((category) => (
                        <button
                            key={category.name}
                            className={`emoji-category-tab ${activeCategory === category.name ? "active" : ""}`}
                            onClick={() => setActiveCategory(category.name)}
                            title={category.name}
                        >
                            {category.icon}
                        </button>
                    ))}
                </div>
            </div>
            
            <div className="emoji-grid">
                {getCurrentEmojis().map((emoji, index) => (
                    <button
                        key={`${activeCategory}-${index}`}
                        className="emoji-item"
                        onClick={() => handleEmojiClick(emoji)}
                        title={emoji}
                    >
                        {emoji}
                    </button>
                ))}
            </div>
            
            {getCurrentEmojis().length === 0 && activeCategory === "recent" && (
                <div className="emoji-empty-state">
                    <span>No recent emojis</span>
                </div>
            )}
        </div>
    );
}
