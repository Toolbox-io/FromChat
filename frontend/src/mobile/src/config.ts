/**
 * @fileoverview Application configuration constants for mobile
 * @description Contains all configuration values used throughout the mobile application
 * @author Cursor
 * @version 1.0.0
 */

/**
 * Base domain name for all requests in production
 * @constant
 */
export const BASE_DOMAIN = "fromchat.ru";

/**
 * Base API endpoint for all backend requests
 * @constant
 */
export const API_BASE_URL = `https://${BASE_DOMAIN}/api`;

/**
 * Full API URL including hostname and port for WebSocket connections
 * @constant
 */
export const API_WS_BASE_URL = `${BASE_DOMAIN}/api`;

/**
 * Application name displayed in UI and document title
 * @constant
 */
export const PRODUCT_NAME = "FromChat";

export const MINIMUM_WIDTH = 800;