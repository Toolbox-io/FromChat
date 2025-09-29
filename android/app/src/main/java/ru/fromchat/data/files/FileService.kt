package ru.fromchat.data.files

import android.content.Context
import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream

class FileService(private val context: Context) {
    
    suspend fun saveFileFromUri(uri: Uri, fileName: String): Result<File> = withContext(Dispatchers.IO) {
        try {
            val inputStream = context.contentResolver.openInputStream(uri)
            if (inputStream == null) {
                return@withContext Result.failure(Exception("Could not open input stream"))
            }
            
            val file = File(context.cacheDir, fileName)
            val outputStream = FileOutputStream(file)
            
            inputStream.copyTo(outputStream)
            inputStream.close()
            outputStream.close()
            
            Result.success(file)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun readFileAsByteArray(file: File): Result<ByteArray> = withContext(Dispatchers.IO) {
        try {
            Result.success(file.readBytes())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun deleteFile(file: File): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            if (file.exists()) {
                file.delete()
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    fun getFileExtension(fileName: String): String {
        return fileName.substringAfterLast('.', "")
    }
    
    fun isImageFile(fileName: String): Boolean {
        val imageExtensions = listOf("jpg", "jpeg", "png", "gif", "bmp", "webp")
        return getFileExtension(fileName).lowercase() in imageExtensions
    }
    
    fun isVideoFile(fileName: String): Boolean {
        val videoExtensions = listOf("mp4", "avi", "mov", "wmv", "flv", "webm")
        return getFileExtension(fileName).lowercase() in videoExtensions
    }
    
    fun isAudioFile(fileName: String): Boolean {
        val audioExtensions = listOf("mp3", "wav", "flac", "aac", "ogg", "m4a")
        return getFileExtension(fileName).lowercase() in audioExtensions
    }
    
    fun getFileSizeFormatted(bytes: Long): String {
        val kb = bytes / 1024.0
        val mb = kb / 1024.0
        val gb = mb / 1024.0
        
        return when {
            gb >= 1 -> String.format("%.1f GB", gb)
            mb >= 1 -> String.format("%.1f MB", mb)
            kb >= 1 -> String.format("%.1f KB", kb)
            else -> "$bytes bytes"
        }
    }
}
