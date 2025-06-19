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

    proceedButton.addEventListener("click", function () {
        const reason = reasonInput.value.trim();
        const dumbReason = dumbReasonDropdown.value;

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

            chrome.storage.sync.set({ activityLog }, function () {
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
                                console.error(
                                    "Failed to proceed to URL:",
                                    response,
                                );
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
        });
    });

    cancelButton.addEventListener("click", function () {
        window.close();
    });
});
