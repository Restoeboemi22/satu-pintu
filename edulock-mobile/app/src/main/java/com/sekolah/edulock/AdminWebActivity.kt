package com.sekolah.edulock

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class AdminWebActivity : AppCompatActivity() {
    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)
        setContentView(webView)

        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.databaseEnabled = true
        webView.settings.cacheMode = WebSettings.LOAD_DEFAULT
        webView.settings.useWideViewPort = true
        webView.settings.loadWithOverviewMode = true
        webView.settings.builtInZoomControls = true
        webView.settings.displayZoomControls = false

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url ?: return false
                return handleExternalNavigation(url)
            }

            override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
                return handleExternalNavigation(Uri.parse(url))
            }
        }

        if (savedInstanceState == null) {
            webView.loadUrl(ADMIN_URL)
        } else {
            webView.restoreState(savedInstanceState)
        }
    }

    private fun handleExternalNavigation(uri: Uri): Boolean {
        val scheme = uri.scheme?.lowercase() ?: return false
        if (scheme != "http" && scheme != "https") {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
            return true
        }

        val host = uri.host?.lowercase() ?: return false
        val allowedHosts = setOf(Uri.parse(ADMIN_URL).host?.lowercase()).filterNotNull().toSet()

        if (host in allowedHosts) return false

        startActivity(Intent(Intent.ACTION_VIEW, uri))
        return true
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onBackPressed() {
        if (this::webView.isInitialized && webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    companion object {
        private const val ADMIN_URL = "https://satu-pintu-lake.vercel.app/edulock/admin"
    }
}
