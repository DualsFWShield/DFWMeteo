package com.dfwmeteo.app;

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
    }
}
