import type { Dialog as MduiDialog } from "mdui/components/dialog";
import React, { useEffect, useRef } from "react"

export interface BaseDialogProps {
    onOpenChange: (value: boolean) => void;
}

export type FullDialogProps = React.ComponentPropsWithoutRef<"mdui-dialog"> & BaseDialogProps;

export function MaterialDialog(props: FullDialogProps) {
    const dialogRef = useRef<MduiDialog>(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === "attributes" && mutation.attributeName === "open") {
                    const isOpen = dialog.hasAttribute("open");
                    console.log("isOpen:", isOpen);
                    if (isOpen !== props.open) {
                        props.onOpenChange(isOpen);
                    }
                }
            });
        });

        // Start observing the dialog element for attribute changes
        observer.observe(dialog, {
            attributes: true,
            attributeFilter: ["open"]
        });

        // Cleanup observer
        return () => {
            observer.disconnect();
        };
    }, [dialogRef.current, props.open, props.onOpenChange]);

    return <mdui-dialog {...props} ref={dialogRef} style={{ all: "revert" }} />;
}