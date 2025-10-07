import { Navigate, useNavigate } from "react-router-dom";
import { useAppState } from "./app/ui/state";
import { isElectron } from "./app/electron/electron";

function GitHubLink({ children }: { children: React.ReactNode }) {
    return (
        <a href="https://github.com/denis0001-dev/FromChat" target="_blank">{children}</a>
    );
}

function SupportLink({ children }: { children: React.ReactNode }) {
    return (
        <a href="https://t.me/denis0001-dev" target="_blank">{children}</a>
    );
}

export default function HomePage() {
    const navigate = useNavigate();
    const { user } = useAppState();

    const handleGetStarted = () => {
        if (user.authToken && user.currentUser) {
            navigate("/chat");
        } else {
            navigate("/login");
        }
    }

    if (isElectron) {
        return <Navigate to="/chat" />;
    }

    return (
        <div className="homepage">
            <header className="homepage-header">
                <div className="container">
                    <div className="header-content">
                        <div className="logo">
                            <h1>FromChat</h1>
                            <span className="tagline">100% открытый мессенджер</span>
                        </div>
                        <nav className="header-nav">
                            <GitHubLink>
                                <mdui-button variant="text">GitHub</mdui-button>
                            </GitHubLink>
                            <SupportLink>
                                <mdui-button variant="text">Поддержка</mdui-button>
                            </SupportLink>

                            {user.authToken ? (
                                <mdui-button variant="filled" onClick={() => navigate("/chat")}>
                                    Перейти в чат
                                </mdui-button>
                            ) : (
                                <mdui-button variant="filled" onClick={() => navigate("/login")}>
                                    Войти
                                </mdui-button>
                            )}
                        </nav>
                    </div>
                </div>
            </header>

            <main className="homepage-main">
                <section className="hero">
                    <div className="container">
                        <div className="hero-content">
                            <h2 className="hero-title">
                                Безопасный мессенджер с открытым исходным кодом
                            </h2>
                            <p className="hero-description">
                                FromChat — это полностью открытый мессенджер с end-to-end шифрованием, 
                                поддержкой файлов и уведомлений. Создан для тех, кто ценит приватность и свободу.
                            </p>
                            <div className="hero-actions">
                                <mdui-button 
                                    variant="filled" 
                                    onClick={handleGetStarted}
                                >
                                    {user.authToken ? "Перейти в чат" : "Начать общение"}
                                </mdui-button>
                                <mdui-button 
                                    variant="outlined" 
                                    onClick={() => navigate("/register")}
                                >
                                    Зарегистрироваться
                                </mdui-button>
                            </div>
                        </div>
                        <div className="hero-visual">
                            <div className="chat-preview">
                                <div className="chat-window">
                                    <div className="chat-header">
                                        <div className="chat-title">Общий чат</div>
                                        <div className="online-indicator">●</div>
                                    </div>
                                    <div className="chat-messages">
                                        <div className="message received">
                                            <div className="message-avatar">А</div>
                                            <div className="message-content">
                                                <div className="message-text">Привет! Как дела?</div>
                                                <div className="message-time">14:30</div>
                                            </div>
                                        </div>
                                        <div className="message sent">
                                            <div className="message-content">
                                                <div className="message-text">Всё отлично! А у тебя как?</div>
                                                <div className="message-time">14:32</div>
                                            </div>
                                        </div>
                                        <div className="message received">
                                            <div className="message-avatar">Б</div>
                                            <div className="message-content">
                                                <div className="message-text">Отправляю файл 📎</div>
                                                <div className="message-time">14:35</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="features">
                    <div className="container">
                        <h3 className="section-title">Возможности</h3>
                        <div className="features-grid">
                            <div className="feature-card">
                                <div className="feature-icon">
                                    <mdui-icon name="security"></mdui-icon>
                                </div>
                                <h4>End-to-End Шифрование</h4>
                                <p>
                                    Ваши личные сообщения защищены современным шифрованием X25519 + AES-GCM. 
                                    Только вы и получатель можете прочитать сообщения.
                                </p>
                            </div>
                            
                            <div className="feature-card">
                                <div className="feature-icon">
                                    <mdui-icon name="code"></mdui-icon>
                                </div>
                                <h4>100% открытый код</h4>
                                <p>
                                    Весь исходный код доступен на <GitHubLink>GitHub</GitHubLink>. Вы можете проверить безопасность, 
                                    внести изменения или развернуть свой сервер.
                                </p>
                            </div>
                            
                            <div className="feature-card">
                                <div className="feature-icon">
                                    <mdui-icon name="attach_file"></mdui-icon>
                                </div>
                                <h4>Обмен Файлами</h4>
                                <p>
                                    Отправляйте файлы до 4 ГБ. Файлы в личных сообщениях шифруются.
                                    В общем чате шифрования нет, так как ваши сообщения могут читать все пользователи FromChat.
                                </p>
                            </div>
                            
                            <div className="feature-card">
                                <div className="feature-icon">
                                    <mdui-icon name="notifications"></mdui-icon>
                                </div>
                                <h4>Уведомления</h4>
                                <p>
                                    Получайте push-уведомления в браузере и настольном приложении. 
                                    Никогда не пропустите важное сообщение.
                                </p>
                            </div>
                            
                            <div className="feature-card">
                                <div className="feature-icon">
                                    <mdui-icon name="edit"></mdui-icon>
                                </div>
                                <h4>Редактирование</h4>
                                <p>
                                    Редактируйте и удаляйте свои сообщения. Отвечайте на сообщения 
                                    для лучшего контекста общения.
                                </p>
                            </div>
                            
                            <div className="feature-card">
                                <div className="feature-icon">
                                    <mdui-icon name="computer"></mdui-icon>
                                </div>
                                <h4>Кроссплатформенность</h4>
                                <p>
                                    Работает в браузере и как настольное приложение для Windows, 
                                    macOS и Linux. Единый интерфейс везде.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="download">
                    <div className="container">
                        <div className="download-content">
                            <h3>Скачайте приложение</h3>
                            <p>
                                Для лучшего опыта используйте настольное приложение с поддержкой 
                                уведомлений и автономной работы.
                            </p>
                            <div className="download-buttons">
                                <a 
                                    href="https://github.com/Toolbox-io/FromChat/actions/workflows/build.yml" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                >
                                    <mdui-button variant="filled">
                                        <mdui-icon name="download" slot="icon"></mdui-icon>
                                        Скачать для ПК
                                    </mdui-button>
                                </a>
                                <mdui-button variant="outlined" onClick={() => navigate("/login")}>
                                    <mdui-icon name="language" slot="icon"></mdui-icon>
                                    Веб-версия
                                </mdui-button>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="cta">
                    <div className="container">
                        <div className="cta-content">
                            <h3>Готовы начать общение?</h3>
                            <p>
                                Присоединяйтесь к FromChat и общайтесь безопасно с друзьями и коллегами.
                            </p>
                            <div className="cta-actions">
                                <mdui-button 
                                    variant="filled" 
                                    onClick={() => navigate("/register")}
                                >
                                    Создать аккаунт
                                </mdui-button>
                                <mdui-button 
                                    variant="outlined" 
                                    onClick={() => navigate("/login")}
                                >
                                    Войти
                                </mdui-button>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="homepage-footer">
                <div className="container">
                    <div className="footer-content">
                        <div className="footer-section">
                            <h4>Ссылки</h4>
                            <GitHubLink>GitHub</GitHubLink>
                            <SupportLink>Поддержка</SupportLink>
                        </div>
                        <div className="footer-section">
                            <h4>Лицензия</h4>
                            <p>GPL-3.0</p>
                        </div>
                    </div>
                    <div className="footer-bottom">
                        <p>&copy; 2025 FromChat. Сделано программистом denis0001-dev с ❤️ для свободы общения.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
