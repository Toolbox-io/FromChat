package ru.fromchat.ui

import androidx.compose.animation.AnimatedContentTransitionScope.SlideDirection.Companion.End
import androidx.compose.animation.AnimatedContentTransitionScope.SlideDirection.Companion.Start
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.ui.unit.IntOffset
import androidx.navigation.NavController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import ru.fromchat.data.state.AppState
import ru.fromchat.data.state.Page
import ru.fromchat.ui.screens.ChatScreen
import ru.fromchat.ui.screens.LoginScreen
import ru.fromchat.ui.screens.RegisterScreen

val LocalNavController = compositionLocalOf<NavController> { error("") }

@Composable
fun App() {
    FromChatTheme(dynamicColor = false) {
        val navController = rememberNavController()
        val animationSpec = tween<IntOffset>(400)

        CompositionLocalProvider(
            LocalNavController provides navController
        ) {
            NavHost(
                navController = navController,
                startDestination = when (AppState.currentPage) {
                    Page.LOGIN -> "login"
                    Page.REGISTER -> "register"
                    Page.CHAT -> "chat"
                },
                enterTransition = {
                    slideIntoContainer(
                        Start,
                        animationSpec = animationSpec
                    )
                },
                exitTransition = {
                    slideOutOfContainer(
                        Start,
                        animationSpec = animationSpec
                    )
                },
                popEnterTransition = {
                    slideIntoContainer(
                        End,
                        animationSpec = animationSpec
                    )
                },
                popExitTransition = {
                    slideOutOfContainer(
                        End,
                        animationSpec = animationSpec
                    )
                }
            ) {
                composable("login") {
                    LoginScreen()
                }
                composable("register") {
                    RegisterScreen()
                }
                composable("chat") {
                    ChatScreen()
                }
            }
        }
    }
}