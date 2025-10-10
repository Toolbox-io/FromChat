import { useNavigate } from "react-router-dom";
import "./not-found.scss";

export default function NotFoundPage() {
    const navigate = useNavigate();

    return (
        <div className="not-found-page">
            <div className="not-found-container">
                <div className="not-found-content">
                    <div className="error-code">404</div>
                    <h1>Страница не найдена</h1>
                    <p>
                        К сожалению, запрашиваемая страница не существует или была перемещена.
                    </p>
                    <div className="not-found-actions">
                        <mdui-button 
                            variant="filled" 
                            onClick={() => navigate("/")}
                        >
                            На главную
                        </mdui-button>
                    </div>
                </div>
                <div className="not-found-illustration">
                    <mdui-icon name="search_off" />
                </div>
            </div>
        </div>
    );
}
