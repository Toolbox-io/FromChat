import { BrowserRouter, Routes, Route, useNavigate, matchRoutes, type RouteObject } from "react-router-dom";
import { ElectronTitleBar } from "./Electron";
import { useAppState } from "./pages/chat/state";
import { lazy, useEffect, useState } from "react";
import { parseProfileLink } from "./core/profileLinks.ts";
import NotFoundPage from "./pages/not-found/NotFoundPage.tsx";
import ProtectedRoute from "./pages/ProtectedRoute.tsx";
import DownloadAppPage from "./pages/download-app/DownloadAppPage.tsx";

// Lazy load route components
const HomePage = lazy(() => import("./pages/home/HomePage"));
const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const RegisterPage = lazy(() => import("./pages/auth/RegisterPage"));
const ChatPage = lazy(() => import("./pages/chat/ui/ChatPage"));

const routeConfig: RouteObject[] = [
    { path: "/", element: <HomePage /> },
    { path: "/login", element: <LoginPage /> },
    { path: "/register", element: <RegisterPage /> },
    { path: "/download-app", element: <DownloadAppPage /> },
    {
        path: "/chat", 
        element: (
            <ProtectedRoute>
                <ChatPage />
            </ProtectedRoute>
        ) 
    },
    { path: "*", element: <SmartCatchAll /> }
];

function SmartCatchAll() {
    const navigate = useNavigate();
    const [showNotFound, setShowNotFound] = useState(false);

    function isValidRoute(path: string): boolean {
        const validRoutes = routeConfig.filter(route => route.path !== "*");
        const matches = matchRoutes(validRoutes, path);
        
        return Boolean(matches && matches.length > 0);
    }

    useEffect(() => {
        if (isValidRoute(location.pathname)) {
            setShowNotFound(false);
            return;
        }
        
        // Check if it's a profile link
        const profileInfo = parseProfileLink(); // no url specified intentionally to let it use the current url
        
        if (profileInfo) {
            setShowNotFound(false);
            navigate("/chat", { 
                replace: true,
                state: { profileInfo }
            });
        } else {
            setShowNotFound(true);
        }
    }, [navigate]);

    // Show 404 page
    if (showNotFound) {
        return <NotFoundPage />;
    }
}

export default function App() {
    const { restoreUserFromStorage } = useAppState();
    const [authReady, setAuthReady] = useState(false);

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
                    {routeConfig.map((route, index) => (
                        <Route key={index} path={route.path} element={route.element} />
                    ))}
                </Routes>
            </div>
        </BrowserRouter>
    )
}