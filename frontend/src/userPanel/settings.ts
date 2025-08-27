/**
 * @fileoverview Settings dialog management and panel navigation
 * @description Handles settings dialog functionality and dynamic panel switching
 * @author Cursor
 * @version 1.0.0
 */

import type { Dialog } from "mdui/components/dialog";
import { id } from "../utils/utils";

const dialog = id<Dialog>('settings-dialog');
const openButton = id('settings-open');
const closeButton = id('settings-close');

// Settings panel management
const settingsList = document.querySelector('#settings-menu mdui-list')!;
const settingsPanels = document.querySelectorAll('.settings-panel');

/**
 * Mapping between list item text and their corresponding panel IDs
 */
const panelMapping: {[x: string]: string} = {
    'Уведомления': 'notifications-settings',
    'Внешний вид': 'appearance-settings',
    'Безопасность': 'security-settings',
    'Язык': 'language-settings',
    'Хранилище': 'storage-settings',
    'Помощь': 'help-settings',
    'О приложении': 'about-settings'
};

/**
 * Handles click events on settings list items
 * @param {Element} item - The clicked list item element
 * @private
 */
function handleListItemClick(item: Element): void {
    // Remove active class from all items and panels
    const listItems = settingsList.querySelectorAll('mdui-list-item');
    listItems.forEach(li => li.removeAttribute('active'));
    settingsPanels.forEach(panel => panel.classList.remove('active'));
    
    // Add active class to clicked item
    item.setAttribute('active', '');
    
    // Show corresponding panel using the mapping
    const itemText = item.textContent!.trim();
    const panelId = panelMapping[itemText];
    
    if (panelId) {
        const targetPanel = id(panelId);
        if (targetPanel) {
            targetPanel.classList.add('active');
        }
    }
}

/**
 * Resets settings dialog to show the first panel
 * @private
 */
function resetToFirstPanel(): void {
    const firstItem = settingsList.querySelector('mdui-list-item');
    const firstPanel = document.querySelector('.settings-panel');
    if (firstItem && firstPanel) {
        settingsList.querySelectorAll('mdui-list-item').forEach(li => li.removeAttribute('active'));
        settingsPanels.forEach(panel => panel.classList.remove('active'));
        firstItem.setAttribute('active', '');
        firstPanel.classList.add('active');
    }
}

/**
 * Initializes settings.
 * @private
 */
function init() {
    // Set up settings navigation
    settingsList.querySelectorAll('mdui-list-item').forEach((item) => {
        item.addEventListener('click', () => handleListItemClick(item));
    });

    // Set up dialog listeners
    openButton.addEventListener('click', () => {
        dialog.open = true;
        resetToFirstPanel();
    });

    closeButton.addEventListener('click', () => {
        dialog.open = false;
    });
}

init();