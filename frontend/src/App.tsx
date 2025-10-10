import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ElectronTitleBar } from "./Electron";
import { useAppState } from "./pages/chat/state";
import { useEffect, useState, lazy } from "react";
import ProtectedRoute from "./pages/ProtectedRoute";
import NotFoundPage from "./pages/not-found/NotFoundPage";
import DownloadAppPage from "./pages/download-app/DownloadAppPage";

// Lazy load route components
const HomePage = lazy(() => import("./pages/home/HomePage"));
const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const RegisterPage = lazy(() => import("./pages/auth/RegisterPage"));
const ChatPage = lazy(() => import("./pages/chat/ui/ChatPage"));

export default function App() {
    const { restoreUserFromStorage } = useAppState();
    const [authReady, setAuthReady] = useState(false);

    // Restore user from localStorage on app initialization
    useEffect(() => {
        restoreUserFromStorage().finally(() => {
            setAuthReady(true);
        });
    }, [restoreUserFromStorage]);

    return authReady && (
        <BrowserRouter>
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