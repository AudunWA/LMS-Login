package com.awadev.itslearningautologin.web;

import android.content.Context;
import android.webkit.CookieManager;

import com.awadev.itslearningautologin.MainApplication;
import com.loopj.android.http.AsyncHttpClient;

import org.apache.http.client.CookieStore;
import org.apache.http.client.params.ClientPNames;
import org.apache.http.cookie.Cookie;
import org.apache.http.impl.client.BasicCookieStore;
import org.apache.http.impl.client.RequestWrapper;
import org.apache.http.protocol.ExecutionContext;

import java.util.Map;
import java.util.TreeMap;

/**
 * Created by Audun on 27.10.13.
 */
public class WebComponent {
    public static AsyncHttpClient client;

    protected Context mContext;
    protected FinishCallback mFinishCallback;
    public static BasicCookieStore mCookieStore;
    public Integer errorCode = -1;

    public WebComponent(Context context) {
        mContext = context;
    }

    public void start(FinishCallback callable) {
        mFinishCallback = callable;

        if (client == null)
            setupWebClient();
    }

    private void setupWebClient() {
        client = new AsyncHttpClient();

        // This solves some strange login errors
        client.getHttpClient().getParams().setParameter(ClientPNames.ALLOW_CIRCULAR_REDIRECTS, true);

        // Set up cookies
        if (mCookieStore == null)
            mCookieStore = new BasicCookieStore();

        //myCookieStore.clear();
        client.setCookieStore(mCookieStore);
    }

    protected void onHttpFinish() {
        mFinishCallback.call();
    }

    protected void error(int code) {
        errorCode = code;
        onHttpFinish();
    }

    public static String getUrl(AsyncHttpClient httpClient) {
        return httpClient.getHttpContext().getAttribute(ExecutionContext.HTTP_TARGET_HOST).toString() +
                ((RequestWrapper) httpClient.getHttpContext().getAttribute(ExecutionContext.HTTP_REQUEST)).getURI().toString();
    }

    public static String generateCookieString(CookieStore cookieStore, String domain) {
        String cookieString = "";
        for (Cookie cookie : cookieStore.getCookies()) {
            if (cookie.getDomain().equals(domain) || domain.equals(""))
                cookieString += cookie.getName() + "=" + cookie.getValue() + ";";
        }
        return cookieString;
    }

    public static void copyCookies(CookieManager instance) {
        TreeMap<String, String> cookieMap = new TreeMap<String, String>();
        for (Cookie cookie : mCookieStore.getCookies()) {
            if (cookieMap.containsKey(cookie.getDomain()))
                cookieMap.put(cookie.getDomain(), cookieMap.get(cookie.getDomain()) + cookie.getName() + "=" + cookie.getValue() + ";");
            else
                cookieMap.put(cookie.getDomain(), cookie.getName() + "=" + cookie.getValue() + ";");
        }
        for (Map.Entry<String, String> entry : cookieMap.entrySet())
            instance.setCookie(entry.getKey(), entry.getValue());
    }
}
