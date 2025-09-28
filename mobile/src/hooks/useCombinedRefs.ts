import { useRef, useCallback } from 'react';

/**
 * Hook to combine multiple refs into one
 */
export function useCombinedRefs<T>(...refs: React.Ref<T>[]): React.RefCallback<T> {
    return useCallback((node: T) => {
        refs.forEach(ref => {
            if (typeof ref === 'function') {
                ref(node);
            } else if (ref) {
                (ref as React.MutableRefObject<T>).current = node;
            }
        });
    }, refs);
}
