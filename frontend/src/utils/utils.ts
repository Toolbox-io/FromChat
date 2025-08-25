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
    let hours = date.getHours();
    let minutes = date.getMinutes();
    const hoursString = hours < 10 ? '0' + hours : hours;
    const minutesString = minutes < 10 ? '0' + minutes : minutes;
    return hoursString + ':' + minutesString;
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

export function id<T extends Element = HTMLElement>(id: string): T {
    return document.getElementById(id) as unknown as T
}