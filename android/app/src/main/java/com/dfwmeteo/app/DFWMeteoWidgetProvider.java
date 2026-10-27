package com.dfwmeteo.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

public class DFWMeteoWidgetProvider extends AppWidgetProvider {
    public static final String ACTION_REFRESH_WIDGET = "com.dfwmeteo.app.ACTION_REFRESH_WIDGET";
    public static final String PREFS_NAME = "DFWMeteoWidgetPrefs";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (ACTION_REFRESH_WIDGET.equals(intent.getAction())) {
            refreshWeatherInBackground(context);
        }
    }

    public static void updateAllWidgets(Context context) {
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        ComponentName thisWidget = new ComponentName(context, DFWMeteoWidgetProvider.class);
        int[] appWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget);
        if (appWidgetIds != null && appWidgetIds.length > 0) {
            for (int appWidgetId : appWidgetIds) {
                updateAppWidget(context, appWidgetManager, appWidgetId);
            }
        }
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String city = prefs.getString("city", "Bruxelles");
        String temp = prefs.getString("temp", "--°");
        String condition = prefs.getString("condition", "DFWMeteo");
        String highLow = prefs.getString("highLow", "Max --° · Min --°");
        String consensus = prefs.getString("consensus", "Consensus 12 modèles");
        String updated = prefs.getString("updated", "En direct");

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_dfwmeteo);
        views.setTextViewText(R.id.widget_city, city);
        views.setTextViewText(R.id.widget_temp, temp);
        views.setTextViewText(R.id.widget_condition, condition);
        views.setTextViewText(R.id.widget_high_low, highLow);
        views.setTextViewText(R.id.widget_consensus, consensus);
        views.setTextViewText(R.id.widget_updated, updated);

        // Click on widget -> Open MainActivity
        Intent launchIntent = new Intent(context, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        launchIntent.putExtra("from_widget", true);
        launchIntent.putExtra("lat", prefs.getString("lat", "50.8503"));
        launchIntent.putExtra("lon", prefs.getString("lon", "4.3517"));
        launchIntent.putExtra("city", city);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);

        // Click on refresh icon -> Trigger live weather refresh
        Intent refreshIntent = new Intent(context, DFWMeteoWidgetProvider.class);
        refreshIntent.setAction(ACTION_REFRESH_WIDGET);
        PendingIntent refreshPendingIntent = PendingIntent.getBroadcast(
            context,
            appWidgetId,
            refreshIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_refresh_button, refreshPendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private void refreshWeatherInBackground(Context context) {
        new Thread(() -> {
            try {
                SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                String latStr = prefs.getString("lat", "50.8503");
                String lonStr = prefs.getString("lon", "4.3517");
                String city = prefs.getString("city", "Bruxelles");

                String urlString = String.format(
                    Locale.US,
                    "https://api.open-meteo.com/v1/forecast?latitude=%s&longitude=%s&current=temperature_2m,apparent_temperature,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min&timezone=auto",
                    latStr,
                    lonStr
                );

                URL url = new URL(urlString);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setRequestProperty("User-Agent", "DFWMeteo/1.0");
                conn.setRequestProperty("Accept", "application/json");
                conn.setConnectTimeout(9000);
                conn.setReadTimeout(9000);

                if (conn.getResponseCode() == 200) {
                    BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        sb.append(line);
                    }
                    reader.close();

                    JSONObject json = new JSONObject(sb.toString());
                    JSONObject current = json.optJSONObject("current");
                    JSONObject daily = json.optJSONObject("daily");

                    if (current != null && current.has("temperature_2m")) {
                        double t = current.getDouble("temperature_2m");
                        int code = current.optInt("weather_code", 0);
                        int isDay = current.optInt("is_day", 1);
                        String tempStr = Math.round(t) + "°";
                        String conditionStr = getWeatherDescription(code, isDay == 1);

                        String highLowStr = "Max --° · Min --°";
                        if (daily != null) {
                            JSONArray maxArr = daily.optJSONArray("temperature_2m_max");
                            JSONArray minArr = daily.optJSONArray("temperature_2m_min");
                            if (maxArr != null && minArr != null && maxArr.length() > 0 && minArr.length() > 0) {
                                long maxT = Math.round(maxArr.getDouble(0));
                                long minT = Math.round(minArr.getDouble(0));
                                highLowStr = "Max " + maxT + "° · Min " + minT + "°";
                            }
                        }

                        String timeStr = new SimpleDateFormat("HH:mm", Locale.getDefault()).format(new Date());

                        prefs.edit()
                            .putString("temp", tempStr)
                            .putString("condition", conditionStr)
                            .putString("highLow", highLowStr)
                            .putString("consensus", "Consensus 12 modèles")
                            .putString("updated", timeStr)
                            .apply();

                        updateAllWidgets(context);
                    }
                }
                conn.disconnect();
            } catch (Exception e) {
                e.printStackTrace();
            }
        }).start();
    }

    private static String getWeatherDescription(int code, boolean isDay) {
        switch (code) {
            case 0:
                return isDay ? "Ensoleillé" : "Nuit claire";
            case 1:
                return isDay ? "Peu nuageux" : "Éclaircies";
            case 2:
                return "Partiellement nuageux";
            case 3:
                return "Couvert";
            case 45:
            case 48:
                return "Brouillard";
            case 51:
            case 53:
            case 55:
                return "Bruine";
            case 61:
                return "Pluie faible";
            case 63:
                return "Pluie modérée";
            case 65:
                return "Forte pluie";
            case 71:
            case 73:
            case 75:
                return "Chute de neige";
            case 80:
            case 81:
            case 82:
                return "Averses";
            case 85:
            case 86:
                return "Averses de neige";
            case 95:
            case 96:
            case 99:
                return "Orage";
            default:
                return "Variable";
        }
    }
}

