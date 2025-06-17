let startTime;

document.addEventListener("DOMContentLoaded", function () {
    startTime = new Date(); // Record the time when the page loads

    const reasonInput = document.getElementById("reasonInput");
    const dumbReasonDropdown = document.getElementById("dumbReasonDropdown");
    const proceedButton = document.getElementById("proceedButton");
    const cancelButton = document.getElementById("cancelButton");

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
            chrome.storage.sync.set({ activityLog }, function () {
                console.log("Activity logged:", {
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
            });
        });
    });

    cancelButton.addEventListener("click", function () {
        // Go back in history or close the current tab
        window.close(); // Close the prompt page
    });
});
