package com.awadev.itslearningautologin;

import android.annotation.TargetApi;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Message;
import android.support.v4.app.ActionBarDrawerToggle;
import android.support.v4.view.MenuCompat;
import android.support.v4.view.MenuItemCompat;
import android.support.v4.widget.DrawerLayout;
import android.support.v7.app.ActionBarActivity;
import android.util.Log;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.CookieSyncManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.ListView;
import android.widget.RelativeLayout;
import android.widget.TextView;
import android.widget.Toast;

import com.awadev.itslearningautologin.layout.MyProfileActivity;
import com.awadev.itslearningautologin.web.WebComponent;
import com.google.android.gms.ads.*;
import com.google.analytics.tracking.android.EasyTracker;
import com.thinkfree.showlicense.License;
import com.thinkfree.showlicense.LicensedProject;
import com.thinkfree.showlicense.android.ShowLicense;

import java.io.IOException;
import java.net.MalformedURLException;
import java.net.URL;

public class MainActivity extends ActionBarActivity {
    private static Boolean mToggleMenu = true;
    protected RelativeLayout webViewPlaceholder;
    private WebView mWebView;
    private Boolean mConfirmExit = false;
    private MenuItem mMenuToggleItem;

    // For navigation drawer
    private DrawerLayout mDrawerLayout;
    private ListView mDrawerList;
    private ActionBarDrawerToggle mDrawerToggle;

    private CharSequence mDrawerTitle;
    private CharSequence mTitle;
    private boolean mDownloadIntercept;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        if (WebComponent.mCookieStore == null) {
            Intent intent = new Intent(this, LoginActivity.class);
            startActivity(intent);
            finish();
            return;
        }
        initUI();

        AdView adView = (AdView) this.findViewById(R.id.adView);
        if(!((MainApplication)getApplication()).getIsPaidVersion()) { // Ads for the free version
            AdRequest adRequest = new AdRequest.Builder().addTestDevice("502EDA3917CEC9F7F86DC2B791E736A2").build();
            adView.loadAd(adRequest);
        }
        else {
            if (adView.getVisibility() == AdView.VISIBLE)
                adView.setVisibility(View.GONE);
        }

