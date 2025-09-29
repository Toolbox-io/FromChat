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
import androidx.navigation.compose.rememberNavController

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
                startDestination = "login",
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

            }
        }
    }
}