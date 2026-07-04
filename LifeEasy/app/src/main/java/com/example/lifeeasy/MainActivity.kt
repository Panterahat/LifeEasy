package com.example.lifeeasy   // change to match your actual package name

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.Uri
import android.net.http.SslError
import android.os.Bundle
import android.webkit.*
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var connectivityManager: ConnectivityManager
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null

    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            runOnUiThread {
                webView.evaluateJavascript(
                    "typeof processSyncQueue === 'function' && processSyncQueue()", null
                )
            }
        }
    }

    // Handles the file picker triggered by <input type="file"> (used by the Vault screen)
    private val filePickerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val data = result.data
        val results: Array<Uri>? = when {
            result.resultCode != RESULT_OK -> null
            data?.clipData != null -> {
                val count = data.clipData!!.itemCount
                Array(count) { i -> data.clipData!!.getItemAt(i).uri }
            }
            data?.data != null -> arrayOf(data.data!!)
            else -> null
        }
        fileChooserCallback?.onReceiveValue(results)
        fileChooserCallback = null
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)

        // ── Settings your offline-first architecture depends on ──
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true          // CRITICAL: without this, localStorage/STATE persistence silently does nothing
            cacheMode = WebSettings.LOAD_DEFAULT
            allowFileAccess = true
            mediaPlaybackRequiresUserGesture = false
        }

        // Uncomment this line while developing so you can inspect the WebView
        // from Chrome DevTools at chrome://inspect on your PC (device must be
        // connected via USB with debugging enabled). Remove/comment out for release.
        WebView.setWebContentsDebuggingEnabled(true)

        webView.webViewClient = object : WebViewClient() {
            override fun onReceivedSslError(view: WebView?, handler: SslErrorHandler?, error: SslError?) {
                // Do NOT blanket-accept SSL errors in a shipped app — this is only
                // a safe default because we're not overriding anything here;
                // Supabase's cert will validate normally. Left explicit as a reminder
                // not to add handler?.proceed() here.
                super.onReceivedSslError(view, handler, error)
            }
        }

        // Needed so <input type="file"> (Vault upload / drag-drop) actually opens a picker
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                fileChooserCallback = filePathCallback
                val intent = fileChooserParams?.createIntent()
                    ?: Intent(Intent.ACTION_GET_CONTENT).apply { type = "*/*" }
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                return try {
                    filePickerLauncher.launch(intent)
                    true
                } catch (_: Exception) {
                    fileChooserCallback = null
                    false
                }
            }
        }

        // Load your app from the bundled assets — file:///android_asset/ maps to app/src/main/assets/
        webView.loadUrl("file:///android_asset/www/index.html")

        // ── Back button: navigate in-app screens instead of closing the app ──
        // Replaces the deprecated onBackPressed() override with the AndroidX dispatcher,
        // which is what actually receives predictive back gestures on modern Android.
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                webView.evaluateJavascript(
                    "typeof handleAndroidBack === 'function' ? handleAndroidBack() : 'exit'"
                ) { result ->
                    if (result == "\"exit\"") {
                        // Disable this callback and re-trigger back press so the system
                        // (or the activity below us / app exit) handles it normally.
                        isEnabled = false
                        onBackPressedDispatcher.onBackPressed()
                        isEnabled = true
                    }
                    // otherwise: JS already navigated the screen back, do nothing further
                }
            }
        })

        // ── Instant sync on reconnect ──
        // WebView's own navigator.onLine / 'online' event can be slow or unreliable,
        // especially while backgrounded. This uses Android's real connectivity state
        // instead, so processSyncQueue() fires the moment the network is actually back.
        connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        connectivityManager.registerNetworkCallback(request, networkCallback)
    }

    override fun onDestroy() {
        super.onDestroy()
        connectivityManager.unregisterNetworkCallback(networkCallback)
    }
}