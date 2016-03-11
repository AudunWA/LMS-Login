package com.awadev.itslearningautologin;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.Dialog;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.support.v7.app.ActionBarActivity;
import android.text.Editable;
import android.text.TextWatcher;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.view.Window;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ListView;
import android.widget.Toast;

import com.awadev.itslearningautologin.web.FinishCallback;
import com.awadev.itslearningautologin.web.WebComponent;
import com.awadev.itslearningautologin.web.WebLogin;
import com.google.analytics.tracking.android.EasyTracker;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.io.InputStream;
import java.net.MalformedURLException;
import java.net.URL;
import java.util.ArrayList;
import java.util.TreeMap;

public class LoginActivity extends Activity {

    public static final String PREFS_NAME = "credentials";
    public static final String ORGANIZATION_KEY = "com.awa.itslearning.ORGANIZATION_NAME";
    public static final String VERSION_KEY = "com.awa.itslearning.VERSION";

    private EditText _username;
    private EditText _password;
    private ListView _listView;
    private Button _orgButton;
    private Dialog _popupWindow;
    private ArrayAdapter<CharSequence> _adapter;

    private TreeMap<String, Integer> _organizationIDs;
    private TreeMap<String, String> _organizationDomains;
    private static Boolean mIsLoading = false;

    private WebLogin mWebLoginComponent;

    public String getUsername() {
        return _username.getText().toString();
    }

    public String getPassword() {
        return _password.getText().toString();
    }

    public Integer getOrganizationID() {
        return _organizationIDs.get(_orgButton.getText().toString().replace(" (FEIDE)", ""));
    }

    public String getOrganizationDomain() {
        return _organizationDomains.get(_orgButton.getText().toString());
    }

    public Boolean isFeideLogin() {
        return _organizationDomains.containsKey(_orgButton.getText().toString());
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        PackageManager manager = getPackageManager();
        if (manager.checkSignatures("com.awadev.itslearningautologin", "com.awadev.itslearningplus") == PackageManager.SIGNATURE_MATCH) {
            ((MainApplication)getApplication()).setIsPaidVersion(true);
        }
        //Log.e("AWA500", "LoginActivity onCreate");
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_login);

        if(((MainApplication)getApplication()).getIsPaidVersion()) {
            if(!((MainApplication) getApplication()).getPaidToastStatus())
            {
                Toast.makeText(this, getString(R.string.toast_thankyou), Toast.LENGTH_LONG).show();
                ((MainApplication) getApplication()).setPaidToastStatus();
            }
        }

        Intent launchIntent = getIntent();
        if (launchIntent.getAction().equals(Intent.ACTION_VIEW)) {
            Uri uri = launchIntent.getData();
            ((MainApplication) getApplication()).setLoadUrl(uri.toString());
        }


        if (mIsLoading) {
            startProgressBar();
            return;
        }

        if (WebComponent.mCookieStore != null && WebComponent.mCookieStore.getCookies().size() >= 10) { // Existing session?
            Intent intent = new Intent(this, MainActivity.class);
            startActivity(intent);
            finish();
            return;
        }

        _username = (EditText) findViewById(R.id.txtUsername);
        _password = (EditText) findViewById(R.id.txtPassword);
        _orgButton = (Button) findViewById(R.id.spinner);

        loadOrganizations();
        Boolean nameSaved = false, passwordSaved = false, organizationSaved = false;

        SharedPreferences sharedPref = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        if (sharedPref.contains(getString(R.string.username_key))) { // Load this
            _username.setText(sharedPref.getString(getString(R.string.username_key), ""));
            nameSaved = true;
        }
        if (sharedPref.contains(getString(R.string.password_key))) { // Load this
            _password.setText(sharedPref.getString(getString(R.string.password_key), ""));
            passwordSaved = true;
        }

        if (sharedPref.contains(ORGANIZATION_KEY)) { // Load this
            _orgButton.setText(sharedPref.getString(ORGANIZATION_KEY, getString(R.string.placeholder_select_organization)));
            organizationSaved = true;
        }

        try {
            if(sharedPref.getInt(VERSION_KEY, 0) != getPackageManager().getPackageInfo(getPackageName(), 0).versionCode) {
                // Update organization to new system
                if(_organizationDomains.containsKey(_orgButton.getText() + " (FEIDE)")) {
                    _orgButton.setText(_orgButton.getText() + " (FEIDE)");
                }

                // Update the key
                SharedPreferences.Editor editor = sharedPref.edit();
                editor.putInt(VERSION_KEY, getPackageManager().getPackageInfo(getPackageName(), 0).versionCode);
                editor.commit();
            }
        } catch (PackageManager.NameNotFoundException e) {
            e.printStackTrace();
        }

