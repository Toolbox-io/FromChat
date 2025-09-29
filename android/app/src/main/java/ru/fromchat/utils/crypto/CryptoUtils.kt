@file:Suppress("ArrayInDataClass")

package ru.fromchat.utils.crypto

import android.util.Base64
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

object CryptoUtils {
    
    fun generateRandomBytes(length: Int): ByteArray {
        val bytes = ByteArray(length)
        SecureRandom().nextBytes(bytes)
        return bytes
    }
    
    fun base64Encode(data: ByteArray): String {
        return Base64.encodeToString(data, Base64.NO_WRAP)
    }
    
    fun base64Decode(data: String): ByteArray {
        return Base64.decode(data, Base64.NO_WRAP)
    }
    
    fun generateX25519KeyPair(): KeyPair {
        // Simplified X25519 key generation
        // In a real implementation, you'd use a proper X25519 library
        val privateKey = generateRandomBytes(32)
        val publicKey = generateRandomBytes(32)
        return KeyPair(publicKey, privateKey)
    }
    
    fun ecdhSharedSecret(privateKey: ByteArray, publicKey: ByteArray): ByteArray {
        // Simplified ECDH implementation
        // In a real implementation, you'd use a proper ECDH library
        val combined = privateKey + publicKey
        return MessageDigest.getInstance("SHA-256").digest(combined)
    }
    
    fun deriveWrappingKey(sharedSecret: ByteArray, salt: ByteArray, info: ByteArray): ByteArray {
        // Simplified key derivation
        val input = sharedSecret + salt + info
        return MessageDigest.getInstance("SHA-256").digest(input)
    }
    
    fun aesGcmEncrypt(key: ByteArray, data: ByteArray): EncryptedData {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        val secretKey = SecretKeySpec(key, "AES")
        val iv = generateRandomBytes(12)
        val parameterSpec = GCMParameterSpec(128, iv)
        
        cipher.init(Cipher.ENCRYPT_MODE, secretKey, parameterSpec)
        val ciphertext = cipher.doFinal(data)
        
        return EncryptedData(iv, ciphertext)
    }
    
    fun aesGcmDecrypt(key: ByteArray, iv: ByteArray, ciphertext: ByteArray): ByteArray {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        val secretKey = SecretKeySpec(key, "AES")
        val parameterSpec = GCMParameterSpec(128, iv)
        
        cipher.init(Cipher.DECRYPT_MODE, secretKey, parameterSpec)
        return cipher.doFinal(ciphertext)
    }
    
    fun encryptBackupWithPassword(password: String, data: BackupData): ByteArray {
        // Simplified backup encryption
        val key = MessageDigest.getInstance("SHA-256").digest(password.toByteArray())
        return aesGcmEncrypt(key, Json.encodeToString(BackupData.serializer(), data).toByteArray()).let { encrypted ->
            encrypted.iv + encrypted.ciphertext
        }
    }
    
    fun decryptBackupWithPassword(password: String, encryptedData: ByteArray): BackupData {
        val key = MessageDigest.getInstance("SHA-256").digest(password.toByteArray())
        val iv = encryptedData.sliceArray(0..11)
        val ciphertext = encryptedData.sliceArray(12 until encryptedData.size)
        val decrypted = aesGcmDecrypt(key, iv, ciphertext)
        return Json.decodeFromString(BackupData.serializer(), String(decrypted))
    }
    
    data class KeyPair(
        val publicKey: ByteArray,
        val privateKey: ByteArray
    )
    
    data class EncryptedData(
        val iv: ByteArray,
        val ciphertext: ByteArray
    )
    
    @Serializable
    data class BackupData(
        val version: Int,
        val privateKey: ByteArray
    )
}
