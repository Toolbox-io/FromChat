/**
 * @fileoverview Application configuration constants
 * @description Contains all configuration values used throughout the application
 * @author Cursor
 * @version 1.0.0
 */


export const BASE_DOMAIN = import.meta.env.VITE_API_BASE_URL || "fuzzy-couscous-x775gprv65g3v4q-8301.app.github.dev";
export const API_BASE_URL = `${location.host ? "" : `https://${BASE_DOMAIN}`}/api`;
export const API_WS_BASE_URL = `${location.host || BASE_DOMAIN}/api`;
export const PRODUCT_NAME = "GayChat";
export const MINIMUM_WIDTH = 800;