        if (nameSaved && passwordSaved && organizationSaved) {
            // Autologin!
            onClick(null);
            return;
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

    private void loadOrganizations() {
        ArrayList<String> spinnerValues = new ArrayList<String>();

        JSONArray array;
        try {
            array = new JSONArray(loadJSONFromAsset("organizations.json"));
            _organizationIDs = new TreeMap<String, Integer>();
            _organizationDomains = new TreeMap<String, String>();

            for (int i = 0; i < array.length(); i++) {
                JSONObject object = array.getJSONObject(i);
                if(object.has("feidedomain")) { // Add option for FEIDE
                    spinnerValues.add(object.getString("value") + " (FEIDE)");
                    _organizationDomains.put(object.getString("value") + " (FEIDE)", object.getString("feidedomain"));
                }
                spinnerValues.add(object.getString("value"));
                _organizationIDs.put(object.getString("value"), Integer.parseInt(object.getString("id")));
            }
        } catch (JSONException x) {
            Log.e("","");
        }

        //if (spinnerValues.length == 0) { // JSON shit failed, use backup
        //    spinnerValues = new String[OrganizationManager.organizations.size()];
        //    OrganizationManager.organizations.keySet().toArray(spinnerValues);
        //}
        _adapter = new ArrayAdapter<CharSequence>(this, android.R.layout.simple_list_item_1, spinnerValues.toArray(new String[spinnerValues.size()]));
    }
    private void populateSpinner() {
        _listView.setAdapter(_adapter);
        //spinner.setEnabled(false); // temp
    }

    private void startProgressBar() {
        findViewById(R.id.txtUsername).setVisibility(View.INVISIBLE);
        findViewById(R.id.txtPassword).setVisibility(View.INVISIBLE);
        findViewById(R.id.spinner).setVisibility(View.INVISIBLE);
        findViewById(R.id.button).setVisibility(View.INVISIBLE);
        findViewById(R.id.progressBar).setVisibility(View.VISIBLE);
    }

    private void stopProgressBar() {
        findViewById(R.id.txtUsername).setVisibility(View.VISIBLE);
        findViewById(R.id.txtPassword).setVisibility(View.VISIBLE);
        findViewById(R.id.spinner).setVisibility(View.VISIBLE);
        findViewById(R.id.button).setVisibility(View.VISIBLE);
        findViewById(R.id.progressBar).setVisibility(View.INVISIBLE);
    }

    public void onClick(View view) {
        if(view != null && view.getId() == R.id.spinner) {
            LayoutInflater layoutInflater
                    = (LayoutInflater)getBaseContext()
                    .getSystemService(LAYOUT_INFLATER_SERVICE);
            View popupView = layoutInflater.inflate(R.layout.searchable_spinner_box, null);
            _popupWindow = new Dialog(this);
            _popupWindow.requestWindowFeature(Window.FEATURE_NO_TITLE);
            _popupWindow.setContentView(popupView);
            _popupWindow.setTitle(getString(R.string.select_organization_title));

            _listView = (ListView)_popupWindow.findViewById(R.id.listView);
            _listView.setOnItemClickListener(new AdapterView.OnItemClickListener() {
                @Override
                public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
                    _orgButton.setText((String)parent.getAdapter().getItem(position));
                    _popupWindow.dismiss();
                }
            });

            populateSpinner();


            EditText editText = (EditText)_popupWindow.findViewById(R.id.editText);
            editText.addTextChangedListener(new TextWatcher() {
                @Override
                public void beforeTextChanged(CharSequence s, int start, int count, int after) {

                }

                @Override
                public void onTextChanged(CharSequence s, int start, int before, int count) {
                    _adapter.getFilter().filter(s);
                }

                @Override
                public void afterTextChanged(Editable s) {

                }
            });

            SharedPreferences sharedPref = getSharedPreferences("credentials", Context.MODE_PRIVATE);
            _listView.setSelection((int) sharedPref.getLong("com.awa.itslearning.ORGANIZATION", (long) 0));

            _popupWindow.show();
            return;
        }
        else
        {
            if(_username.getText().length() == 0 || _password.getText().length() == 0)
                return;

            startProgressBar();
            mIsLoading = true;
            mWebLoginComponent = new WebLogin(this);
            mWebLoginComponent.start(new FinishCallback() {
                @Override
                public void call() {
                    onFinish();
                }
            }
            );
        }
    }

    public void onFinish() {
        mIsLoading = false;
        if (mWebLoginComponent.errorCode > -1) {
            stopProgressBar();

            // 1. Instantiate an AlertDialog.Builder with its constructor
            AlertDialog.Builder builder = new AlertDialog.Builder(this);

// 2. Chain together various setter methods to set the dialog characteristics
            builder.setMessage(String.format(getString(R.string.login_fail_message), new Object[]{mWebLoginComponent.errorCode}))
                    .setTitle(getString(R.string.login_fail_title)).setNegativeButton(getString(R.string.login_fail_ok), new DialogInterface.OnClickListener() {
                @Override
                public void onClick(DialogInterface dialog, int which) {
                    dialog.dismiss();
                }
            });

// 3. Get the AlertDialog from create()
            AlertDialog dialog = builder.create();
            dialog.show();

            return;
        }
        //Log.i("main", "onFinish!" + mWebLoginComponent.realName);
        //stopProgressBar();

        SharedPreferences sharedPref = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = sharedPref.edit();
        editor.putString(getString(R.string.username_key), _username.getText().toString());
        editor.putString(getString(R.string.password_key), _password.getText().toString());
        editor.putString(ORGANIZATION_KEY, (String) _orgButton.getText());
        editor.commit();

        URL fullURL = null;
        try {
            fullURL = new URL(WebComponent.getUrl(WebComponent.client));
            String baseUrl = "http://" + fullURL.getHost();
            ((MainApplication) getApplication()).baseURL = baseUrl;

            Intent intent = new Intent(this, MainActivity.class);
            startActivity(intent);
            finish();
        } catch (MalformedURLException e) {
            e.printStackTrace();
        }
    }

    public String loadJSONFromAsset(String fileName) {
        String json = null;
        try {

            InputStream is = getAssets().open(fileName);

            int size = is.available();

            byte[] buffer = new byte[size];

            is.read(buffer);

            is.close();

            json = new String(buffer, "UTF-8");


        } catch (IOException ex) {
            ex.printStackTrace();
            return null;
        }
        return json;

    }
}