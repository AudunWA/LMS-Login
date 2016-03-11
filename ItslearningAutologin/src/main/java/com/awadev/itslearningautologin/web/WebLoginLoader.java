package com.awadev.itslearningautologin.web;

import android.content.Context;
import android.support.v4.content.AsyncTaskLoader;
import android.webkit.CookieManager;

/**
 * Created by Audun on 13.02.14.
 */
public class WebLoginLoader extends AsyncTaskLoader<CookieManager> {
    public WebLoginLoader(Context context) {
        super(context);
    }

    @Override
    public CookieManager loadInBackground() {
        return null;
    }
}
