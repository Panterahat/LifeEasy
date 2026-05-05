package com.example.lifeeasy;

import android.annotation.SuppressLint;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    private WebView myWebView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        myWebView = findViewById(R.id.webView);
        WebSettings webSettings = myWebView.getSettings();

        // 1. Enable JavaScript (Crucial for your app's logic to work)
        webSettings.setJavaScriptEnabled(true);

        // 2. Enable Local Storage (Crucial so tasks and money don't disappear when the app closes)
        webSettings.setDomStorageEnabled(true);

        // 3. Enable file access (Needed for assets and local files)
        webSettings.setAllowFileAccess(true);

        // 4. Force links and redirects to open inside the app
        myWebView.setWebViewClient(new WebViewClient());

        // 5. Load your HTML file from the assets folder
        myWebView.loadUrl("file:///android_asset/index.html");

        // Handle the physical Android back button using OnBackPressedDispatcher
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (myWebView.canGoBack()) {
                    myWebView.goBack();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                }
            }
        });
    }
}