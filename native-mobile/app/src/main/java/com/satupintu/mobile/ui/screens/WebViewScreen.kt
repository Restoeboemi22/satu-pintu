package com.satupintu.mobile.ui.screens

import android.graphics.Bitmap
import android.view.ViewGroup
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WebViewScreen(
    url: String,
    title: String,
    onBack: () -> Unit
) {
    var isLoading by remember { mutableStateOf(true) }
    var webView: WebView? by remember { mutableStateOf(null) }

    // Handle Back Press to navigate back in WebView history if possible
    BackHandler {
        if (webView?.canGoBack() == true) {
            webView?.goBack()
        } else {
            onBack()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(title, style = MaterialTheme.typography.titleMedium) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { webView?.reload() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                }
            )
        }
    ) { paddingValues ->
        Box(modifier = Modifier.padding(paddingValues).fillMaxSize()) {
            AndroidView(
                factory = { context ->
                    WebView(context).apply {
                        layoutParams = ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                        )
                        settings.javaScriptEnabled = true
                        settings.domStorageEnabled = true
                        
                        webViewClient = object : WebViewClient() {
                            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                                isLoading = true
                            }
                            override fun onPageFinished(view: WebView?, url: String?) {
                                isLoading = false
                                // Inject CSS/JS aggressively to hide the "Pop-out" button
                                view?.evaluateJavascript(
                                    """
                                    (function() {
                                        function hideElements() {
                                            // Define selectors for the Pop-out button and other unwanted elements
                                            // 'ndfHFb-c4YZDc-Wrql6b' is a common class for the button container
                                            // aria-label checks cover both English and Indonesian interfaces
                                            var css = 'div[role="button"][aria-label="Pop-out"], div[role="button"][aria-label="Buka di jendela baru"], .ndfHFb-c4YZDc-Wrql6b { display: none !important; }';
                                            
                                            // Method 1: Inject Style Tag
                                            if (!document.getElementById('custom-hide-style')) {
                                                var style = document.createElement('style');
                                                style.id = 'custom-hide-style';
                                                style.innerHTML = css;
                                                document.head.appendChild(style);
                                            }

                                            // Method 2: Direct DOM manipulation (fallback)
                                            var buttons = document.querySelectorAll('div[aria-label="Pop-out"], div[aria-label="Buka di jendela baru"]');
                                            buttons.forEach(function(btn) { 
                                                btn.style.setProperty('display', 'none', 'important'); 
                                            });
                                        }

                                        // Run immediately
                                        hideElements();

                                        // Run repeatedly to catch dynamic rendering (every 500ms)
                                        setInterval(hideElements, 500);
                                    })();
                                    """.trimIndent(), null
                                )
                            }
                        }
                        
                        loadUrl(url)
                        webView = this
                    }
                },
                update = {
                    webView = it
                },
                modifier = Modifier.fillMaxSize()
            )

            if (isLoading) {
                LinearProgressIndicator(modifier = Modifier.align(Alignment.TopCenter).fillMaxSize())
            }
        }
    }
}

