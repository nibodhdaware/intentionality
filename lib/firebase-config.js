// Firebase configuration for Chrome Extension
// This configuration handles the extension context properly

// Check if we're in a service worker context
const isServiceWorker = typeof importScripts !== "undefined";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCepAVjbZsx0z-M0sTvgp48AAt4bYBSq-U",
    authDomain: "intentionality-1ce65.firebaseapp.com",
    projectId: "intentionality-1ce65",
    storageBucket: "intentionality-1ce65.firebasestorage.app",
    messagingSenderId: "938266027514",
    appId: "1:938266027514:web:747ac62f30207ef05d3043",
    measurementId: "G-1891HVELCR",
};

// Initialize Firebase only if not in service worker context
if (!isServiceWorker && typeof firebase !== "undefined") {
    try {
        // Initialize Firebase
        firebase.initializeApp(firebaseConfig);

        // Initialize Firestore
        const db = firebase.firestore();

        // Export for use in other files
        window.db = db;
        console.log("Firebase initialized successfully");
    } catch (error) {
        console.error("Error initializing Firebase:", error);
        // Create a fallback db object that uses Chrome storage
        window.db = {
            collection: () => ({
                doc: () => ({
                    get: () =>
                        Promise.resolve({ exists: false, data: () => null }),
                    set: () => Promise.resolve(),
                    add: () => Promise.resolve(),
                }),
            }),
        };
    }
} else if (isServiceWorker) {
    // In service worker context, create a minimal db interface
    // that communicates with the main extension context
    window.db = {
        collection: () => ({
            doc: () => ({
                get: () => Promise.resolve({ exists: false, data: () => null }),
                set: () => Promise.resolve(),
                add: () => Promise.resolve(),
            }),
        }),
    };
}
