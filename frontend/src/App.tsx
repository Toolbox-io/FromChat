import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ElectronTitleBar } from "./pages/chat/ui/components/Electron";
import { useAppState } from "./pages/chat/ui/state";
import { useEffect, useState } from "react";
import HomePage from "./pages/home/HomePage";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import ChatPage from "./pages/chat/ChatPage";
import DownloadAppPage from "./pages/download-app/DownloadAppPage";
import NotFoundPage from "./pages/not-found/NotFoundPage";
import ProtectedRoute from "./pages/ProtectedRoute";
import { isElectron } from "./core/electron/electron";
import { MINIMUM_WIDTH } from "./core/config";
import useWindowSize from "./pages/chat/ui/hooks/useWindowSize";

export default function App() {
    const { restoreUserFromStorage } = useAppState();
    const { width } = useWindowSize();
    const [authReady, setAuthReady] = useState(false);

    // Restore user from localStorage on app initialization
    useEffect(() => {
        restoreUserFromStorage().finally(() => {
            setAuthReady(true);
        });
    }, [restoreUserFromStorage]);

    return authReady && (
        <BrowserRouter>
            {!isElectron && width < MINIMUM_WIDTH && <Navigate to="/download-app" replace />}
            <ElectronTitleBar />
            <div id="main-wrapper">
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/download-app" element={<DownloadAppPage />} />
                    <Route path="/">
                        <Route path="chat" element={
                            <ProtectedRoute>
                                <ChatPage />
                            </ProtectedRoute>
                        } />
                    </Route>
                    <Route path="*" element={<NotFoundPage />} />
                </Routes>
            </div>
        </BrowserRouter>
    )
}