        checkAnalytics();
    }

    public void checkAnalytics() {
        SharedPreferences sharedPref = getSharedPreferences(LoginActivity.PREFS_NAME, Context.MODE_PRIVATE);
        final SharedPreferences.Editor editor = sharedPref.edit();

        if (!sharedPref.contains("com.awa.itslearning.ENABLE_ANALYTICS")) {
            AlertDialog.Builder builder = new AlertDialog.Builder(this);

            builder.setTitle(getString(R.string.allow_analytics_title))
                    .setMessage(getString(R.string.allow_analytics_message))
                    .setPositiveButton(getString(R.string.allow_analytics_yes), new DialogInterface.OnClickListener() {
                        @Override
                        public void onClick(DialogInterface dialog, int which) {
                            dialog.dismiss();
                            editor.putBoolean("com.awa.itslearning.ENABLE_ANALYTICS", true);
                            editor.apply();
                        }
                    })
                    .setNegativeButton(getString(R.string.allow_analytics_no), new DialogInterface.OnClickListener() {
                        @Override
                        public void onClick(DialogInterface dialog, int which) {
                            dialog.dismiss();
                            editor.putBoolean("com.awa.itslearning.ENABLE_ANALYTICS", false);
                            editor.apply();
                        }
                    });

            AlertDialog dialog = builder.create();
            dialog.show();
        }
    }

    @Override
    public void onStart() {
        super.onStart();

        // Analytics
        if (getSharedPreferences("credentials", Context.MODE_PRIVATE).getBoolean("com.awa.itslearning.ENABLE_ANALYTICS", false))
            EasyTracker.getInstance(this).activityStart(this);
    }

    @Override
    public void onStop() {
        super.onStop();

        // Analytics
        if (getSharedPreferences("credentials", Context.MODE_PRIVATE).getBoolean("com.awa.itslearning.ENABLE_ANALYTICS", false))
            EasyTracker.getInstance(this).activityStop(this);
    }

    private void initUI() {
        // Navigation drawer
        mTitle = mDrawerTitle = getTitle();
        String[] mPlanetTitles = getResources().getStringArray(R.array.planets_array);
        mDrawerLayout = (DrawerLayout) findViewById(R.id.drawer_layout);
        mDrawerList = (ListView) findViewById(R.id.left_drawer);

        // set a custom shadow that overlays the main content when the drawer opens
        //mDrawerLayout.setDrawerShadow(R.drawable.drawer_shadow, GravityCompat.START);
        // set up the drawer's list view with items and click listener
        mDrawerList.setAdapter(new ArrayAdapter<String>(this,
                android.R.layout.simple_list_item_1, mPlanetTitles));
        mDrawerList.setOnItemClickListener(new DrawerItemClickListener());

        // enable ActionBar app icon to behave as action to toggle nav drawer
        getSupportActionBar().setDisplayHomeAsUpEnabled(true);
        getSupportActionBar().setHomeButtonEnabled(true);

        // ActionBarDrawerToggle ties together the the proper interactions
        // between the sliding drawer and the action bar app icon
        mDrawerToggle = new ActionBarDrawerToggle(
                this,                  /* host Activity */
                mDrawerLayout,         /* DrawerLayout object */
                R.drawable.ic_drawer,  /* nav drawer image to replace 'Up' caret */
                R.string.drawer_open,  /* "open drawer" description for accessibility */
                R.string.drawer_close  /* "close drawer" description for accessibility */
        ) {
            public void onDrawerClosed(View view) {
                getSupportActionBar().setTitle(mTitle);
                supportInvalidateOptionsMenu(); // creates call to onPrepareOptionsMenu()
            }

            public void onDrawerOpened(View drawerView) {
                getSupportActionBar().setTitle(mDrawerTitle);
                supportInvalidateOptionsMenu(); // creates call to onPrepareOptionsMenu()
            }
        };
        mDrawerLayout.setDrawerListener(mDrawerToggle);
        // End navigation drawer

        webViewPlaceholder = ((RelativeLayout) findViewById(R.id.webViewPlaceholder));

        if (mWebView == null) {
            // Set cookies
            mWebView = new WebView(this);
            mWebView.setLayoutParams(new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

            CookieSyncManager.createInstance(this);
            WebComponent.copyCookies(CookieManager.getInstance());

            // Make the WebView behave like we want
            mWebView.getSettings().setJavaScriptEnabled(true);
            mWebView.getSettings().setDomStorageEnabled(true);
            mWebView.getSettings().setSupportZoom(true);
            mWebView.getSettings().setSupportMultipleWindows(true);
            mWebView.getSettings().setLayoutAlgorithm(WebSettings.LayoutAlgorithm.NARROW_COLUMNS);
            mWebView.getSettings().setUserAgentString("itsLearning login - Android");

            mWebView.setWebViewClient(new CustomWebClient());

            // Load!
            String url = ((MainApplication)getApplication()).getLoadUrl();
            if(url != null) {
                mWebView.loadUrl(url);
                ((MainApplication)getApplication()).setLoadUrl(null);
            }
            else
                mWebView.loadUrl(((MainApplication)getApplication()).baseURL + "/DashboardMenu.aspx");
        }
        // Attach the WebView to its placeholder
        webViewPlaceholder.addView(mWebView);
    }

    @Override
    protected void onPostCreate(Bundle savedInstanceState) {
        super.onPostCreate(savedInstanceState);
        // Sync the toggle state after onRestoreInstanceState has occurred.
        mDrawerToggle.syncState();
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        if (mWebView != null) {
            // Remove the WebView from the old placeholder
            webViewPlaceholder.removeView(mWebView);
        }

        super.onConfigurationChanged(newConfig);

        // Load the layout resource for the new configuration
        setContentView(R.layout.activity_main);

        // Pass any configuration change to the drawer toggls
        mDrawerToggle.onConfigurationChanged(newConfig);

        // Reinitialize the UI
        initUI();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);

        // Save the state of the WebView
        mWebView.saveState(outState);
    }

    @Override
    protected void onRestoreInstanceState(Bundle savedInstanceState) {
        super.onRestoreInstanceState(savedInstanceState);

        // Restore the state of the WebView
        mWebView.restoreState(savedInstanceState);
    }

    private int hot_number = 0;
    private TextView ui_hot = null;

    @TargetApi(Build.VERSION_CODES.HONEYCOMB)
    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        // Inflate the menu; this adds items to the action bar if it is present.
        getMenuInflater().inflate(R.menu.main, menu);
        mMenuToggleItem = menu.findItem(R.id.action_toggle_menu);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.HONEYCOMB)
            mMenuToggleItem.setShowAsAction(MenuItem.SHOW_AS_ACTION_ALWAYS);

        if (mToggleMenu)
            mMenuToggleItem.setIcon(R.drawable.ic_action_collapse);
        else
            mMenuToggleItem.setIcon(R.drawable.ic_action_expand);

//        MenuItem item =  menu.findItem(R.id.action_notification_dropdown);
//        MenuItemCompat.setActionView(item, R.layout.action_bar_notifitcation_icon);
//        final View menu_hotlist = MenuItemCompat.getActionView(item);
//        ui_hot = (TextView) menu_hotlist.findViewById(R.id.notification_number);
//        updateHotCount(5);

        return super.onCreateOptionsMenu(menu);
    }

    // call the updating code on the main thread,
