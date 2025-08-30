import { ElectronTitleBar } from "./components/Electron";
import ChatScreen from "./screen/ChatScreen";
import LoginScreen from "./screen/LoginScreen";
import RegisterScreen from "./screen/RegisterScreen";
import { useAppState } from "./state";
import { DialogProvider } from "./contexts/DialogContext";

export default function App() {
    const { currentPage } = useAppState();

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
        <DialogProvider>
            <ElectronTitleBar />
            <div id="main-wrapper">
                {page}
            </div>
        </DialogProvider>
    )
}