TRANLOAD LOG PWA

Files:
- index.html
- manifest.webmanifest
- sw.js
- apple-touch-icon.png

DEPLOYMENT:
Upload all four files to the same folder on any HTTPS web host. The app does not require a database or server-side code for its current local version. Saved outgoing loads can be edited or deleted from the Recent Loads list.

IMPORTANT:
Records are stored in the browser on the iPhone using localStorage. They persist on that device/browser, but they are NOT automatically shared between phones or computers.

iPHONE INSTALL:
1. Open the deployed HTTPS URL in Safari.
2. Tap Share.
3. Tap Add to Home Screen.
4. Keep "Open as Web App" enabled.
5. Tap Add.

The resulting icon opens the app in standalone mode. Apple documents these current steps here:
https://support.apple.com/en-ph/guide/iphone/iphea86e5236/ios

QUICK INCOMING TRUCKS:
The first time an incoming truck number and driver are entered, the pair is saved as a Quick Incoming Truck button. Tapping that button immediately logs the truck/driver with the current time. If the same truck number is entered later with a different driver, its quick button is updated.
