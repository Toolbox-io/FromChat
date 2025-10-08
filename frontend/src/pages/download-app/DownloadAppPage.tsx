import "./download-app.scss";

export default function DownloadAppPage() {
    return (
        <div className="download-app-screen">
            <div className="inner">
                <h1>Чтобы пользоваться мессенджером, скачайте приложение</h1>
                <p>
                    Этот сайт <b>не предназначен</b> для работы на маленьких экранах, поэтому
                    вам нужно скачать приложение мессенджера.
                </p>

                <a href="https://github.com/denis0001-dev/FromChat-android/releases/latest">
                    <mdui-button>Скачать на GitHub</mdui-button>
                </a>
                
                <p>
                    Если возникнут сложности или есть вопросы, нажмите кнопку!
                </p>

                <a href="https://t.me/denis0001-dev">
                    <mdui-button>Написать в поддержку</mdui-button>
                </a>
            </div>
        </div>
    )
}
