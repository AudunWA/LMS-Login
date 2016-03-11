package com.awadev.itslearningautologin;

import android.app.Application;
import android.content.Context;
import android.content.SharedPreferences;

/**
 * Created by Audun on 05.02.14.
 * Used to store global variables
 */
public class MainApplication extends Application {

    private Boolean isPaidVersion = false;
    public String baseURL;
    private String loadURL;

    public Boolean getIsPaidVersion() {
        return isPaidVersion;
    }

    public void setIsPaidVersion(Boolean isPaidVersion) {
        this.isPaidVersion = isPaidVersion;
    }

    public Boolean getPaidToastStatus() {
        SharedPreferences sharedPref = getSharedPreferences("credentials", Context.MODE_PRIVATE);
        return sharedPref.contains("com.awa.itslearning.PLUSTOAST");
    }

    public void setPaidToastStatus() {
        SharedPreferences sharedPref = getSharedPreferences("credentials", Context.MODE_PRIVATE);
        sharedPref.edit().putBoolean("com.awa.itslearning.PLUSTOAST", true).commit();
    }

    public String getLoadUrl() {
        return loadURL;
    }

    public void setLoadUrl(String loadURL) {
        this.loadURL = loadURL;
    }
}