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

    proceedButton.addEventListener("click", async function (e) {
        const reason = reasonInput.value.trim();
        const dumbReason = dumbReasonDropdown.value;
        // Validation: both fields must be filled
        let valid = true;
        let validationMessage = document.getElementById("validationMessage");
        if (!validationMessage) {
            validationMessage = document.createElement("div");
            validationMessage.id = "validationMessage";
            validationMessage.style.color = "#e74c3c";
            validationMessage.style.marginBottom = "10px";
            proceedButton.parentNode.insertBefore(
                validationMessage,
                proceedButton,
            );
        }
        validationMessage.style.display = "none";
        if (!reason) {
            valid = false;
            reasonInput.focus();
            validationMessage.textContent = "Please enter your reason.";
            validationMessage.style.display = "block";
        } else if (!dumbReason) {
            valid = false;
            dumbReasonDropdown.focus();
            validationMessage.textContent =
                "Please select how dumb your reason is.";
            validationMessage.style.display = "block";
        }
        if (!valid) {
            e.preventDefault();
            return;
        }

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
        if (originalUrl) {
            // Try to use the background script if tabId is available
            if (originalTabId) {
                proceedButton.disabled = true;
                chrome.runtime.sendMessage(
                    {
                        action: "proceedToUrl",
                        url: originalUrl,
                        tabId: originalTabId,
                    },
                    function (response) {
                        if (response && response.status === "success") {
                            // Instead of window.close(), show a message
                            proceedButton.innerText =
                                "You may now close this tab.";
                            proceedButton.disabled = true;
                        } else {
                            // Fallback: redirect directly
                            window.location.href = originalUrl;
                        }
                    },
                );
            } else {
                // No tabId, just redirect
                window.location.href = originalUrl;
            }
        } else {
            console.error(
                "Missing originalUrl to proceed. Please close this tab.",
            );
            proceedButton.innerText = "You may now close this tab.";
            proceedButton.disabled = true;
        }
    });

    cancelButton.addEventListener("click", function () {
        // Show a message instead of closing
        cancelButton.innerText = "You may now close this tab.";
        cancelButton.disabled = true;
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
    // Calculate session duration for all distracted activities (not just productive ones)
    if (dumbReason && dumbReason !== "productive" && startTime) {
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
            // Calculate session duration for all distracted activities (not just productive ones)
            if (dumbReason && dumbReason !== "productive" && startTime) {
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
