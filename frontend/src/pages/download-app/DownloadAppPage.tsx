import { MaterialButton } from "@/utils/material";
import styles from "./download-app.module.scss";

export default function DownloadAppPage() {
    return (
        <div className={styles.downloadAppScreen}>
            <div>
                <h1>Чтобы пользоваться мессенджером, скачайте приложение</h1>
                <p>
                    Этот сайт <b>не предназначен</b> для работы на маленьких экранах, поэтому
                    вам нужно скачать приложение мессенджера.
                </p>

                <a href="https://github.com/denis0001-dev/FromChat-android/releases/latest">
                    <MaterialButton>Скачать на GitHub</MaterialButton>
                </a>

                <p>
                    Если возникнут сложности или есть вопросы, нажмите кнопку!
                </p>

                <a href="https://t.me/denis0001-dev">
                    <MaterialButton>Написать в поддержку</MaterialButton>
                </a>
            </div>
        </div>
    )
}
