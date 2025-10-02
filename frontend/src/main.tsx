/**
 * @fileoverview Application entry point for FromChat frontend
 * @description Main module that initializes all required components and styles
 * @author Cursor
 * @version 1.0.0
 */

import './pages/app/resources/css/style.scss';
import "mdui/mdui.css";

import "./pages/app/utils/material";
import "./pages/app/core/init";
import "./pages/app/electron/electron";
import { createRoot } from 'react-dom/client';
import App from './App';
import { StrictMode } from 'react';

// Initialize React app
createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <App />
    </StrictMode>
);