import { useEffect, useState, useRef } from "react";
import type { AnimatedPropertyProps } from "./types";

export default function AnimatedHeight({ visible, duration = 0.25, onFinish, children, ...props }: AnimatedPropertyProps) {
    const [height, setHeight] = useState("0px");
    const [shouldRender, setShouldRender] = useState(visible);
    const [isAnimating, setIsAnimating] = useState(false);
    const measureRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (visible) {
            setShouldRender(true);
            setIsAnimating(true);
            // Wait for content to render, then measure
            setTimeout(() => {
                if (measureRef.current) {
                    const contentHeight = measureRef.current.scrollHeight;
                    setHeight(`${contentHeight}px`);
                }
                // Animation complete
                setTimeout(() => {
                    setIsAnimating(false);
                }, duration * 1000);
            }, 0);
        } else {
            if (shouldRender) {
                setIsAnimating(true);
                if (measureRef.current) {
                    const contentHeight = measureRef.current.scrollHeight;
                    setHeight(`${contentHeight}px`);
                    // Force a reflow before animating to 0
                    requestAnimationFrame(() => {
                        setHeight("0px");
                    });
                }
                // Hide content after animation completes
                setTimeout(() => {
                    setShouldRender(false);
                    setIsAnimating(false);
                    if (onFinish) {
                        onFinish();
                    }
                }, duration * 1000);
            }
        }
    }, [visible, shouldRender]);

    // Don't render if not visible and not animating
    if (!visible && !shouldRender && !isAnimating) {
        return null;
    }

    return (
        <div 
            {...props}
            style={{
                height,
                transition: `height ${duration}s ease`,
                overflow: "hidden",
                ...props.style
            }}
        >
            <div ref={measureRef} style={{ height: "auto" }}>
                {shouldRender && children}
            </div>
        </div>
    );
}