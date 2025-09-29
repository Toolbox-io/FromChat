package ru.fromchat.utils

import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.exclude
import androidx.compose.foundation.layout.only
import androidx.compose.ui.Modifier

inline fun WindowInsets.exclude(sides: WindowInsetsSides) = exclude(this.only(sides))

inline operator fun Modifier.plus(other: Modifier) = then(other)