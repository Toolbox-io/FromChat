import { showLogin } from "../../navigation";
import { AuthContainer } from "../components/Auth";

export default function RegisterScreen() {
    return (
        <AuthContainer>
            <div className="auth-header">
                <h2>
                    <span className="material-symbols filled large">person_add</span> 
                    Регистрация
                </h2>
                <p>Создайте новый аккаунт</p>
            </div>
            <div className="auth-body">
                <div id="register-alerts"></div>
                
                <form id="register-form-element">
                    <mdui-text-field 
                        label="Имя пользователя" 
                        id="register-username" 
                        name="username" 
                        variant="outlined"
                        icon="person--filled"
                        autocomplete="username"
                        maxlength={20}
                        counter
                        required>
                    </mdui-text-field>
                    <mdui-text-field 
                        label="Пароль" 
                        id="register-password" 
                        name="password" 
                        variant="outlined" 
                        type="password" 
                        toggle-password
                        icon="password--filled"
                        autocomplete="new-password"
                        required>
                    </mdui-text-field>
                    <mdui-text-field 
                        label="Подтвердите пароль" 
                        id="register-confirm-password" 
                        name="confirm_password" 
                        variant="outlined" 
                        type="password" 
                        toggle-password
                        icon="password--filled"
                        autocomplete="new-password"
                        required>
                    </mdui-text-field>

                    <mdui-button type="submit">Зарегистрироваться</mdui-button>
                </form>
                
                <div className="text-center">
                    <p>
                        Уже есть аккаунт? 
                        <a 
                            href="#" 
                            id="login-link" 
                            className="link" 
                            onClick={showLogin}>
                            Войдите
                        </a>
                    </p>
                </div>
            </div>
        </AuthContainer>
    )
}