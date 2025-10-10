/**
 * @fileoverview Utility functions used throughout the application
 * @description Contains helper functions for common operations
 * @author Cursor
 * @version 1.0.0
 */

/**
 * Formats a timestamp string to HH:MM format
 * @param {string} dateString - ISO timestamp string to format
 * @returns {string} Formatted time string in HH:MM format
 * @example
 * formatTime('2024-01-15T14:30:00Z'); // Returns "14:30"
 */
export function formatTime(dateString: string): string {
    const date = new Date(dateString);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const hoursString = hours < 10 ? "0" + hours : hours;
    const minutesString = minutes < 10 ? "0" + minutes : minutes;
    return hoursString + ":" + minutesString;
}

/**
 * Creates a promise that resolves after a specified delay
 * @param {number} ms - Delay time in milliseconds
 * @returns {Promise<void>} Promise that resolves after the delay
 * @example
 * await delay(1000); // Wait for 1 second
 */
export function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function b64(a: Uint8Array): string { 
    return btoa(String.fromCharCode(...a)); 
}

export function ub64(s: string): Uint8Array {
	const bin = atob(s);
	const arr = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) {
        arr[i] = bin.charCodeAt(i);
    }
	return arr;
}

export function id<T extends Element = HTMLElement>(id: string): T {
    return document.getElementById(id) as unknown as T
}