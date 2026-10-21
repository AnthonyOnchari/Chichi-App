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
import android.webkit.PermissionRequest;
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
import com.google.firebase.auth.PhoneAuthCredential;
import com.google.firebase.auth.FirebaseAuthSettings;
import com.google.firebase.auth.PhoneAuthOptions;
import com.google.firebase.auth.PhoneAuthProvider;
import com.google.firebase.FirebaseException;
import com.google.firebase.messaging.FirebaseMessaging;

import org.json.JSONObject;

import java.util.concurrent.TimeUnit;

public class LauncherActivity extends AppCompatActivity {

    private static volatile LauncherActivity activeActivity;
    private WebView webView;
    private ProgressBar progressBar;
    private boolean pageLoaded = false;
    private static final int RC_SIGN_IN = 9001;

    // Firebase Auth
    private FirebaseAuth mAuth;
    private GoogleSignInClient mGoogleSignInClient;
    private PermissionRequest pendingWebPermissionRequest;
    private String mVerificationId;
    private PhoneAuthProvider.ForceResendingToken mResendToken;
    private PhoneAuthProvider.OnVerificationStateChangedCallbacks mPhoneAuthCallbacks;
    private String mPendingPhoneNumber;
    private boolean mUsingTestPhoneAuth;

    // JavaScript interface for communicating with WebView
    private class ChichiJSInterface {
        @android.webkit.JavascriptInterface
        public void signInWithGoogle() {
            // Called from JavaScript when user clicks "Sign in with Google"
            startGoogleSignIn();
        }

        @android.webkit.JavascriptInterface
        public void sendPhoneOtp(String phoneNumber) {
            runOnUiThread(() -> startPhoneVerification(phoneNumber));
        }

        @android.webkit.JavascriptInterface
        public void verifyPhoneOtp(String code) {
            runOnUiThread(() -> verifyPhoneCode(code));
        }

        @android.webkit.JavascriptInterface
        public void enableNotifications() {
            runOnUiThread(() -> {
                if (android.os.Build.VERSION.SDK_INT >= 33
                        && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 7001);
                    return;
                }
                if (!areSystemNotificationsEnabled()) {
                    openNotificationSettings();
                    notifyWebNotificationPermission(false);
                    return;
                }
                registerPushToken();
                notifyWebNotificationPermission(true);
            });
        }

        @android.webkit.JavascriptInterface
        public boolean areNotificationsEnabled() {
            return areSystemNotificationsEnabled();
        }

