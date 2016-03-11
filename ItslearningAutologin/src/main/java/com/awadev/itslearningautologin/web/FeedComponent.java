package com.awadev.itslearningautologin.web;

import android.content.Context;

import com.loopj.android.http.AsyncHttpResponseHandler;

/**
 * Created by Audun on 16.01.14.
 */
public class FeedComponent extends WebComponent {
    public FeedComponent(Context context) {
        super(context);
    }
    @Override
    public void start(FinishCallback callable) {
        super.start(callable);

        client.get("https://idp.feide.no/simplesaml/module.php/attribViewer/", new AsyncHttpResponseHandler() {
            @Override
            public void onSuccess(String response) {
                parseSource(response);
                // Successfully got a response
            }

            @Override
            public void onFailure(Throwable e, String response) {
                error(0);
                // Response failed :(
            }
        });
    }

    private void parseSource(String html) {

    }
}
