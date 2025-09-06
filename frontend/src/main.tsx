/**
 * @fileoverview Application entry point for FromChat frontend
 * @description Main module that initializes all required components and styles
 * @author Cursor
 * @version 1.0.0
 */

import './resources/css/style.scss';
import "mdui/mdui.css";

import "./utils/material";
import "./core/init";
import { createRoot } from 'react-dom/client';
import App from './ui/App';
import { StrictMode } from 'react';

// Initialize React app
createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <App />
    </StrictMode>
);