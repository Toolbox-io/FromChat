/**
 * @fileoverview Electron-specific code
 * @description This module initializes Electron-specific functionality.
 * @author denis0001-dev
 * @version 1.0.0
 */

import "../../electron.d.ts";
import { PRODUCT_NAME } from "../core/config.ts";
import { id } from "../utils/utils.ts";

if (window.electronInterface !== undefined) {
    console.log("Running in Electron");
    document.documentElement.classList.add("electron", `platform-${window.electronInterface.platform}`);
    id("window-title").textContent = PRODUCT_NAME;
} else {
    console.log("Running in normal browser");
}