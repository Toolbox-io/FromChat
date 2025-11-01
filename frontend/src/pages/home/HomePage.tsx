import { useNavigate } from "react-router-dom";
import { useAppState } from "@/pages/chat/state";
import "./home.scss";
import useDownloadAppScreen from "@/core/hooks/useDownloadAppScreen";
import { MaterialButton, MaterialIcon } from "@/utils/material";

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
    const { isMobile } = useDownloadAppScreen();
    const isLoggedIn = user.authToken && user.currentUser;

    function handleGetStarted() {
        if (isMobile) {
            navigate("/download-app");
        } else if (isLoggedIn) {
            navigate("/chat");
        } else {
            navigate("/login");
        }
    }

    const openBtn = (
        <MaterialButton variant="filled" onClick={handleGetStarted}>
            {isMobile ? "Скачать приложение" : isLoggedIn ? "Перейти в чат" : "Войти"}
        </MaterialButton>
    );

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
                                <MaterialButton variant="text">GitHub</MaterialButton>
                            </GitHubLink>
                            <SupportLink>
                                <MaterialButton variant="text">Поддержка</MaterialButton>
                            </SupportLink>

                            {openBtn}
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
                                {openBtn}
                                {!isMobile && (
                                    <MaterialButton
                                        variant="outlined"
                                        onClick={() => navigate("/register")}>
                                        Зарегистрироваться
                                    </MaterialButton>
                                )}
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
                                    <MaterialIcon name="security" />
                                </div>
                                <h4>End-to-End Шифрование</h4>
                                <p>
                                    Ваши личные сообщения защищены современным шифрованием X25519 + AES-GCM.
                                    Только вы и получатель можете прочитать сообщения.
                                </p>
                            </div>

                            <div className="feature-card">
                                <div className="feature-icon">
                                    <MaterialIcon name="code" />
                                </div>
                                <h4>100% открытый код</h4>
                                <p>
                                    Весь исходный код доступен на <GitHubLink>GitHub</GitHubLink>. Вы можете проверить безопасность,
                                    внести изменения или развернуть свой сервер.
                                </p>
                            </div>

                            <div className="feature-card">
                                <div className="feature-icon">
                                    <MaterialIcon name="attach_file" />
                                </div>
                                <h4>Обмен Файлами</h4>
                                <p>
                                    Отправляйте файлы до 4 ГБ. Файлы в личных сообщениях шифруются.
                                    В общем чате шифрования нет, так как ваши сообщения могут читать все пользователи FromChat.
                                </p>
                            </div>

                            <div className="feature-card">
                                <div className="feature-icon">
                                    <MaterialIcon name="notifications" />
                                </div>
                                <h4>Уведомления</h4>
                                <p>
                                    Получайте push-уведомления в браузере и настольном приложении.
                                    Никогда не пропустите важное сообщение.
                                </p>
                            </div>

                            <div className="feature-card">
                                <div className="feature-icon">
                                    <MaterialIcon name="edit" />
                                </div>
                                <h4>Редактирование</h4>
                                <p>
                                    Редактируйте и удаляйте свои сообщения. Отвечайте на сообщения
                                    для лучшего контекста общения.
                                </p>
                            </div>

                            <div className="feature-card">
                                <div className="feature-icon">
                                    <MaterialIcon name="computer" />
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
                                {!isMobile ? (
                                    <>
                                        <a
                                            href="https://github.com/Toolbox-io/FromChat/actions/workflows/build.yml"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <MaterialButton variant="filled">
                                                <MaterialIcon name="download" slot="icon" />
                                                Скачать для ПК
                                            </MaterialButton>
                                        </a>
                                        <MaterialButton variant="outlined" onClick={() => navigate("/login")}>
                                            <MaterialIcon name="language" slot="icon" />
                                            Веб-версия
                                        </MaterialButton>
                                    </>
                                ) : (
                                    <MaterialButton variant="filled" onClick={() => navigate("/download-app")}>
                                        Скачать приложение
                                    </MaterialButton>
                                )}
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
                                {isMobile ? (
                                    <MaterialButton variant="filled" onClick={() => navigate("/download-app")}>
                                        Скачать приложение
                                    </MaterialButton>
                                ) : (
                                    <>
                                        <MaterialButton
                                            variant="filled"
                                            onClick={() => navigate("/register")}>
                                            Создать аккаунт
                                        </MaterialButton>
                                        <MaterialButton
                                            variant="outlined"
                                            onClick={() => navigate("/login")}>
                                            Войти
                                        </MaterialButton>
                                    </>
                                )}
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
