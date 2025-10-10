import type { TextField } from "mdui/components/text-field";

type TextFieldProps = React.ComponentPropsWithoutRef<"mdui-text-field">

export function MaterialTextField(props: TextFieldProps & { ref?: React.Ref<TextField> }) {
    return (
        <mdui-text-field 
            autocomplete="off" 
            {...(props as TextFieldProps & { ref?: React.Ref<HTMLElement> })} />
    );
}