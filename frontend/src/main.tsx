/**
 * @fileoverview Application entry point for FromChat frontend
 * @description Main module that initializes all required components and styles
 * @author Cursor
 * @version 1.0.0
 */

import './css/style.scss';
import "mdui/mdui.css";

import "./pages/chat/utils/material";
import "./pages/chat/core/init";
import "./pages/chat/electron/electron";
import { createRoot } from 'react-dom/client';
import App from './App';
import { StrictMode } from 'react';

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <App />
    </StrictMode>
);