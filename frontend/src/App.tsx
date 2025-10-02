import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ElectronTitleBar } from "./pages/app/ui/components/Electron";
import { useAppState } from "./pages/app/ui/state";
import { useEffect, useState } from "react";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ChatPage from "./pages/ChatPage";
import NotFoundPage from "./pages/NotFoundPage";
import ProtectedRoute from "./pages/ProtectedRoute";
import { isElectron } from "./pages/app/electron/electron";
import { MINIMUM_WIDTH } from "./pages/app/core/config";
import useWindowSize from "./pages/app/ui/hooks/useWindowSize";

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
                    <Route path="/" element={<Navigate to="/login" replace />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
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