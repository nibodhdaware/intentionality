import "./lib/firebase";
import "./lib/firebase-auth";
import "./lib/firebase-firestore";

const firebaseConfig = {
    apiKey: "AIzaSyCepAVjbZsx0z-M0sTvgp48AAt4bYBSq-U",
    authDomain: "intentionality-1ce65.firebaseapp.com",
    projectId: "intentionality-1ce65",
    storageBucket: "intentionality-1ce65.firebasestorage.app",
    messagingSenderId: "938266027514",
    appId: "1:938266027514:web:747ac62f30207ef05d3043",
    measurementId: "G-1891HVELCR",
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

let startTime;

document.addEventListener("DOMContentLoaded", function () {
    startTime = new Date(); // Record the time when the page loads

    const reasonInput = document.getElementById("reasonInput");
    const dumbReasonDropdown = document.getElementById("dumbReasonDropdown");
    const proceedButton = document.getElementById("proceedButton");
    const cancelButton = document.getElementById("cancelButton");
    const loginContainer = document.getElementById("loginContainer");
    const mainUI = document.getElementById("mainUI");
    const loginWithGoogleButton = document.getElementById(
        "loginWithGoogleButton",
    );

    // Hide both initially
    loginContainer.style.display = "none";
    mainUI.style.display = "none";

    firebase.auth().onAuthStateChanged(function (user) {
        if (user) {
            // User is signed in
            loginContainer.style.display = "none";
            mainUI.style.display = "block";
        } else {
            // No user is signed in
            loginContainer.style.display = "block";
            mainUI.style.display = "none";
        }
    });

    if (loginWithGoogleButton) {
        loginWithGoogleButton.addEventListener("click", function () {
            const provider = new firebase.auth.GoogleAuthProvider();
            firebase
                .auth()
                .signInWithRedirect(provider)
                .catch(function (error) {
                    alert("Google sign-in failed: " + error.message);
                });
        });
    }

    // Get the original URL and tabId from the query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const originalUrl = urlParams.get("url");
    const originalTabId = parseInt(urlParams.get("tabId")); // Get tabId as integer

    proceedButton.addEventListener("click", function () {
        const reason = reasonInput.value.trim();
        const dumbReason = dumbReasonDropdown.value;

        // You can send this data to background.js or store it if needed
        console.log("Reason:", reason);
        console.log("Dumb Reason:", dumbReason);

        // Store the data
        chrome.storage.sync.get(["activityLog"], function (result) {
            const activityLog = result.activityLog || [];
            const timestamp = new Date().toISOString();

            let sessionDuration = null;
            if (dumbReason === "procrastination" && startTime) {
                const endTime = new Date();
                sessionDuration =
                    (endTime.getTime() - startTime.getTime()) / 1000; // Duration in seconds
            }

            activityLog.push({
                url: originalUrl,
                reason,
                dumbReason,
                timestamp,
                sessionDuration,
            });
            // Add the activity to Firestore
            db.collection("activities")
                .add({
                    url: originalUrl,
                    reason,
                    dumbReason,
                    timestamp,
                    sessionDuration,
                })
                .then(() => {
                    console.log("Activity logged to Firestore:", {
                        url: originalUrl,
                        reason,
                        dumbReason,
                        timestamp,
                        sessionDuration,
                    });

                    // Send message to background.js to proceed with the original tabId
                    if (originalTabId && originalUrl) {
                        // Disable the proceed button to prevent multiple clicks
                        proceedButton.disabled = true;

                        chrome.runtime.sendMessage(
                            {
                                action: "proceedToUrl",
                                url: originalUrl,
                                tabId: originalTabId,
                            },
                            function (response) {
                                if (response && response.status === "success") {
                                    // Wait a bit longer to ensure navigation is complete
                                    setTimeout(() => {
                                        window.close();
                                    }, 1000);
                                } else {
                                    console.error(
                                        "Failed to proceed to URL:",
                                        response,
                                    );
                                    proceedButton.disabled = false; // Re-enable button on error
                                }
                            },
                        );
                    } else {
                        console.error(
                            "Missing originalTabId or originalUrl to proceed. Closing prompt.",
                        );
                        window.close(); // Close the prompt page if critical info is missing
                    }
                })
                .catch((error) => {
                    console.error("Error adding activity to Firestore:", error);
                    proceedButton.disabled = false; // Re-enable button on error
                });
        });
    });

    cancelButton.addEventListener("click", function () {
        // Go back in history or close the current tab
        window.close(); // Close the prompt page
    });

    // After DOMContentLoaded, handle redirect result
    firebase
        .auth()
        .getRedirectResult()
        .then(function (result) {
            // User is signed in if result.user exists
            // (No-op here, as onAuthStateChanged will handle UI)
        })
        .catch(function (error) {
            if (error && error.message) {
                alert("Google sign-in failed: " + error.message);
            }
        });
});