        @android.webkit.JavascriptInterface
        public void openNotificationSettings() {
            runOnUiThread(() -> {
                Intent settingsIntent;
                if (android.os.Build.VERSION.SDK_INT >= 26) {
                    settingsIntent = new Intent("android.settings.APP_NOTIFICATION_SETTINGS")
                            .putExtra("android.provider.extra.APP_PACKAGE", getPackageName());
                } else {
                    settingsIntent = new Intent("android.settings.APPLICATION_DETAILS_SETTINGS",
                            Uri.parse("package:" + getPackageName()));
                }
                startActivity(settingsIntent);
            });
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
        activeActivity = this;
        setContentView(R.layout.activity_main);

        ChichiMessagingService.ensureNotificationChannel(this);
        webView = findViewById(R.id.webView);
        progressBar = findViewById(R.id.progressBar);

        // --- Firebase Auth setup ---
        mAuth = FirebaseAuth.getInstance();
        mAuth.addAuthStateListener(firebaseAuth -> registerPushToken());
        mPhoneAuthCallbacks = new PhoneAuthProvider.OnVerificationStateChangedCallbacks() {
            @Override
            public void onVerificationCompleted(@NonNull PhoneAuthCredential credential) {
                signInWithPhoneCredential(credential);
            }

            @Override
            public void onVerificationFailed(@NonNull FirebaseException e) {
                String reason = e.getMessage() != null ? e.getMessage() : "Phone verification failed";
                Toast.makeText(LauncherActivity.this, reason, Toast.LENGTH_LONG).show();
                notifyWebPhoneAuthFailed(reason);
            }

            @Override
            public void onCodeSent(@NonNull String verificationId,
                                   @NonNull PhoneAuthProvider.ForceResendingToken token) {
                mVerificationId = verificationId;
                mResendToken = token;
                webView.evaluateJavascript("if(window.app && app.onNativePhoneCodeSent){app.onNativePhoneCodeSent();}", null);
            }

            @Override
            public void onCodeAutoRetrievalTimeOut(@NonNull String verificationId) {
                mVerificationId = verificationId;
            }
        };
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
                registerPushToken();
                if (currentUser != null) {
                    boolean hasGoogleProvider = false;
                    for (com.google.firebase.auth.UserInfo provider : currentUser.getProviderData()) {
                        hasGoogleProvider |= "google.com".equals(provider.getProviderId());
                    }
                    if (hasGoogleProvider) {
                        mGoogleSignInClient.silentSignIn().addOnSuccessListener(account ->
                                sendUserToWebView(currentUser, account.getIdToken()));
                    } else {
                        sendUserToWebView(currentUser);
                    }
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

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    pendingWebPermissionRequest = request;
                    boolean needsAudio = false;
                    boolean needsCamera = false;
                    for (String resource : request.getResources()) {
                        needsAudio |= PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource);
                        needsCamera |= PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource);
                    }
                    if ((needsAudio && checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED)
                            || (needsCamera && checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED)) {
                        requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO, Manifest.permission.CAMERA}, 7002);
                    } else {
                        request.grant(request.getResources());
                    }
                });
            }
        });
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
        mGoogleSignInClient.signOut().addOnCompleteListener(this, task -> {
            if (!task.isSuccessful()) {
                String reason = task.getException() != null
                        ? task.getException().getMessage()
                        : "Could not open Google account selection";
                Toast.makeText(this, reason, Toast.LENGTH_LONG).show();
                webView.evaluateJavascript(
                        "if(window.app){app.googleSignInFailed(" + JSONObject.quote(reason) + ");}",
                        null
                );
                return;
            }
            Intent signInIntent = mGoogleSignInClient.getSignInIntent();
            startActivityForResult(signInIntent, RC_SIGN_IN);
        });
    }

    private void startPhoneVerification(String phoneNumber) {
        if (phoneNumber == null || phoneNumber.trim().isEmpty()) {
            notifyWebPhoneAuthFailed("Phone number is required");
            return;
        }

        mPendingPhoneNumber = phoneNumber.trim();
        mUsingTestPhoneAuth = "+254701807001".equals(mPendingPhoneNumber);

        FirebaseAuthSettings authSettings = mAuth.getFirebaseAuthSettings();
        if (mUsingTestPhoneAuth) {
            authSettings.setAppVerificationDisabledForTesting(true);
            authSettings.setAutoRetrievedSmsCodeForPhoneNumber(mPendingPhoneNumber, "661122");
        }

        PhoneAuthOptions options = PhoneAuthOptions.newBuilder(mAuth)
                .setPhoneNumber(mPendingPhoneNumber)
                .setTimeout(60L, TimeUnit.SECONDS)
                .setActivity(this)
                .setCallbacks(mPhoneAuthCallbacks)
                .build();
        PhoneAuthProvider.verifyPhoneNumber(options);
    }

    private void verifyPhoneCode(String code) {
        if (mVerificationId == null || mVerificationId.isEmpty()) {
            notifyWebPhoneAuthFailed("Please request a verification code first");
            return;
        }
        if (code == null || code.trim().isEmpty()) {
            notifyWebPhoneAuthFailed("Enter the verification code");
            return;
        }

        PhoneAuthCredential credential = PhoneAuthProvider.getCredential(mVerificationId, code.trim());
        signInWithPhoneCredential(credential);
    }

    private void registerPushToken() {
        FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token -> {
            FirebaseUser user = mAuth.getCurrentUser();
            if (user != null) {
                com.google.firebase.database.FirebaseDatabase.getInstance()
                        .getReference("users").child(user.getUid()).child("fcmTokens").child(token).setValue(true)
                        .addOnFailureListener(error -> android.util.Log.e("CHICHI_PUSH", "Could not save native push token", error));
            }
            sendPushTokenToWebView(token);
        }).addOnFailureListener(error -> notifyWebPushTokenRegistration(false, error.getMessage()));
    }

    static void refreshWebPushToken(String token) {
        LauncherActivity activity = activeActivity;
        if (activity != null) activity.sendPushTokenToWebView(token);
    }

    private void sendPushTokenToWebView(String token) {
        if (!pageLoaded || webView == null || token == null || token.isEmpty()) return;
        String safeToken = JSONObject.quote(token);
        runOnUiThread(() -> webView.evaluateJavascript(
                "if(window.app&&typeof app.registerNativePushToken==='function'){app.registerNativePushToken(" + safeToken + ").then(function(saved){if(app.onNativePushTokenRegistration){app.onNativePushTokenRegistration(saved,null);}}).catch(function(error){if(app.onNativePushTokenRegistration){app.onNativePushTokenRegistration(false,error.message);}});}",
                null
        ));
    }

    private void notifyWebPushTokenRegistration(boolean saved, String errorMessage) {
        if (webView == null) return;
        String safeError = JSONObject.quote(errorMessage == null ? "Unable to retrieve Firebase notification token." : errorMessage);
        runOnUiThread(() -> webView.evaluateJavascript(
                "if(window.app&&app.onNativePushTokenRegistration){app.onNativePushTokenRegistration(" + saved + "," + safeError + ");}",
                null
        ));
    }

    private boolean areSystemNotificationsEnabled() {
        if (android.os.Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return false;
        }
        if (!androidx.core.app.NotificationManagerCompat.from(this).areNotificationsEnabled()) return false;
        if (android.os.Build.VERSION.SDK_INT >= 26) {
            android.app.NotificationChannel channel = getSystemService(android.app.NotificationManager.class)
                    .getNotificationChannel(ChichiMessagingService.CHANNEL_ID);
            return channel != null && channel.getImportance() != android.app.NotificationManager.IMPORTANCE_NONE;
        }
        return true;
    }

    private void notifyWebNotificationPermission(boolean granted) {
        if (webView == null) return;
        runOnUiThread(() -> webView.evaluateJavascript(
                "if(window.app&&typeof app.onNativeNotificationsPermission==='function'){app.onNativeNotificationsPermission(" + (granted && areSystemNotificationsEnabled()) + ");}",
                null
        ));
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null && pageLoaded) {
            boolean enabled = areSystemNotificationsEnabled();
            runOnUiThread(() -> webView.evaluateJavascript(
                    "if(window.app&&app.onNativeNotificationAvailabilityChanged){app.onNativeNotificationAvailabilityChanged(" + enabled + ");}",
                    null
            ));
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == 7001) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED
                    && areSystemNotificationsEnabled();
            if (granted) registerPushToken();
            notifyWebNotificationPermission(granted);
            return;
        }
        if (requestCode == 7002 && pendingWebPermissionRequest != null) {
            boolean granted = grantResults.length > 0;
            for (int result : grantResults) granted &= result == PackageManager.PERMISSION_GRANTED;
            if (granted) pendingWebPermissionRequest.grant(pendingWebPermissionRequest.getResources());
            else pendingWebPermissionRequest.deny();
            pendingWebPermissionRequest = null;
        }
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
                // Inform WebView about failure and force web fallback for this session.
                if (e.getStatusCode() == 10) {
                    webView.evaluateJavascript(
                            "if (window.app) { app.googleSignInFailed('Google sign-in configuration error (code 10)'); if (typeof app.signInWithGoogle === 'function') { app.signInWithGoogle(true); } }",
                            null
                    );
                } else {
                    webView.evaluateJavascript("app.googleSignInFailed('Google sign-in failed: " + e.getStatusCode() + "')", null);
                }
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
                        sendUserToWebView(user, idToken);
                        Toast.makeText(this, "Signed in successfully", Toast.LENGTH_SHORT).show();
                    } else {
                        Toast.makeText(this, "Firebase sign-in failed", Toast.LENGTH_LONG).show();
                        webView.evaluateJavascript("app.googleSignInFailed('Firebase auth failed')", null);
                    }
                });
    }

    private void sendUserToWebView(FirebaseUser user) {
        sendUserToWebView(user, null);
    }

    private void sendUserToWebView(FirebaseUser user, String googleIdToken) {
        try {
            JSONObject userJson = new JSONObject();
            userJson.put("uid", user.getUid());
            userJson.put("email", user.getEmail());
            userJson.put("displayName", user.getDisplayName());
            userJson.put("photoURL", user.getPhotoUrl() != null ? user.getPhotoUrl().toString() : "");
            userJson.put("idToken", user.getIdToken(false).getResult().getToken());
            if (googleIdToken != null && !googleIdToken.isEmpty()) {
                userJson.put("googleIdToken", googleIdToken);
            }

            String script = "app.onNativeSignIn(" + userJson.toString() + ");";
            webView.evaluateJavascript(script, null);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void signInWithPhoneCredential(PhoneAuthCredential credential) {
        mAuth.signInWithCredential(credential)
                .addOnCompleteListener(this, task -> {
                    if (task.isSuccessful()) {
                        FirebaseUser user = mAuth.getCurrentUser();
                        registerPushToken();
                        if (user != null) {
                            sendUserToWebView(user);
                        }
                        Toast.makeText(this, "Phone sign-in successful", Toast.LENGTH_SHORT).show();
                        mUsingTestPhoneAuth = false;
                    } else {
                        String reason = task.getException() != null && task.getException().getMessage() != null
                                ? task.getException().getMessage()
                                : "Phone sign-in failed";
                        Toast.makeText(this, reason, Toast.LENGTH_LONG).show();
                        notifyWebPhoneAuthFailed(reason);
                    }
                });
    }

    private void notifyWebPhoneAuthFailed(String message) {
        String safeMessage = JSONObject.quote(message == null ? "Phone verification failed" : message);
        webView.evaluateJavascript("if(window.app && app.phoneAuthFailed){app.phoneAuthFailed(" + safeMessage + ");}", null);
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
        if (activeActivity == this) activeActivity = null;
    }
}