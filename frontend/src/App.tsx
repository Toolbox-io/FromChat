import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ElectronTitleBar } from "./Electron";
import { useAppState } from "./pages/chat/state";
import { useEffect, useState, lazy, Suspense } from "react";
import { isElectron } from "./core/electron/electron";
import { MINIMUM_WIDTH } from "./core/config";
import useWindowSize from "./core/hooks/useWindowSize";
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
                    <Route path="/" element={
                        <Suspense>
                            <HomePage />
                        </Suspense>
                    } />
                    <Route path="/login" element={
                        <Suspense>
                            <LoginPage />
                        </Suspense>
                    } />
                    <Route path="/register" element={
                        <Suspense>
                            <RegisterPage />
                        </Suspense>
                    } />
                    <Route path="/download-app" element={
                        <DownloadAppPage />
                    } />
                    <Route path="/">
                        <Route path="chat" element={
                            <ProtectedRoute>
                                <ChatPage />
                            </ProtectedRoute>
                        } />
                    </Route>
                    <Route path="*" element={
                        <NotFoundPage />
                    } />
                </Routes>
            </div>
        </BrowserRouter>
    )
}