console.log('Content script loaded and listening for messages');

// Listen for messages from the webpage
window.addEventListener("message", function (event) {
    console.log('Content script received message:', event.data, 'from origin:', event.origin);
    
    // Verify origin
    const allowedOrigins = [
        "https://intentionality.app",
        "https://intentionality-1ce65.firebaseapp.com",
        "http://localhost:5500",
        "http://localhost:3000",
        "http://127.0.0.1:5500"
    ];

    if (!allowedOrigins.includes(event.origin)) {
        console.log("Rejected message from unauthorized origin:", event.origin);
        return;
    }

    // Check if this is a login message
    if (event.data.type === "INTENTIONALITY_USER_LOGGED_IN") {
        console.log("Content script received login message:", event.data);

        // Forward to service worker
        chrome.runtime.sendMessage(
            {
                type: "LOGIN_SUCCESS",
                token: event.data.token,
                userInfo: event.data.userInfo,
                timestamp: Date.now(),
            },
            function (response) {
                if (chrome.runtime.lastError) {
                    console.error(
                        "Error sending to service worker:",
                        chrome.runtime.lastError,
                    );
                } else {
                    console.log(
                        "Successfully forwarded to service worker:",
                        response,
                    );
                }
            },
        );
    }
});
