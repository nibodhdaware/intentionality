# Intentionality Chrome Extension

A Chrome extension that helps you stay focused by blocking distracting websites.

## Features

-   Add websites to your block list
-   Automatic blocking of specified websites
-   Clean and intuitive user interface
-   Persistent storage of blocked sites
-   Easy management of blocked websites

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the directory containing the extension files

## Usage

1. Click the Intentionality icon in your Chrome toolbar to open the popup
2. Enter a website domain (e.g., "facebook.com") in the input field
3. Click "Add to Block List" or press Enter to add the website
4. The website will now be blocked when you try to access it
5. To remove a website from the block list, click the "Remove" button next to it

## Files Structure

-   `manifest.json` - Extension configuration
-   `popup.html` - Main popup interface
-   `popup.js` - Popup functionality
-   `background.js` - Background script for blocking websites
-   `blocked.html` - Page shown when accessing blocked websites

## Note

You'll need to add icon files in the `icons` directory:

-   icon16.png (16x16)
-   icon48.png (48x48)
-   icon128.png (128x128)

## License

MIT License
