import React from 'react';
import { TextInput } from 'react-native-paper';

interface TextFieldProps {
    value?: string;
    onInput?: (e: any) => void;
    onChange?: (e: any) => void;
    label?: string;
    placeholder?: string;
    variant?: string;
    disabled?: boolean;
    autocomplete?: string;
    maxlength?: number;
    id?: string;
    [key: string]: any;
}

export function MaterialTextField(props: TextFieldProps) {
    const { 
        value, 
        onInput, 
        onChange, 
        label, 
        placeholder, 
        variant = "outlined",
        disabled = false,
        autocomplete,
        maxlength,
        id,
        ...otherProps 
    } = props;

    const handleChange = (text: string) => {
        if (onInput) {
            onInput({ target: { value: text } });
        }
        if (onChange) {
            onChange({ target: { value: text } });
        }
    };

    return (
        <TextInput
            value={value}
            onChangeText={handleChange}
            label={label}
            placeholder={placeholder}
            mode={variant === "outlined" ? "outlined" : "flat"}
            disabled={disabled}
            maxLength={maxlength}
            {...otherProps}
        />
    );
}