import { showLogin, showRegister } from "../../navigation";
import { AuthContainer } from "../components/Auth";

export default function LoginScreen() {
    return (
        <AuthContainer>
            <div className="auth-header">
                <h2>
                    <span className="material-symbols filled large">login</span> 
                    Добро пожаловать!
                </h2>
                <p>Войдите в свой аккаунт</p>
            </div>
            <div className="auth-body">
                <div id="login-alerts"></div>
                
                <form id="login-form-element">
                    <mdui-text-field
                        label="Имя пользователя" 
                        id="login-username" 
                        name="username" 
                        variant="outlined"
                        icon="person--filled"
                        autocomplete="username"
                        required>
                    </mdui-text-field>
                    <mdui-text-field
                        label="Пароль" 
                        id="login-password" 
                        name="password" 
                        variant="outlined" 
                        type="password" 
                        toggle-password
                        icon="password--filled"
                        autocomplete="current-password"
                        required>
                    </mdui-text-field>

                    <mdui-button type="submit">Войти</mdui-button>
                </form>
                
                <div className="text-center">
                    <p>
                        Ещё нет аккаунта? 
                        <a 
                            href="#" 
                            id="register-link" 
                            className="link" 
                            onClick={showRegister}>
                            Зарегистрируйтесь
                        </a>
                    </p>
                </div>
            </div>
        </AuthContainer>
    )
}