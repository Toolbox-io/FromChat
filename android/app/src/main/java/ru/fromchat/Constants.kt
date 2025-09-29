package ru.fromchat

import kotlinx.datetime.LocalDateTime
import kotlinx.datetime.format.char

const val API_HOST = "fromchat.ru"

val DATETIME_FORMAT = LocalDateTime.Format {
    day()
    char('.')
    monthNumber()
    char('.')
    year()

    char(' ')

    hour()
    char(':')
    minute()
}