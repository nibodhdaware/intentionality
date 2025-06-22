let startTime;

document.addEventListener("DOMContentLoaded", function () {
    startTime = new Date(); // Record the time when the page loads

    const reasonInput = document.getElementById("reasonInput");
    const dumbReasonDropdown = document.getElementById("dumbReasonDropdown");
    const proceedButton = document.getElementById("proceedButton");
    const cancelButton = document.getElementById("cancelButton");
    const mainUI = document.getElementById("mainUI");

    // Show main UI
    mainUI.style.display = "block";

    // Get the original URL and tabId from the query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const originalUrl = urlParams.get("url");
    const originalTabId = parseInt(urlParams.get("tabId")); // Get tabId as integer

    proceedButton.addEventListener("click", async function () {
        const reason = reasonInput.value.trim();
        const dumbReason = dumbReasonDropdown.value;

        // Try to save to Firestore first, fallback to Chrome storage
        try {
            await saveActivityToFirestore(originalUrl, reason, dumbReason);
        } catch (error) {
            console.error(
                "Error saving to Firestore, falling back to Chrome storage:",
                error,
            );
            await saveActivityToChrome(originalUrl, reason, dumbReason);
        }

        // Send message to background.js to proceed with the original tabId
        if (originalTabId && originalUrl) {
            proceedButton.disabled = true;
            chrome.runtime.sendMessage(
                {
                    action: "proceedToUrl",
                    url: originalUrl,
                    tabId: originalTabId,
                },
                function (response) {
                    if (response && response.status === "success") {
                        setTimeout(() => {
                            window.close();
                        }, 1000);
                    } else {
                        console.error("Failed to proceed to URL:", response);
                        proceedButton.disabled = false;
                    }
                },
            );
        } else {
            console.error(
                "Missing originalTabId or originalUrl to proceed. Closing prompt.",
            );
            window.close();
        }
    });

    cancelButton.addEventListener("click", function () {
        window.close();
    });
});

// Function to save activity to Firestore
async function saveActivityToFirestore(url, reason, dumbReason) {
    // Check if Firebase is available
    if (typeof firebase === "undefined" || !firebase.firestore) {
        throw new Error("Firebase not available");
    }

    // Get current user ID
    const userId = await getCurrentUserId();
    if (!userId) {
        throw new Error("No user ID available");
    }

    let sessionDuration = null;
    if (dumbReason === "procrastination" && startTime) {
        const endTime = new Date();
        sessionDuration = (endTime.getTime() - startTime.getTime()) / 1000; // Duration in seconds
    }

    const activityData = {
        url: url,
        reason: reason,
        dumbReason: dumbReason,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        sessionDuration: sessionDuration,
    };

    // Save to Firestore
    const activitiesRef = firebase
        .firestore()
        .collection("users")
        .doc(userId)
        .collection("activities");
    await activitiesRef.add(activityData);

    console.log("Activity saved to Firestore successfully");
}

// Function to save activity to Chrome storage (fallback)
async function saveActivityToChrome(url, reason, dumbReason) {
    return new Promise((resolve, reject) => {
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
                url: url,
                reason: reason,
                dumbReason: dumbReason,
                timestamp: timestamp,
                sessionDuration: sessionDuration,
            });

            chrome.storage.sync.set({ activityLog }, function () {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    console.log(
                        "Activity saved to Chrome storage successfully",
                    );
                    resolve();
                }
            });
        });
    });
}

// Get current user ID from Chrome storage
async function getCurrentUserId() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(["userInfo"], function (result) {
            const userInfo = result.userInfo;
            resolve(userInfo ? userInfo.uid : null);
        });
    });
}
