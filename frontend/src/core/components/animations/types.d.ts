import type { ReactNode } from "react";

export interface BaseAnimatedPropertyProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    visible: any;
    duration?: number;
    onFinish?: () => void
    children?: ReactNode;
}

export type AnimatedPropertyProps = BaseAnimatedPropertyProps & React.ComponentPropsWithRef<"div">