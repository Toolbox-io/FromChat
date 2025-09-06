import { ElectronTitleBar } from "./components/Electron";
import ChatScreen from "./screen/ChatScreen";
import LoginScreen from "./screen/LoginScreen";
import RegisterScreen from "./screen/RegisterScreen";
import { useAppState } from "./state";
import { useEffect } from "react";

export default function App() {
    const { currentPage, restoreUserFromStorage } = useAppState();

    // Restore user from localStorage on app initialization
    useEffect(() => {
        restoreUserFromStorage();
    }, [restoreUserFromStorage]);

    let page = <LoginScreen />;

    switch (currentPage) {
        case "login": {
            page = <LoginScreen />
            break;
        }
        case "register": {
            page = <RegisterScreen />
            break;
        }
        case "chat": {
            page = <ChatScreen />
            break;
        }
    }

    return (
        <>
            <ElectronTitleBar />
            <div id="main-wrapper">
                {page}
            </div>
        </>
    )
}