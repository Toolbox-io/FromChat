package ru.fromchat.data.auth

import android.content.Context
import android.content.SharedPreferences
import androidx.core.content.edit
import kotlinx.serialization.json.Json
import ru.fromchat.data.api.ApiService
import ru.fromchat.data.models.LoginRequest
import ru.fromchat.data.models.LoginResponse
import ru.fromchat.data.models.RegisterRequest
import ru.fromchat.data.models.User
import ru.fromchat.utils.crypto.CryptoUtils

class AuthService(private val context: Context) {
    private val apiService = ApiService()
    private val prefs: SharedPreferences = context.getSharedPreferences("auth", Context.MODE_PRIVATE)
    
    private var currentUser: User? = null
    private var authToken: String? = null
    private var currentKeys: CryptoUtils.KeyPair? = null
    
    fun getCurrentUser(): User? = currentUser
    fun getAuthToken(): String? = authToken
    fun getCurrentKeys(): CryptoUtils.KeyPair? = currentKeys
    
    suspend fun login(username: String, password: String): Result<LoginResponse> {
        return try {
            val result = apiService.login(LoginRequest(username, password))
            if (result.isSuccess) {
                val response = result.getOrThrow()
                setUser(response.token, response.user)
                
                // Setup encryption keys
                ensureKeysOnLogin(password, response.token)
            }
            result
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun register(username: String, password: String, confirmPassword: String): Result<LoginResponse> {
        return try {
            val result = apiService.register(RegisterRequest(username, password, confirmPassword))
            if (result.isSuccess) {
                val response = result.getOrThrow()
                setUser(response.token, response.user)
                
                // Setup encryption keys
                ensureKeysOnLogin(password, response.token)
            }
            result
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    private fun setUser(token: String, user: User) {
        currentUser = user
        authToken = token
        
        // Store in SharedPreferences
        prefs.edit {
            putString("authToken", token)
            putString("currentUser", Json.encodeToString(User.serializer(), user))
        }
    }
    
    suspend fun restoreUserFromStorage(): Result<Unit> {
        return try {
            val token = prefs.getString("authToken", null)
            if (token != null) {
                val result = apiService.getUserProfile(token)
                if (result.isSuccess) {
                    val user = result.getOrThrow()
                    currentUser = user
                    authToken = token
                    restoreKeys()
                    return Result.success(Unit)
                }
            }
            Result.failure(Exception("No valid session found"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    fun logout() {
        currentUser = null
        authToken = null
        currentKeys = null
        
        prefs.edit {
            remove("authToken")
            remove("currentUser")
            remove("publicKey")
            remove("privateKey")
        }
    }
    
    private suspend fun ensureKeysOnLogin(password: String, token: String): CryptoUtils.KeyPair {
        // Try to restore from backup
        val backupResult = apiService.getBackupBlob(token)
        if (backupResult.isSuccess) {
            val backupData = CryptoUtils.decryptBackupWithPassword(password, CryptoUtils.base64Decode(backupResult.getOrThrow()))
            currentKeys = CryptoUtils.KeyPair(byteArrayOf(), backupData.privateKey)
            
            // Get public key from server
            val publicKeyResult = apiService.getPublicKey(token)
            if (publicKeyResult.isSuccess) {
                val publicKey = CryptoUtils.base64Decode(publicKeyResult.getOrThrow())
                currentKeys = CryptoUtils.KeyPair(publicKey, backupData.privateKey)
            } else {
                // Generate new key pair
                val newKeys = CryptoUtils.generateX25519KeyPair()
                currentKeys = newKeys
                apiService.uploadPublicKey(token, CryptoUtils.base64Encode(newKeys.publicKey))
                
                // Upload new backup
                val newBackup = CryptoUtils.BackupData(1, newKeys.privateKey)
                val encryptedBackup = CryptoUtils.encryptBackupWithPassword(password, newBackup)
                apiService.uploadBackupBlob(token, CryptoUtils.base64Encode(encryptedBackup))
            }
            
            saveKeys(currentKeys!!.publicKey, currentKeys!!.privateKey)
            return currentKeys!!
        }
        
        // First-time setup: generate keys and upload
        val keys = CryptoUtils.generateX25519KeyPair()
        currentKeys = keys
        apiService.uploadPublicKey(token, CryptoUtils.base64Encode(keys.publicKey))
        
        val backup = CryptoUtils.BackupData(1, keys.privateKey)
        val encryptedBackup = CryptoUtils.encryptBackupWithPassword(password, backup)
        apiService.uploadBackupBlob(token, CryptoUtils.base64Encode(encryptedBackup))
        
        saveKeys(keys.publicKey, keys.privateKey)
        return keys
    }
    
    private fun restoreKeys() {
        val publicKeyStr = prefs.getString("publicKey", null)
        val privateKeyStr = prefs.getString("privateKey", null)
        
        if (publicKeyStr != null && privateKeyStr != null) {
            currentKeys = CryptoUtils.KeyPair(
                CryptoUtils.base64Decode(publicKeyStr),
                CryptoUtils.base64Decode(privateKeyStr)
            )
        }
    }
    
    private fun saveKeys(publicKey: ByteArray, privateKey: ByteArray) {
        prefs.edit {
            putString("publicKey", CryptoUtils.base64Encode(publicKey))
            putString("privateKey", CryptoUtils.base64Encode(privateKey))
        }
    }
}
