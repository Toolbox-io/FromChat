import type { ReactNode } from "react";

export interface BaseAnimatedPropertyProps {
    visible: any;
    duration?: number;
    onFinish?: () => void
    children?: ReactNode;
}

export type AnimatedPropertyProps = BaseAnimatedPropertyProps & React.ComponentPropsWithRef<"div">