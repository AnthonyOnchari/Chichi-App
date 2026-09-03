package com.onchari.chichi;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebSettings;
import android.widget.ProgressBar;
import android.widget.Toast;
import android.Manifest;
import android.content.pm.PackageManager;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.splashscreen.SplashScreen;

import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;
import com.google.firebase.auth.AuthCredential;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.auth.GoogleAuthProvider;
import com.google.firebase.messaging.FirebaseMessaging;

import org.json.JSONObject;

public class LauncherActivity extends AppCompatActivity {

    private WebView webView;
    private ProgressBar progressBar;
    private boolean pageLoaded = false;
    private static final int RC_SIGN_IN = 9001;

    // Firebase Auth
    private FirebaseAuth mAuth;
    private GoogleSignInClient mGoogleSignInClient;

    // JavaScript interface for communicating with WebView
    private class ChichiJSInterface {
        @android.webkit.JavascriptInterface
        public void signInWithGoogle() {
            // Called from JavaScript when user clicks "Sign in with Google"
            startGoogleSignIn();
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webView);
        progressBar = findViewById(R.id.progressBar);

        // --- Firebase Auth setup ---
        mAuth = FirebaseAuth.getInstance();
        mAuth.addAuthStateListener(firebaseAuth -> registerPushToken());
        if (android.os.Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 7001);
        }

        // Configure Google Sign-In
        GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestIdToken(getString(R.string.default_web_client_id)) // from google-services.json
                .requestEmail()
                .build();
        mGoogleSignInClient = GoogleSignIn.getClient(this, gso);

        // --- WebView setup ---
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setLoadWithOverviewMode(true);
        webSettings.setUseWideViewPort(true);
        webSettings.setUserAgentString(webSettings.getUserAgentString() + " Chrome/114.0.0.0");
        webSettings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        webSettings.setJavaScriptCanOpenWindowsAutomatically(true);

        // Keep DevTools-only warnings out of release builds.
        boolean isDebuggable = (getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        WebView.setWebContentsDebuggingEnabled(isDebuggable);

        // Add JavaScript interface (name = "Android")
        webView.addJavascriptInterface(new ChichiJSInterface(), "Android");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                if (progressBar != null) {
                    progressBar.setVisibility(View.VISIBLE);
                }
                pageLoaded = false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (progressBar != null) {
                    progressBar.setVisibility(View.GONE);
                }
                pageLoaded = true;
                timeoutHandler.removeCallbacks(timeoutRunnable);

                // If user is already signed in, pass user to WebView
                FirebaseUser currentUser = mAuth.getCurrentUser();
                if (currentUser != null) {
                    sendUserToWebView(currentUser);
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (progressBar != null) {
                    progressBar.setVisibility(View.GONE);
                }
                pageLoaded = true;
                timeoutHandler.removeCallbacks(timeoutRunnable);
                Toast.makeText(LauncherActivity.this,
                        "Failed to load page: " + error.getDescription(),
                        Toast.LENGTH_LONG).show();
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // Intercept any URL that starts with chichi:// (for redirect from Google)
                String url = request.getUrl().toString();
                if (url.startsWith("chichi://")) {
                    // Handle redirect if needed (not used in this approach)
                    return true;
                }
                return false;
            }
        });

        webView.setWebChromeClient(new WebChromeClient());
        webView.loadUrl("https://www.chichi.buzz");

        // Hide action bar
        if (getSupportActionBar() != null) {
            getSupportActionBar().hide();
        }

        // Immersive full-screen
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        );

        // Back button
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack();
                } else {
                    finish();
                }
            }
        });

        timeoutHandler.postDelayed(timeoutRunnable, 10000);
    }

    private void startGoogleSignIn() {
        Intent signInIntent = mGoogleSignInClient.getSignInIntent();
        startActivityForResult(signInIntent, RC_SIGN_IN);
    }

    private void registerPushToken() {
        FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token -> {
            FirebaseUser user = mAuth.getCurrentUser();
            if (user != null) {
                com.google.firebase.database.FirebaseDatabase.getInstance()
                        .getReference("users").child(user.getUid()).child("fcmTokens").child(token).setValue(true);
            }
        });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == RC_SIGN_IN) {
            Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);
            try {
                GoogleSignInAccount account = task.getResult(ApiException.class);
                firebaseAuthWithGoogle(account.getIdToken());
            } catch (ApiException e) {
                String message = e.getStatusCode() == 10
                        ? "Google sign-in is not configured for this app. Please update the app or contact support."
                        : "Google sign-in failed: " + e.getMessage();
                Toast.makeText(this, message, Toast.LENGTH_LONG).show();
                // Inform WebView about failure
                webView.evaluateJavascript("app.googleSignInFailed('Google sign-in configuration error')", null);
            }
        }
    }

    private void firebaseAuthWithGoogle(String idToken) {
        AuthCredential credential = GoogleAuthProvider.getCredential(idToken, null);
        mAuth.signInWithCredential(credential)
                .addOnCompleteListener(this, task -> {
                    if (task.isSuccessful()) {
                        FirebaseUser user = mAuth.getCurrentUser();
                        registerPushToken();
                        sendUserToWebView(user);
                        Toast.makeText(this, "Signed in successfully", Toast.LENGTH_SHORT).show();
                    } else {
                        Toast.makeText(this, "Firebase sign-in failed", Toast.LENGTH_LONG).show();
                        webView.evaluateJavascript("app.googleSignInFailed('Firebase auth failed')", null);
                    }
                });
    }

    private void sendUserToWebView(FirebaseUser user) {
        try {
            JSONObject userJson = new JSONObject();
            userJson.put("uid", user.getUid());
            userJson.put("email", user.getEmail());
            userJson.put("displayName", user.getDisplayName());
            userJson.put("photoURL", user.getPhotoUrl() != null ? user.getPhotoUrl().toString() : "");
            userJson.put("idToken", user.getIdToken(false).getResult().getToken());

            String script = "app.onNativeSignIn(" + userJson.toString() + ");";
            webView.evaluateJavascript(script, null);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private final Handler timeoutHandler = new Handler();
    private final Runnable timeoutRunnable = new Runnable() {
        @Override
        public void run() {
            if (!pageLoaded && progressBar != null && progressBar.getVisibility() == View.VISIBLE) {
                Toast.makeText(LauncherActivity.this,
                        "Loading is taking too long. Check your internet connection.",
                        Toast.LENGTH_LONG).show();
            }
        }
    };

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            );
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        timeoutHandler.removeCallbacks(timeoutRunnable);
    }
}