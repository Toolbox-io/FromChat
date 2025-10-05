import { useAppState } from "../../state";
import { useState, useEffect } from "react";
import type { Reaction } from "../../../core/types";

interface MessageReactionsProps {
    reactions?: Reaction[];
    onReactionClick: (emoji: string) => void;
    messageId?: number; // Add messageId to ensure unique keys
}

export function MessageReactions({ reactions, onReactionClick, messageId }: MessageReactionsProps) {
    const { user } = useAppState();
    const [visibleReactions, setVisibleReactions] = useState<Reaction[]>([]);
    const [animatingReactions, setAnimatingReactions] = useState<Set<string>>(new Set());

    // Handle reactions with animation
    useEffect(() => {
        if (!reactions || reactions.length === 0) {
            // Animate out all visible reactions
            visibleReactions.forEach(reaction => {
                setAnimatingReactions(prev => new Set(prev).add(reaction.emoji));
                setTimeout(() => {
                    setVisibleReactions([]);
                    setAnimatingReactions(new Set());
                }, 200);
            });
            return;
        }

        // Deduplicate reactions by emoji (safety measure)
        const uniqueReactions = reactions.reduce((acc, reaction) => {
            const existing = acc.find(r => r.emoji === reaction.emoji);
            if (existing) {
                // Keep the one with the higher count
                if (reaction.count > existing.count) {
                    acc[acc.indexOf(existing)] = reaction;
                }
            } else {
                acc.push(reaction);
            }
            return acc;
        }, [] as Reaction[]);


        // Animate out removed reactions
        visibleReactions.forEach(reaction => {
            if (!uniqueReactions.some(r => r.emoji === reaction.emoji)) {
                setAnimatingReactions(prev => new Set(prev).add(reaction.emoji));
                setTimeout(() => {
                    setVisibleReactions(prev => prev.filter(r => r.emoji !== reaction.emoji));
                    setAnimatingReactions(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(reaction.emoji);
                        return newSet;
                    });
                }, 200);
            }
        });

        // Update existing reactions and add new ones
        setVisibleReactions(prev => {
            const updated = [...prev];
            
            // Update existing reactions
            uniqueReactions.forEach(reaction => {
                const existingIndex = updated.findIndex(r => r.emoji === reaction.emoji);
                if (existingIndex !== -1) {
                    updated[existingIndex] = reaction;
                } else {
                    // Add new reaction only if it doesn't already exist
                    if (!updated.some(r => r.emoji === reaction.emoji)) {
                        updated.push(reaction);
                    }
                }
            });
            
            return updated;
        });
    }, [reactions]);

    if (!reactions || reactions.length === 0) {
        return null;
    }

    return (
        <div className="message-reactions">
            {visibleReactions.map((reaction, index) => {
                const hasUserReacted = reaction.users.some(u => u.id === user.currentUser?.id);
                const isAnimating = animatingReactions.has(reaction.emoji);
                
                // Create a unique key that includes messageId, emoji, count, and index to prevent duplicates
                const uniqueKey = `${messageId || 'unknown'}-${reaction.emoji}-${reaction.count}-${index}`;
                
                return (
                    <button
                        key={uniqueKey}
                        className={`reaction-button ${hasUserReacted ? "reacted" : ""} ${isAnimating ? "removing" : ""}`}
                        onClick={() => onReactionClick(reaction.emoji)}
                        title={reaction.users.map(u => u.username).join(", ")}
                    >
                        <span className="reaction-emoji">{reaction.emoji}</span>
                        <span className="reaction-count">{reaction.count}</span>
                    </button>
                );
            })}
        </div>
    );
}
