package ru.fromchat.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuAnchorType
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import ru.fromchat.data.settings.SettingsService

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onBackClick: () -> Unit
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val settingsService = remember { SettingsService(context) }
    
    var notificationsEnabled by remember { mutableStateOf(settingsService.notificationsEnabled) }
    var soundEnabled by remember { mutableStateOf(settingsService.soundEnabled) }
    var vibrationEnabled by remember { mutableStateOf(settingsService.vibrationEnabled) }
    var darkTheme by remember { mutableStateOf(settingsService.darkTheme) }
    var autoDownload by remember { mutableStateOf(settingsService.autoDownload) }
    var imageQuality by remember { mutableStateOf(settingsService.imageQuality) }
    var language by remember { mutableStateOf(settingsService.language) }
    
    Column(
        modifier = Modifier.fillMaxSize()
    ) {
        TopAppBar(
            title = { Text("Настройки") },
            navigationIcon = {
                IconButton(onClick = onBackClick) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Назад")
                }
            }
        )
        
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            item {
                Text(
                    text = "Уведомления",
                    style = MaterialTheme.typography.titleMedium
                )
            }
            
            item {
                SwitchSettingsItem(
                    title = "Включить уведомления",
                    subtitle = "Получать уведомления о новых сообщениях",
                    checked = notificationsEnabled,
                    onCheckedChange = { 
                        notificationsEnabled = it
                        settingsService.notificationsEnabled = it
                    }
                )
            }
            
            item {
                SwitchSettingsItem(
                    title = "Звук",
                    subtitle = "Звуковые уведомления",
                    checked = soundEnabled,
                    onCheckedChange = { 
                        soundEnabled = it
                        settingsService.soundEnabled = it
                    }
                )
            }
            
            item {
                SwitchSettingsItem(
                    title = "Вибрация",
                    subtitle = "Вибрация при уведомлениях",
                    checked = vibrationEnabled,
                    onCheckedChange = { 
                        vibrationEnabled = it
                        settingsService.vibrationEnabled = it
                    }
                )
            }
            
            item {
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "Внешний вид",
                    style = MaterialTheme.typography.titleMedium
                )
            }
            
            item {
                SwitchSettingsItem(
                    title = "Тёмная тема",
                    subtitle = "Использовать тёмную тему",
                    checked = darkTheme,
                    onCheckedChange = { 
                        darkTheme = it
                        settingsService.darkTheme = it
                    }
                )
            }
            
            item {
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "Медиа",
                    style = MaterialTheme.typography.titleMedium
                )
            }
            
            item {
                SwitchSettingsItem(
                    title = "Автоскачивание",
                    subtitle = "Автоматически скачивать медиафайлы",
                    checked = autoDownload,
                    onCheckedChange = { 
                        autoDownload = it
                        settingsService.autoDownload = it
                    }
                )
            }
            
            item {
                ListSettingsItem(
                    title = "Качество изображений",
                    subtitle = "Выберите качество для изображений",
                    currentValue = imageQuality,
                    options = listOf("low", "medium", "high"),
                    onValueChange = { 
                        imageQuality = it
                        settingsService.imageQuality = it
                    }
                )
            }
            
            item {
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "Язык",
                    style = MaterialTheme.typography.titleMedium
                )
            }
            
            item {
                ListSettingsItem(
                    title = "Язык приложения",
                    subtitle = "Выберите язык интерфейса",
                    currentValue = language,
                    options = listOf("ru", "en"),
                    onValueChange = { 
                        language = it
                        settingsService.language = it
                    }
                )
            }
            
            item {
                Spacer(modifier = Modifier.height(32.dp))
                
                Button(
                    onClick = {
                        settingsService.resetToDefaults()
                        // Reset all values to defaults
                        notificationsEnabled = true
                        soundEnabled = true
                        vibrationEnabled = true
                        darkTheme = false
                        autoDownload = true
                        imageQuality = "high"
                        language = "ru"
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error
                    )
                ) {
                    Text("Сбросить настройки")
                }
            }
        }
    }
}

@Composable
fun SwitchSettingsItem(
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleSmall
                )
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Switch(
                checked = checked,
                onCheckedChange = onCheckedChange
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ListSettingsItem(
    title: String,
    subtitle: String,
    currentValue: String,
    options: List<String>,
    onValueChange: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    
    Card(
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            
            Spacer(modifier = Modifier.height(8.dp))
            
            ExposedDropdownMenuBox(
                expanded = expanded,
                onExpandedChange = { expanded = !expanded }
            ) {
                OutlinedTextField(
                    value = currentValue,
                    onValueChange = {},
                    readOnly = true,
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor(ExposedDropdownMenuAnchorType.PrimaryEditable)
                )
                
                ExposedDropdownMenu(
                    expanded = expanded,
                    onDismissRequest = { expanded = false }
                ) {
                    options.forEach { option ->
                        DropdownMenuItem(
                            text = { Text(option) },
                            onClick = {
                                onValueChange(option)
                                expanded = false
                            }
                        )
                    }
                }
            }
        }
    }
}
