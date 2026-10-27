package com.dfwmeteo.app;

import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.webkit.WebView;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(DFWMeteoWidgetPlugin.class);
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);

        WindowInsetsControllerCompat insetsController =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (insetsController != null) {
            insetsController.setAppearanceLightStatusBars(false);
            insetsController.setAppearanceLightNavigationBars(false);
        }

        ViewCompat.setOnApplyWindowInsetsListener(getWindow().getDecorView(), (v, insets) -> {
            androidx.core.graphics.Insets statusBars = insets.getInsets(WindowInsetsCompat.Type.statusBars());
            androidx.core.graphics.Insets navBars = insets.getInsets(WindowInsetsCompat.Type.navigationBars());
            androidx.core.graphics.Insets cutouts = insets.getInsets(WindowInsetsCompat.Type.displayCutout());

            int top = Math.max(statusBars.top, cutouts.top);
            int bottom = Math.max(navBars.bottom, cutouts.bottom);
            int left = Math.max(navBars.left, cutouts.left);
            int right = Math.max(navBars.right, cutouts.right);

            float density = getResources().getDisplayMetrics().density;
            int topDp = Math.round(top / density);
            int bottomDp = Math.round(bottom / density);
            int leftDp = Math.round(left / density);
            int rightDp = Math.round(right / density);

            String js = String.format(
                java.util.Locale.US,
                "document.documentElement.style.setProperty('--safe-top', '%dpx');" +
                "document.documentElement.style.setProperty('--safe-bottom', '%dpx');" +
                "document.documentElement.style.setProperty('--safe-left', '%dpx');" +
                "document.documentElement.style.setProperty('--safe-right', '%dpx');",
                topDp, bottomDp, leftDp, rightDp
            );

            if (getBridge() != null && getBridge().getWebView() != null) {
                WebView webView = getBridge().getWebView();
                webView.post(() -> webView.evaluateJavascript(js, null));
            }

            return insets;
        });

        handleWidgetIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleWidgetIntent(intent);
    }

    private void handleWidgetIntent(Intent intent) {
        if (intent != null && intent.getBooleanExtra("from_widget", false)) {
            String lat = intent.getStringExtra("lat");
            String lon = intent.getStringExtra("lon");
            String city = intent.getStringExtra("city");
            if (lat != null && lon != null) {
                String js = String.format(
                    java.util.Locale.US,
                    "window.__dfwmeteo_pending_place = { latitude: %s, longitude: %s, name: '%s' };" +
                    "if (typeof window.__dfwmeteo_change_place === 'function') { window.__dfwmeteo_change_place(window.__dfwmeteo_pending_place); }",
                    lat, lon, (city != null ? city.replace("'", "\\'") : "Selected location")
                );
                if (getBridge() != null && getBridge().getWebView() != null) {
                    WebView webView = getBridge().getWebView();
                    webView.postDelayed(() -> webView.evaluateJavascript(js, null), 300);
                }
            }
        }
    }
}
