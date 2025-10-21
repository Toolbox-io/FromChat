import type { TextField } from "mdui/components/text-field";

interface TextFieldProps extends React.ComponentPropsWithoutRef<"mdui-text-field"> { 
    ref?: React.Ref<TextField> 
}

export function MaterialTextField({ ref, ...props }: TextFieldProps) {
    return <mdui-text-field autocomplete="off" ref={ref as React.Ref<HTMLElement>} {...props} />
}