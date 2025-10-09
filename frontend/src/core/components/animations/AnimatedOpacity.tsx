import { useEffect, useState } from "react";
import type { AnimatedPropertyProps } from "./types";

export default function AnimatedOpacity({ visible, duration = 0.5, onFinish, children, ...props }: AnimatedPropertyProps) {
    const [opacity, setOpacity] = useState(visible ? 1 : 0);
    const [shouldRender, setShouldRender] = useState(visible);

    useEffect(() => {
        if (visible) {
            setShouldRender(true);
            setOpacity(0);

            // Wait for content to render, then animate in
            const id = setTimeout(() => {
                setOpacity(1);
            }, 10);
            return () => clearTimeout(id);
        } else {
            setOpacity(0);

            const id = setTimeout(() => {
                setShouldRender(false);
                if (onFinish) {
                    onFinish();
                }
            }, duration * 1000);
            return () => clearTimeout(id);
        }
    }, [visible, duration, onFinish]);

    return shouldRender && (
        <div
            {...props}
            style={{
                opacity,
                transition: `opacity ${duration}s ease`,
                ...props.style
            }}
        >{children}</div>
    );
}