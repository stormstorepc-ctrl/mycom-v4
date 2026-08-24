package com.mycom.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.core.content.FileProvider;

import java.io.File;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class MainActivity extends Activity {
    private WebView webView;
    private static final String HOME = "https://mycom-v4.onrender.com/";
    private static final int REQ_FILE_CHOOSER = 5173;
    private static final int REQ_CAMERA_PERMISSION = 5174;

    private ValueCallback<Uri[]> filePathCallback;
    private String cameraPhotoPath;
    private Intent pendingChooserIntent;

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
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                filePathCallback = callback;

                Intent contentIntent = new Intent(Intent.ACTION_GET_CONTENT);
                contentIntent.addCategory(Intent.CATEGORY_OPENABLE);
                contentIntent.setType("image/*");

                Intent chooser = Intent.createChooser(contentIntent, "사진 선택");

                Intent cameraIntent = createCameraIntent();
                if (cameraIntent != null) {
                    chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{cameraIntent});
                }

                if (hasCameraPermission()) {
                    launchChooser(chooser);
                } else {
                    // 카메라 권한이 없으면 먼저 요청하고, 결과와 무관하게 파일 선택창은 띄운다
                    // (권한을 거부해도 갤러리에서 사진 선택은 계속 가능해야 하므로)
                    pendingChooserIntent = chooser;
                    requestPermissions(new String[]{Manifest.permission.CAMERA}, REQ_CAMERA_PERMISSION);
                }
                return true;
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false;
            }
        });
        webView.loadUrl(HOME);
    }

    private boolean hasCameraPermission() {
        return checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
    }

    private Intent createCameraIntent() {
        try {
            Intent takePictureIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            if (takePictureIntent.resolveActivity(getPackageManager()) == null) return null;

            File photoFile = createImageFile();
            if (photoFile == null) return null;
            cameraPhotoPath = photoFile.getAbsolutePath();

            Uri photoUri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", photoFile);
            takePictureIntent.putExtra(MediaStore.EXTRA_OUTPUT, photoUri);
            takePictureIntent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            return takePictureIntent;
        } catch (Exception e) {
            return null;
        }
    }

    private File createImageFile() {
        try {
            String timeStamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.KOREA).format(new Date());
            File storageDir = getExternalFilesDir(Environment.DIRECTORY_PICTURES);
            if (storageDir != null && !storageDir.exists()) storageDir.mkdirs();
            return File.createTempFile("MYCOM_" + timeStamp, ".jpg", storageDir);
        } catch (IOException e) {
            return null;
        }
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_CAMERA_PERMISSION && pendingChooserIntent != null) {
            Intent chooser = pendingChooserIntent;
            pendingChooserIntent = null;
            // 권한을 거부했더라도(카메라 촬영만 못 함) 갤러리 선택은 그대로 진행
            if (grantResults.length == 0 || grantResults[0] != PackageManager.PERMISSION_GRANTED) {
                Intent contentOnly = new Intent(Intent.ACTION_GET_CONTENT);
                contentOnly.addCategory(Intent.CATEGORY_OPENABLE);
                contentOnly.setType("image/*");
                chooser = Intent.createChooser(contentOnly, "사진 선택");
            }
            launchChooser(chooser);
        }
    }

    private void launchChooser(Intent chooser) {
        try {
            startActivityForResult(chooser, REQ_FILE_CHOOSER);
        } catch (Exception e) {
            if (filePathCallback != null) {
                filePathCallback.onReceiveValue(null);
                filePathCallback = null;
            }
        }
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != REQ_FILE_CHOOSER) {
            super.onActivityResult(requestCode, resultCode, data);
            return;
        }
        if (filePathCallback == null) return;

        Uri[] results = null;
        if (resultCode == Activity.RESULT_OK) {
            if (data != null && data.getDataString() != null) {
                // 갤러리 등에서 사진을 선택한 경우
                results = new Uri[]{Uri.parse(data.getDataString())};
            } else if (data != null && data.getClipData() != null) {
                int count = data.getClipData().getItemCount();
                List<Uri> uris = new ArrayList<>();
                for (int i = 0; i < count; i++) uris.add(data.getClipData().getItemAt(i).getUri());
                results = uris.toArray(new Uri[0]);
            } else if (cameraPhotoPath != null) {
                // 카메라로 직접 촬영한 경우
                File file = new File(cameraPhotoPath);
                if (file.exists()) {
                    results = new Uri[]{FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", file)};
                }
            }
        }

        filePathCallback.onReceiveValue(results);
        filePathCallback = null;
        cameraPhotoPath = null;
    }

    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack(); else super.onBackPressed();
    }
}
