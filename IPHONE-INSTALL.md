# iPhone Personal Install Guide

This app is ready to install as a private PWA. You do not need to publish it on the App Store.

## Best Option: Private Web App Icon

1. Upload this folder to any HTTPS host.
   Good simple choices: Netlify Drop, Vercel, Cloudflare Pages, or your own server with HTTPS.
2. Open the HTTPS URL in Safari on your iPhone.
3. Tap Share.
4. Tap Add to Home Screen.
5. Name it `AG Traders`, then tap Add.

After that it opens like an app from the iPhone home screen. The app shell and CSV are cached for offline use after the first successful load.

## Local Testing From This Mac

Run this in the project folder:

```bash
python3 -m http.server 8080
```

Then open this from another device on the same Wi-Fi:

```text
http://YOUR_MAC_IP:8080
```

Local HTTP is useful for testing the screen, but iPhone offline install behavior needs an HTTPS URL.

## Native iPhone App Option

If you want a real `.ipa` installed through Xcode instead of Safari Add to Home Screen, wrap this web app with Capacitor and sign it with your Apple ID. With a free Apple ID, the installed app usually expires after 7 days. With a paid Apple Developer account, you can install privately on your devices without App Store release.
