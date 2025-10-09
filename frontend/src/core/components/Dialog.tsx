import type { Dialog as MduiDialog } from "mdui/components/dialog";
import { useEffect, type Ref } from "react"
import { createPortal } from "react-dom";
import { id } from "../../utils/utils";
import useCombinedRefs from "../hooks/useCombinedRefs";

export interface BaseDialogProps {
    onOpenChange: (value: boolean) => void;
    ref?: Ref<MduiDialog & HTMLElement>
}

export type FullDialogProps = React.ComponentPropsWithoutRef<"mdui-dialog"> & BaseDialogProps;

export function MaterialDialog(props: FullDialogProps) {
    const [setDialogRef, dialogRef] = useCombinedRefs(props.ref);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === "attributes" && mutation.attributeName === "open") {
                    const isOpen = dialog.hasAttribute("open");
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

    return createPortal(<mdui-dialog {...props} ref={setDialogRef} />, id("root"));
}