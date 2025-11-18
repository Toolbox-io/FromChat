import type { ReactNode } from "react";
import { useAppState } from "./chat/state";
import { Navigate } from "react-router-dom";

interface ProtectedRouteProps {
    children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
    const { user } = useAppState();

    return !user.authToken ? <Navigate to="/login" /> : children;
}
