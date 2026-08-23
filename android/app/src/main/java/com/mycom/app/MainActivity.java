package com.mycom.app;
import android.app.*;import android.os.*;import android.webkit.*;import android.view.*;import android.content.*;import android.net.Uri;
public class MainActivity extends Activity{
 WebView webView; ValueCallback<Uri[]> upload; static final int PICK=1001; static final String HOME="https://mycom-v4.onrender.com/";
 @Override public void onCreate(Bundle b){super.onCreate(b);getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);webView=new WebView(this);setContentView(webView);WebSettings s=webView.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setDatabaseEnabled(true);s.setAllowFileAccess(true);s.setMediaPlaybackRequiresUserGesture(false);webView.setWebChromeClient(new WebChromeClient(){@Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> cb,FileChooserParams p){upload=cb;Intent i=p.createIntent();try{startActivityForResult(i,PICK);}catch(Exception e){upload=null;return false;}return true;}});webView.setWebViewClient(new WebViewClient(){@Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){return false;}});webView.loadUrl(HOME);}
 @Override protected void onActivityResult(int r,int c,Intent d){super.onActivityResult(r,c,d);if(r==PICK&&upload!=null){Uri[] u=WebChromeClient.FileChooserParams.parseResult(c,d);upload.onReceiveValue(u);upload=null;}}
 @Override public void onBackPressed(){if(webView.canGoBack())webView.goBack();else super.onBackPressed();}
}
