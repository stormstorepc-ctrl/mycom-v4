package com.mycom.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.Settings;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.core.content.FileProvider;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private WebView webView;
    private static final String HOME = "https://mycom-v4.onrender.com/";
    private static final String UPDATE_MANIFEST = "https://raw.githubusercontent.com/stormstorepc-ctrl/mycom-v4/main/update.json";
    private static final int REQ_FILE_CHOOSER = 5173;
    private static final int REQ_CAMERA_PERMISSION = 5174;

    private ValueCallback<Uri[]> filePathCallback;
    private String cameraPhotoPath;
    private Intent pendingChooserIntent;
    private File pendingInstallFile;
    private final ExecutorService updateExecutor = Executors.newSingleThreadExecutor();

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        webView = new WebView(this);
        setContentView(webView);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        // APK가 오래된 WebView 캐시를 사용하지 않고 항상 최신 MYCOM 웹앱을 불러오도록 한다.
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        webView.clearCache(true);
        webView.clearHistory();

        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                filePathCallback = callback;
                Intent contentIntent = new Intent(Intent.ACTION_GET_CONTENT);
                contentIntent.addCategory(Intent.CATEGORY_OPENABLE);
                contentIntent.setType("image/*");
                contentIntent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                Intent chooser = Intent.createChooser(contentIntent, "사진 선택");
                Intent cameraIntent = createCameraIntent();
                if (cameraIntent != null) chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{cameraIntent});
                if (hasCameraPermission()) launchChooser(chooser);
                else { pendingChooserIntent = chooser; requestPermissions(new String[]{Manifest.permission.CAMERA}, REQ_CAMERA_PERMISSION); }
                return true;
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return false; }
        });
        webView.loadUrl(HOME + "?apk=4.0.3&t=" + System.currentTimeMillis());
        checkForUpdates();
    }

    private boolean hasCameraPermission() { return checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED; }

    private Intent createCameraIntent() {
        try {
            Intent takePictureIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            if (takePictureIntent.resolveActivity(getPackageManager()) == null) return null;
            File photoFile = createImageFile();
            if (photoFile == null) return null;
            cameraPhotoPath = photoFile.getAbsolutePath();
            Uri photoUri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", photoFile);
            takePictureIntent.putExtra(MediaStore.EXTRA_OUTPUT, photoUri);
            takePictureIntent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            return takePictureIntent;
        } catch (Exception e) { return null; }
    }

    private File createImageFile() {
        try {
            String timeStamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.KOREA).format(new Date());
            File storageDir = getExternalFilesDir(Environment.DIRECTORY_PICTURES);
            if (storageDir != null && !storageDir.exists()) storageDir.mkdirs();
            return File.createTempFile("MYCOM_" + timeStamp, ".jpg", storageDir);
        } catch (IOException e) { return null; }
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_CAMERA_PERMISSION && pendingChooserIntent != null) {
            Intent chooser = pendingChooserIntent;
            pendingChooserIntent = null;
            if (grantResults.length == 0 || grantResults[0] != PackageManager.PERMISSION_GRANTED) {
                Intent contentOnly = new Intent(Intent.ACTION_GET_CONTENT);
                contentOnly.addCategory(Intent.CATEGORY_OPENABLE);
                contentOnly.setType("image/*");
                contentOnly.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                chooser = Intent.createChooser(contentOnly, "사진 선택");
            }
            launchChooser(chooser);
        }
    }

    private void launchChooser(Intent chooser) {
        try { startActivityForResult(chooser, REQ_FILE_CHOOSER); }
        catch (Exception e) { if (filePathCallback != null) { filePathCallback.onReceiveValue(null); filePathCallback = null; } }
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != REQ_FILE_CHOOSER) { super.onActivityResult(requestCode, resultCode, data); return; }
        if (filePathCallback == null) return;
        Uri[] results = null;
        if (resultCode == Activity.RESULT_OK) {
            if (data != null && data.getClipData() != null) {
                int count = data.getClipData().getItemCount();
                List<Uri> uris = new ArrayList<>();
                for (int i = 0; i < count; i++) uris.add(data.getClipData().getItemAt(i).getUri());
                results = uris.toArray(new Uri[0]);
            } else if (data != null && data.getData() != null) results = new Uri[]{data.getData()};
            else if (cameraPhotoPath != null) {
                File file = new File(cameraPhotoPath);
                if (file.exists()) results = new Uri[]{FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", file)};
            }
        }
        filePathCallback.onReceiveValue(results);
        filePathCallback = null;
        cameraPhotoPath = null;
    }

    private void checkForUpdates() {
        updateExecutor.execute(() -> {
            HttpURLConnection conn = null;
            try {
                URL url = new URL(UPDATE_MANIFEST + "?t=" + System.currentTimeMillis());
                conn = (HttpURLConnection) url.openConnection();
                conn.setConnectTimeout(8000); conn.setReadTimeout(10000); conn.setRequestMethod("GET"); conn.setUseCaches(false);
                if (conn.getResponseCode() != HttpURLConnection.HTTP_OK) return;
                try (InputStream in = conn.getInputStream()) {
                    StringBuilder sb = new StringBuilder(); byte[] buffer = new byte[4096]; int n;
                    while ((n = in.read(buffer)) != -1) sb.append(new String(buffer, 0, n, "UTF-8"));
                    JSONObject info = new JSONObject(sb.toString());
                    int latestCode = info.optInt("versionCode", BuildConfig.VERSION_CODE);
                    String latestName = info.optString("versionName", "");
                    String apkUrl = info.optString("apkUrl", "");
                    boolean mandatory = info.optBoolean("mandatory", false);
                    String message = info.optString("message", "새로운 MYCOM 업데이트가 있습니다.");
                    if (latestCode > BuildConfig.VERSION_CODE && !apkUrl.isEmpty()) runOnUiThread(() -> showUpdateDialog(latestName, apkUrl, mandatory, message));
                }
            } catch (Exception ignored) {} finally { if (conn != null) conn.disconnect(); }
        });
    }

    private void showUpdateDialog(String version, String apkUrl, boolean mandatory, String message) {
        if (isFinishing()) return;
        AlertDialog.Builder builder = new AlertDialog.Builder(this).setTitle("MYCOM 업데이트 " + version)
                .setMessage(message + "\n\n최신 버전을 다운로드하시겠습니까?");
        if (!mandatory) builder.setNegativeButton("나중에", null);
        builder.setPositiveButton("업데이트", (dialog, which) -> downloadUpdate(apkUrl));
        builder.setCancelable(!mandatory); builder.show();
    }

    private void downloadUpdate(String apkUrl) {
        AlertDialog progress = new AlertDialog.Builder(this).setTitle("MYCOM 업데이트")
                .setMessage("최신 버전을 다운로드하고 있습니다...\n잠시만 기다려 주세요.").setCancelable(false).create();
        progress.show();
        updateExecutor.execute(() -> {
            File apkFile = null; HttpURLConnection conn = null;
            try {
                URL url = new URL(apkUrl); conn = (HttpURLConnection) url.openConnection();
                conn.setConnectTimeout(15000); conn.setReadTimeout(60000); conn.setInstanceFollowRedirects(true); conn.connect();
                if (conn.getResponseCode() != HttpURLConnection.HTTP_OK) throw new IOException("HTTP " + conn.getResponseCode());
                File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                if (dir == null) throw new IOException("저장 공간을 사용할 수 없습니다.");
                if (!dir.exists()) dir.mkdirs(); apkFile = new File(dir, "MYCOM-update.apk");
                try (InputStream in = conn.getInputStream(); FileOutputStream out = new FileOutputStream(apkFile)) {
                    byte[] buffer = new byte[8192]; int n; while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
                }
                File finalApk = apkFile;
                runOnUiThread(() -> { progress.dismiss(); pendingInstallFile = finalApk; installDownloadedApk(finalApk); });
            } catch (Exception e) {
                if (apkFile != null && apkFile.exists()) apkFile.delete();
                runOnUiThread(() -> { progress.dismiss(); new AlertDialog.Builder(this).setTitle("업데이트 실패")
                        .setMessage("업데이트 파일을 다운로드하지 못했습니다. 인터넷 연결을 확인한 후 다시 시도해 주세요.")
                        .setPositiveButton("확인", null).show(); });
            } finally { if (conn != null) conn.disconnect(); }
        });
    }

    private void installDownloadedApk(File apkFile) {
        if (apkFile == null || !apkFile.exists()) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getPackageManager().canRequestPackageInstalls()) {
            new AlertDialog.Builder(this).setTitle("업데이트 권한 필요")
                    .setMessage("MYCOM이 다운로드한 업데이트를 설치하려면 '알 수 없는 앱 설치' 권한을 한 번 허용해야 합니다.")
                    .setPositiveButton("권한 설정", (d, w) -> startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName()))))
                    .setNegativeButton("취소", null).show(); return;
        }
        try {
            Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", apkFile);
            Intent install = new Intent(Intent.ACTION_VIEW); install.setDataAndType(uri, "application/vnd.android.package-archive");
            install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK); startActivity(install);
        } catch (Exception e) {
            new AlertDialog.Builder(this).setTitle("업데이트 설치 실패").setMessage("다운로드는 완료됐지만 Android 설치 화면을 열 수 없습니다.")
                    .setPositiveButton("확인", null).show();
        }
    }

    @Override protected void onResume() {
        super.onResume();
        if (pendingInstallFile != null && pendingInstallFile.exists() && (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || getPackageManager().canRequestPackageInstalls())) {
            File apk = pendingInstallFile; pendingInstallFile = null; installDownloadedApk(apk);
        }
    }

    @Override protected void onDestroy() { updateExecutor.shutdownNow(); if (webView != null) webView.destroy(); super.onDestroy(); }
    @Override public void onBackPressed() { if (webView != null && webView.canGoBack()) webView.goBack(); else super.onBackPressed(); }
}
