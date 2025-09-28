import React from 'react';
import { Portal, Dialog as PaperDialog } from 'react-native-paper';

export interface BaseDialogProps {
    onOpenChange: (value: boolean) => void;
    open?: boolean;
    children?: React.ReactNode;
    [key: string]: any;
}

export type FullDialogProps = BaseDialogProps;

export function MaterialDialog(props: FullDialogProps) {
    const { open = false, onOpenChange, children, ...otherProps } = props;

    return (
        <Portal>
            <PaperDialog 
                visible={open} 
                onDismiss={() => onOpenChange?.(false)}
                {...otherProps}
            >
                {children}
            </PaperDialog>
        </Portal>
    );
}