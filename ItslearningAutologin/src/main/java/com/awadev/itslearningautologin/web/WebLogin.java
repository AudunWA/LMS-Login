package com.awadev.itslearningautologin.web;

import android.content.Context;

import com.awadev.itslearningautologin.LoginActivity;
import com.awadev.itslearningautologin.MainApplication;
import com.loopj.android.http.AsyncHttpResponseHandler;
import com.loopj.android.http.RequestParams;

import org.apache.http.Header;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;

/**
 * Created by Audun on 27.10.13.
 */
public class WebLogin extends WebComponent {
    public String realName = "";
    private LoginActivity mLoginActivity;

    public WebLogin(Context context) {
        super(context);
        mLoginActivity = (LoginActivity) context;
    }

    @Override
    public void start(FinishCallback callable) {
        super.start(callable);

        if (mLoginActivity.isFeideLogin())
            startLoginFeide();
        else
            startLoginNormal();
    }

    private void startLoginNormal() {
        client.post("https://www.itslearning.com/Index.aspx?customerid=" + mLoginActivity.getOrganizationID(), new AsyncHttpResponseHandler() {
            @Override
            public void onSuccess(String pageSource) {
                Document doc = Jsoup.parse(pageSource);
                String newURL = doc.select("form[name=form]").attr("action");
                // Successfully got a response
                client.post(newURL, new AsyncHttpResponseHandler() {
                    @Override
                    public void onSuccess(String pageSource) {
                        sendItslearningCredentials(pageSource);
                        // Successfully got a response
                    }

                    @Override
                    public void onFailure(Throwable e, String response) {
                        error(0);
                        // Response failed :(
                    }
                });
            }

            @Override
            public void onFailure(Throwable e, String response) {
                error(1);
                // Response failed :(
            }
        });
    }

    private void sendItslearningCredentials(String pageSource) {
        Document doc = Jsoup.parse(pageSource);
        String viewState = doc.select("input[name=__VIEWSTATE]").val();
        String eventValidation = doc.select("input[name=__EVENTVALIDATION]").val();

        // make params
        RequestParams params = new RequestParams();
        params.put("ctl00$ContentPlaceHolder1$Username$input", mLoginActivity.getUsername());
        params.put("ctl00$ContentPlaceHolder1$Password$input", mLoginActivity.getPassword());
        params.put("ctl00$ContentPlaceHolder1$nativeLoginButton", "Log in");
        params.put("ctl00$ContentPlaceHolder1$showNativeLoginValueField", "");
        params.put("ctl00$language_internal$H", "1");
        params.put("__EVENTTARGET", "");
        params.put("__EVENTARGUMENT", "");
        params.put("__LASTFOCUS", "");
        params.put("__VIEWSTATE", viewState);
        params.put("__EVENTVALIDATION", eventValidation);
        //Log.e("targetUrl", targetUrl);
        String targetUrl = WebComponent.getUrl(client);
        client.post(targetUrl, params, new AsyncHttpResponseHandler() {
            @Override
            public void onSuccess(String response) {
                String newLocation = getUrl(client);
                if (!newLocation.contains("DashboardMenu.aspx")) {
                    // Wrong credentials!
                    error(100);
                    return;
                }
                onHttpFinish();
                // Successfully got a response
            }

            @Override
            public void onFailure(Throwable e, String response) {
                error(101);
                //Log.e("NetworkShit", e.toString() + e.getMessage() + response + " " + WebManager.getUrl(WebManager.getClient()) + _username.getText().toString() + _password.getText().toString());
                // Response failed :(
            }
        });
    }

    private void startLoginFeide() {
        client.get("https://idp.feide.no/simplesaml/module.php/attribViewer/", new AsyncHttpResponseHandler() {
            @Override
            public void onSuccess(String response) {
                sendDomain();
                // Successfully got a response
            }

            @Override
            public void onFailure(Throwable e, String response) {
                error(200);
                // Response failed :(
            }
        });
    }

