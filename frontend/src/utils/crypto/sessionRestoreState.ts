/**
 * Global state to track session restoration progress
 * Used to ensure messages aren't loaded before sessions are restored
 */

let isRestoring = false;
let restorePromise: Promise<void> | null = null;
let restoreComplete = false;

/**
 * Mark that session restoration has started
 */
export function setRestoringSessions(promise: Promise<void>): void {
    isRestoring = true;
    restoreComplete = false;
    restorePromise = promise;
    promise.finally(() => {
        isRestoring = false;
        restoreComplete = true;
    });
}

/**
 * Wait for session restoration to complete (if in progress)
 */
export async function waitForSessionRestore(): Promise<void> {
    if (!isRestoring && restoreComplete) {
        console.log("[SessionRestoreState] Session restoration already completed");
        return; // Already completed
    }
    if (isRestoring && restorePromise) {
        console.log("[SessionRestoreState] Waiting for session restoration to complete...");
        await restorePromise;
        console.log("[SessionRestoreState] Session restoration completed");
    } else if (!restoreComplete) {
        // No restoration in progress and not completed - mark as complete to avoid blocking
        console.log("[SessionRestoreState] No session restoration in progress, marking as complete");
        restoreComplete = true;
    }
}

/**
 * Check if session restoration is in progress
 */
export function isSessionRestoreInProgress(): boolean {
    return isRestoring;
}

/**
 * Check if session restoration has completed
 */
export function hasSessionRestoreCompleted(): boolean {
    return restoreComplete;
}

/**
 * Reset the restore state (e.g., on logout)
 */
export function resetSessionRestoreState(): void {
    isRestoring = false;
    restorePromise = null;
    restoreComplete = false;
}