// so we can call this asynchronously
//    public void updateHotCount(final int new_hot_number) {
//        hot_number = new_hot_number;
//        if (ui_hot == null) return;
//        runOnUiThread(new Runnable() {
//            @Override
//            public void run() {
//                if (new_hot_number == 0)
//                    ui_hot.setVisibility(View.INVISIBLE);
//                else {
//                    ui_hot.setVisibility(View.VISIBLE);
//                    ui_hot.setText(Integer.toString(new_hot_number));
//                }
//            }
//        });
//    }

    /**
     * Action bar buttons
     */
    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        // The action bar home/up action should open or close the drawer.
        // ActionBarDrawerToggle will take care of this.
        if (mDrawerToggle.onOptionsItemSelected(item)) {
            return true;
        }

        // Handle action buttons
        switch (item.getItemId()) {
            case R.id.action_toggle_menu:
                mWebView.loadUrl("javascript:$(\"#ctl00_BottomNavigationBar_ArrowButton\").click();");

                mToggleMenu = !mToggleMenu;
                if (mToggleMenu)
                    item.setIcon(R.drawable.ic_action_collapse);
                else
                    item.setIcon(R.drawable.ic_action_expand);
                return true;

            case R.id.action_toggle_javascript:
                mWebView.getSettings().setJavaScriptEnabled(!mWebView.getSettings().getJavaScriptEnabled());
                mWebView.reload();
                Toast.makeText(this, "Javascript: " + (mWebView.getSettings().getJavaScriptEnabled() ? getString(R.string.on) : getString(R.string.off)), Toast.LENGTH_SHORT).show();
                return true;

            case R.id.action_refresh:
                mWebView.reload();
                Toast.makeText(this, getString(R.string.toast_refresh), Toast.LENGTH_SHORT).show();
                return true;

//            case R.id.action_profile_dropdown:
//                mWebView.loadUrl("javascript:$(\"#personal-menu-dd\").toggle();");
//                return true;
//
//            case R.id.action_mail_dropdown:
//                mWebView.loadUrl("javascript:$(\"#ctl00_PersonalResponsiveMenu_InboxLink\").click();");
//                return true;
//
//            case R.id.action_notification_dropdown:
//                mWebView.loadUrl("javascript:$(\"#ctl00_PersonalResponsiveMenu_NotificationLink\").click();");
//                return true;

            case R.id.action_settings:
                Toast.makeText(this, getResources().getText(R.string.no_settings), Toast.LENGTH_SHORT).show();
                return true;

            case R.id.action_logout:
                SharedPreferences sharedPref = getSharedPreferences(LoginActivity.PREFS_NAME, Context.MODE_PRIVATE);
                SharedPreferences.Editor editor = sharedPref.edit();
                editor.remove(getString(R.string.password_key));
                editor.commit();

                WebComponent.mCookieStore.clear();

                Intent intent = new Intent(this, LoginActivity.class);
                startActivity(intent);
                finish();
                return true;

            case R.id.action_licenses:
                LicensedProject showLicense = new LicensedProject("showlicense", null, "https://github.com/behumble/showlicense", License.APACHE2);
                LicensedProject asyncHttp = new LicensedProject("Android Asynchronous Http Client", null, "http://loopj.com/android-async-http/", License.APACHE2);
                LicensedProject jSoup = new LicensedProject("jsoup", null, "http://jsoup.org/", License.MIT);

                LicensedProject[] projList = new LicensedProject[]{showLicense, asyncHttp, jSoup};
                ShowLicense.createDialog(this, getString(R.string.title_licenses), projList).show();
                return true;

            default:
                Log.i("AWA", "MenuItem clicked: " + item.getItemId());
                return super.onOptionsItemSelected(item);
        }
    }

    /**
     * Handles physical back button
     *
    public void onBackPressed() {
        if (mWebView.canGoBack()) {
            mWebView.goBack();
        } else {
            if (mConfirmExit) {
//                Intent intent = new Intent(Intent.ACTION_MAIN);
//                intent.addCategory(Intent.CATEGORY_HOME);
//                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
//                startActivity(intent);
//                finish();
                super.onBackPressed();
                return;
            } else {
                Toast.makeText(this, getResources().getText(R.string.toast_exit), Toast.LENGTH_SHORT).show();
                mConfirmExit = true;
            }
        }
    }

    /**
     * Removes the space demanding organization logo
     */
    private void removeLogo() {
        mWebView.loadUrl("javascript:$('.l-logo').remove();");
        mWebView.loadUrl("javascript:IframeResizer.registerDefaultHeight({'iframeClientId':'ctl00_ContentAreaIframe','setIframeDefaultHeightFunctionName':'setIframeDefaultHeight'}, resizeCallback);");
    }

    /**
     * Handles normal link clicks
     */
    class CustomWebClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            // mWebView.getSettings().setJavaScriptEnabled(true);
            view.loadUrl(url);
            mConfirmExit = false;
            //Log.v("TESTAWA", "shouldOverrideUrlLoading: " + url);

            // Possible fix of "logged out in webview" bug
            if(url.toLowerCase().contains("index.aspx")) {
                WebComponent.mCookieStore.clear();

                Intent intent = new Intent(getApplicationContext(), LoginActivity.class);
                startActivity(intent);
                finish();
            }
            else if (url.contains("GetFile.aspx")) { // For downloading files
                // Get cookie url
                String donwloadDomain = "";
                try {
                    URL fullURL = new URL(((MainApplication) getApplication()).baseURL);
                    donwloadDomain = fullURL.getHost();
                } catch (MalformedURLException e) {
                    e.printStackTrace();
                }

                DownloadManager.Request r = new DownloadManager.Request(Uri.parse(url));

                r.addRequestHeader("Cookie", WebComponent.generateCookieString(WebComponent.mCookieStore, donwloadDomain));

                // This put the download in the same Download dir the browser uses
                r.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, Uri.decode(Uri.parse(url).getQueryParameter("FileName")));

                int apiLevel = Build.VERSION.SDK_INT;
                if (apiLevel >= Build.VERSION_CODES.HONEYCOMB) {
                    // When downloading music and videos they will be listed in the player
                    r.allowScanningByMediaScanner();
                    // Notify user when download is completed
                    r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                }

                // Start
                //
                // download
                DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                dm.enqueue(r);
            }
            return false;
        }

        @Override
        public void onPageStarted(WebView view, String url, Bitmap favicon) {
            if (mMenuToggleItem != null)
                mMenuToggleItem.setEnabled(false);
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            if (mMenuToggleItem != null)
                mMenuToggleItem.setEnabled(true);
            removeLogo();
            //Log.v("TESTAWA", "onPageFinished: " + url);
            }

        @Override
        public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
            //Log.e("AWA500", "WebView error:" + description);
        }

        @TargetApi(Build.VERSION_CODES.HONEYCOMB)
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, final String url) {
            WebResourceResponse wr = null;
            //Log.v("TESTAWA", "shouldInterceptRequest: " + url);

            // Run javascript to fix download links, bad hack
            mWebView.post(new Runnable() {
                @Override
                public void run() {
                    mWebView.loadUrl("javascript:if(window.frames[0]){for(var i=0;i<window.frames[0].document.links.length;i++){if(window.frames[0].document.links[i].target==\"_blank\"){window.frames[0].document.links[i].removeAttribute(\"target\")}}}");
                }
            });
            if(url.contains("download.aspx") && !mDownloadIntercept) {// File page, redirect us to it
                mDownloadIntercept = true;
                //Log.v("TESTAWA", "DOWNLOAD INTERCEPT: " + url);
                mWebView.post(new Runnable() {
                    @Override
                    public void run() {
                        mWebView.loadUrl(url);
                    }
                });
                return wr;
            }
            mDownloadIntercept = false;

            // Bug fix required API 11, but is not needed in 19+
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.HONEYCOMB && Build.VERSION.SDK_INT < Build.VERSION_CODES.KITKAT) {
                //Log.e("interceptrquest", url);
                if (url.contains("commonControlLibrary.min.js")) {
                    try {
                        wr = new WebResourceResponse("", "", new URL("http://storage.googleapis.com/testawa/commonNew.js").openStream());
                    } catch (IOException e) {
                        e.printStackTrace();
                    }
                    //Log.e("interceptrquest123", url);
                }
            }
            return wr;
        }
    }

    /* The click listner for ListView in the navigation drawer */
    private class DrawerItemClickListener implements ListView.OnItemClickListener {
        @Override
        public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
            switch(position)
            {
                case 0: // Dashboard
                    mWebView.loadUrl(((MainApplication)getApplication()).baseURL + "/DashboardMenu.aspx");
                    break;
                case 1: // Min profil
                    mWebView.loadUrl(((MainApplication)getApplication()).baseURL + "/Person/show_person.aspx");
                    break;
                case 2: // Karakterer
//                    if(((MainApplication)getApplication()).getIsPaidVersion()) {
//                        Intent intent = new Intent(getBaseContext(), MyProfileActivity.class);
//                        startActivity(intent);
//                        //finish();
//                        break;
//                    }
                    mWebView.loadUrl(((MainApplication)getApplication()).baseURL + "/Person/PersonAssessment.aspx");
                    break;
                case 3: // Fravær
                    mWebView.loadUrl(((MainApplication)getApplication()).baseURL + "/Person/PersonAttendance.aspx");
                    break;
                case 4: // Orden
                    mWebView.loadUrl(((MainApplication)getApplication()).baseURL + "/Person/PersonBehaviour.aspx");
                    break;
            }
            mDrawerLayout.closeDrawer(mDrawerList);
        }
    }
}
