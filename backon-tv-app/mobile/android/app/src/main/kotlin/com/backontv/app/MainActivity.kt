package com.backontv.app

import android.net.Uri
import androidx.core.content.FileProvider
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File

class MainActivity: FlutterActivity() {
    private val CHANNEL = "backon.tv/file_provider"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            if (call.method == "getFileProviderUri") {
                val filePath = call.arguments as? String
                if (filePath != null) {
                    try {
                        val file = File(filePath)
                        if (file.exists()) {
                            val uri = FileProvider.getUriForFile(
                                this,
                                "${applicationContext.packageName}.fileprovider",
                                file
                            )
                            result.success(uri.toString())
                        } else {
                            result.error("FILE_NOT_FOUND", "Plik nie istnieje: $filePath", null)
                        }
                    } catch (e: Exception) {
                        result.error("ERROR", "Błąd generowania FileProvider URI: ${e.message}", null)
                    }
                } else {
                    result.error("INVALID_ARGUMENT", "Ścieżka pliku jest null", null)
                }
            } else {
                result.notImplemented()
            }
        }
    }
}