    private void sendDomain() {
        String targetUrl = WebComponent.getUrl(client);
        client.get(targetUrl, new RequestParams("org", mLoginActivity.getOrganizationDomain()), new AsyncHttpResponseHandler() {
            @Override
            public void onSuccess(String response) {
                sendCredentials();
                // Successfully got a response
            }

            @Override
            public void onFailure(Throwable e, String response) {
                error(300);
                // Response failed :(
            }
        });
    }

    private void sendCredentials() {
        String targetUrl = WebComponent.getUrl(client);

        // make params
        RequestParams params = new RequestParams();
        params.put("feidename", mLoginActivity.getUsername());
        params.put("password", mLoginActivity.getPassword());
        //Log.e("targetUrl", targetUrl);
        client.post(targetUrl, params, new AsyncHttpResponseHandler() {
            @Override
            public void onSuccess(String response) {
                String newLocation = getUrl(client);
                if (newLocation.contains("login")) {
                    // Wrong credentials!
                    error(400);
                    return;
                }

                itslearningRedirect();
                // Successfully got a response
            }

            @Override
            public void onFailure(Throwable e, String response) {
                error(401);
                //Log.e("NetworkShit", e.toString() + e.getMessage() + response + " " + WebManager.getUrl(WebManager.getClient()) + _username.getText().toString() + _password.getText().toString());
                // Response failed :(
            }
        });
    }

    private void itslearningRedirect() {
        String orgID;
        try {
            orgID = mLoginActivity.getOrganizationID().toString();
        }
        catch (Exception x) {
            error(501);
            return;
        }
        // make params
        RequestParams params = new RequestParams();
        params.put("CustomerId", orgID);
        params.put("EloginContextId", "0");

        client.get("https://www.itslearning.com/elogin/autologin.aspx", params, new AsyncHttpResponseHandler() {
            @Override
            public void onSuccess(String response) {
                sendSamlResponse(response);
                //Log.e("AWA500", "redirect, url: " + getUrl(client));
                // Successfully got a response
            }

            @Override
            public void onFailure(Throwable e, String response) {
                error(500);
                //Log.e("AWA500", "redirectError, url: " + getUrl(client));
                // Response failed :(
            }
        });
    }

    private void sendSamlResponse(String samlResponseSource) {
        Document doc = Jsoup.parse(samlResponseSource);
        final String samlResponse = doc.select("input[name=SAMLResponse]").val();

        // make params
        RequestParams params = new RequestParams();
        params.put("SAMLResponse", samlResponse);
        params.put("RelayState", "https://www.itslearning.com/elogin/default.aspx");


        client.post("https://www.itslearning.com/elogin/default.aspx", params, new AsyncHttpResponseHandler() {
            @Override
            public void onSuccess(String response) {
                    Document doc = Jsoup.parse(response);
                    String newURL = doc.select("form[name=form]").attr("action");
                    if(newURL == "") {
                        // Wrong credentials!
                        error(700);
                        return;
                    }
                    sendSamlResponse2(samlResponse, newURL);
                }

            @Override
            public void onFailure(Throwable e, String response) {
                // Response failed :(
                error(701);
            }
        });
    }

    private void sendSamlResponse2(String samlResponse, String targetUrl) {
        // make params
        RequestParams params = new RequestParams();
        params.put("SAMLResponse", samlResponse);
        params.put("RelayState", "https://www.itslearning.com/elogin/default.aspx");

        client.post(targetUrl, params, new AsyncHttpResponseHandler() {
            @Override
            public void onSuccess(String response) {
                String newLocation = getUrl(client);
                if (!newLocation.contains("DashboardMenu.aspx")) {
                    // Wrong credentials!
                    error(600);
                    return;
                }

                onHttpFinish();
            }

            @Override
            public void onFailure(Throwable e, String response) {
                // Response failed :(
                error(601);
            }
        });
    }
}
