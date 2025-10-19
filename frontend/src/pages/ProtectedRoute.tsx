import { useEffect } from "react";
import { useAppState } from "./chat/state";
import { useNavigate } from "react-router-dom";

interface ProtectedRouteProps {
    children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
    const { user } = useAppState();
    const navigate = useNavigate();

    useEffect(() => {
        if (!user.authToken) {
            navigate("/login");
            return;
        }
    }, [user.authToken, user.currentUser, navigate]);

    return <>{children}</>;
}
