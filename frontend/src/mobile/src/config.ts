/**
 * @fileoverview Application configuration constants for mobile
 * @description Contains all configuration values used throughout the mobile application
 * @author Cursor
 * @version 1.0.0
 */

// Import dev server config from virtual module
import { DEV_SERVER_IP, DEV_SERVER_PORT } from 'virtual:dev-server-config';

/**
 * Base domain name - dev server IP in development, production domain in production
 * @constant
 */
export const BASE_DOMAIN = __DEV__ ? `${DEV_SERVER_IP}:${DEV_SERVER_PORT}` : "fromchat.ru";

/**
 * Base API endpoint for all backend requests
 * @constant
 */
export const API_BASE_URL = __DEV__ ? `http://${BASE_DOMAIN}/api` : `https://${BASE_DOMAIN}/api`;

/**
 * Full API URL including hostname and port for WebSocket connections
 * @constant
 */
export const API_WS_BASE_URL = __DEV__ ? `${BASE_DOMAIN}/api` : `${BASE_DOMAIN}/api`;

/**
 * Application name displayed in UI and document title
 * @constant
 */
export const PRODUCT_NAME = "FromChat";

export const MINIMUM_WIDTH = 800;