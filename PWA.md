# Taza Bishkek app

Taza Bishkek is an installable web app (PWA) served from the existing GitHub Pages project. `install.html` and Settings → Install app provide the installation entry point and device instructions. It is not an APK or an App Store release.

- The manifest starts at `home.html?source=app`, opens in a standalone window, and stays inside the repository URL scope.
- The existing Supabase accounts, reports, photo uploads and moderation remain online features.
- The service worker stores only `offline.html`. It never caches API responses, accounts, report data, images, authentication redirects or write requests. Offline navigation displays a reconnect page; it does not queue submissions or claim to have sent a report.
- Installation prompts depend on the browser. When a browser does not expose a native prompt, the install page shows manual instructions. Test actual installation on the target Android/iOS device before a store launch.
- The app uses the existing Russian/Kyrgyz preference and reduced-motion setting. The offline page reads the same language preference.
- Keep `sw.js` at the repository root. Increment the offline cache version when modifying the offline page. Cache deletion is restricted to this app's cache prefix, so other GitHub Pages projects are unaffected.

Validation: `node scripts/check-pwa.mjs`. Icons can be regenerated with `python3 scripts/generate-app-icons.py` (Pillow required).
