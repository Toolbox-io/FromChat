import { MINIMUM_WIDTH } from "./pages/app/core/config";
import { isElectron } from "./pages/app/electron/electron";
import { ElectronTitleBar } from "./pages/app/ui/components/Electron";
import useWindowSize from "./pages/app/ui/hooks/useWindowSize";
import ChatScreen from "./pages/app/ui/screen/ChatScreen";
import DownloadAppScreen from "./pages/app/ui/screen/DownloadAppScreen";
import LoginScreen from "./pages/app/ui/screen/LoginScreen";
import RegisterScreen from "./pages/app/ui/screen/RegisterScreen";
import { useAppState } from "./pages/app/ui/state";
import { useEffect } from "react";

export default function App() {
    const { currentPage, restoreUserFromStorage } = useAppState();
    const { width } = useWindowSize();

    // Restore user from localStorage on app initialization
    useEffect(() => {
        restoreUserFromStorage();
    }, [restoreUserFromStorage]);

    if (!isElectron && width < MINIMUM_WIDTH) {
        return <DownloadAppScreen />
    }

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