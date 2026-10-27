package com.dfwmeteo.app;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "DFWMeteoWidget")
public class DFWMeteoWidgetPlugin extends Plugin {

    @PluginMethod
    public void updateWidget(PluginCall call) {
        String city = call.getString("city", "Bruxelles");
        String lat = call.getString("lat", "50.8503");
        String lon = call.getString("lon", "4.3517");
        String temp = call.getString("temp", "--°");
        String condition = call.getString("condition", "DFWMeteo");
        String highLow = call.getString("highLow", "Max --° · Min --°");
        String consensus = call.getString("consensus", "Consensus 12 modèles");
        String updated = call.getString("updated", "En direct");

        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences(DFWMeteoWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
            .putString("city", city)
            .putString("lat", lat)
            .putString("lon", lon)
            .putString("temp", temp)
            .putString("condition", condition)
            .putString("highLow", highLow)
            .putString("consensus", consensus)
            .putString("updated", updated)
            .apply();

        DFWMeteoWidgetProvider.updateAllWidgets(context);

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void getSavedPlace(PluginCall call) {
        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences(DFWMeteoWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE);
        JSObject ret = new JSObject();
        ret.put("city", prefs.getString("city", null));
        ret.put("lat", prefs.getString("lat", null));
        ret.put("lon", prefs.getString("lon", null));
        call.resolve(ret);
    }
}

