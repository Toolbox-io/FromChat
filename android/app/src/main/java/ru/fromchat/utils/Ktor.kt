@file:Suppress("NOTHING_TO_INLINE")
package ru.fromchat.utils

import io.ktor.client.HttpClientConfig
import io.ktor.client.plugins.ClientRequestException
import io.ktor.client.plugins.DefaultRequest
import io.ktor.client.plugins.ResponseException
import io.ktor.client.plugins.ServerResponseException
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.logging.DEFAULT
import io.ktor.client.plugins.logging.LogLevel
import io.ktor.client.plugins.logging.Logger
import io.ktor.client.plugins.logging.Logging
import io.ktor.client.plugins.logging.LoggingConfig
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.serialization.Configuration
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonBuilder

/**
 * Configures the Ktor client for kotlinx.serialization JSON with custom settings.
 * @param settings Lambda to configure the [JsonBuilder].
 */
@PublishedApi
internal inline fun Configuration.json(crossinline settings: JsonBuilder.() -> Unit) {
    json(
        Json {
            settings()
        }
    )
}

/**
 * Installs [ContentNegotiation] with JSON support and custom settings in a Ktor client config.
 * @param settings Lambda to configure the [JsonBuilder].
 */
inline fun HttpClientConfig<*>.jsonConfig(
    crossinline settings: JsonBuilder.() -> Unit
) = install(ContentNegotiation) {
    json {
        settings()
    }
}

/**
 * Installs [DefaultRequest] in a Ktor client config.
 * @param settings Lambda to configure the [DefaultRequest.DefaultRequestBuilder].
 */
inline fun HttpClientConfig<*>.defaultRequest(
    crossinline settings: DefaultRequest.DefaultRequestBuilder.() -> Unit
) = install(DefaultRequest) {
    settings()
}

/**
 * Installs [Logging] in a Ktor client config.
 * @param settings Lambda to configure the [LoggingConfig].
 */
inline fun HttpClientConfig<*>.logging(
    crossinline settings: LoggingConfig.() -> Unit
) = install(Logging) {
    settings()
}

/**
 * Installs [Logging] in a Ktor client config with default settings (all logs).
 */
inline fun HttpClientConfig<*>.logging() = logging {
    logger = Logger.DEFAULT
    level = LogLevel.ALL
}

/**
 * Throws if the HTTP response status code is an error (>=400).
 * @return The [HttpResponse] if successful.
 * @throws ClientRequestException on 4xx error code.
 * @throws ServerResponseException on 5xx error code.
 * @throws ResponseException on unknown error code.
 */
suspend fun HttpResponse.failOnError() =
    when (status.value) {
        in 100..399 -> this
        in 400..499 -> throw ClientRequestException(this, bodyAsText())
        in 500..599 -> throw ServerResponseException(this, bodyAsText())
        else -> throw ResponseException(this, bodyAsText())
    }