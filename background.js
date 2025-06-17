let temporarilyAllowedUrls = []; // Stores objects like { tabId: 123, url: "https://example.com" }

// Function to create daily summary
function createDailySummary(activityLog) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Filter activities from today
    const todaysActivities = activityLog.filter((activity) => {
        const activityDate = new Date(activity.timestamp);
        return activityDate >= today;
    });

    if (todaysActivities.length === 0) {
        return null;
    }

    // Calculate statistics
    const productivityScores = {
        productive: 1,
        slightly_distracted: 0.5,
        pretty_distracted: 0,
        very_distracted: -0.5,
        extremely_distracted: -1,
    };

    let totalScore = 0;
    let productiveCount = 0;
    let distractedCount = 0;
    let totalTimeDistracted = 0;

    todaysActivities.forEach((activity) => {
        const score = productivityScores[activity.dumbReason] || 0;
        totalScore += score;

        if (score > 0) {
            productiveCount++;
        } else if (score < 0) {
            distractedCount++;
            if (activity.sessionDuration) {
                totalTimeDistracted += activity.sessionDuration;
            }
        }
    });

    const averageScore = totalScore / todaysActivities.length;
    const productivePercentage =
        (productiveCount / todaysActivities.length) * 100;
    const distractedPercentage =
        (distractedCount / todaysActivities.length) * 100;

    return {
        totalVisits: todaysActivities.length,
        productiveCount,
        distractedCount,
        productivePercentage,
        distractedPercentage,
        averageScore,
        totalTimeDistracted,
    };
}

// Function to send daily summary notification
function sendDailySummaryNotification() {
    chrome.storage.sync.get(["activityLog"], function (result) {
        const activityLog = result.activityLog || [];
        const summary = createDailySummary(activityLog);

        if (!summary) {
            return; // No activities today
        }

        const minutesDistracted = Math.round(summary.totalTimeDistracted / 60);

        chrome.notifications.create({
            type: "basic",
            iconUrl: "icons/icon128.png",
            title: "Daily Intentionality Summary",
            message:
                `Today's Progress:\n` +
                `• Total Visits: ${summary.totalVisits}\n` +
                `• Productive: ${
                    summary.productiveCount
                } (${summary.productivePercentage.toFixed(1)}%)\n` +
                `• Distracted: ${
                    summary.distractedCount
                } (${summary.distractedPercentage.toFixed(1)}%)\n` +
                `• Time Distracted: ${minutesDistracted} minutes\n` +
                `• Overall Score: ${summary.averageScore.toFixed(2)}`,
            priority: 2,
        });
    });
}

// Check if it's time for daily summary (runs every minute)
function checkDailySummary() {
    const now = new Date();
    if (now.getHours() === 20 && now.getMinutes() === 0) {
        // 8:00 PM
        sendDailySummaryNotification();
    }
}

// Set up periodic check for daily summary
setInterval(checkDailySummary, 60000); // Check every minute

// Listen for messages from other parts of the extension (e.g., popup.js, why_prompt.js)
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === "allowUrl") {
        temporarilyAllowedUrls.push(request.url);
        sendResponse({ status: "success" });
    } else if (request.action === "proceedToUrl") {
        if (request.tabId && request.url) {
            // Add the tabId and URL to the temporarily allowed list
            temporarilyAllowedUrls.push({
                tabId: request.tabId,
                url: request.url,
            });

            // Directly update the original tab to the requested URL
            chrome.tabs.update(
                request.tabId,
                { url: request.url },
                function () {
                    if (chrome.runtime.lastError) {
                        console.error(
                            "Error updating tab: ",
                            chrome.runtime.lastError.message,
                        );
                        sendResponse({
                            status: "error",
                            message: chrome.runtime.lastError.message,
                        });
                    } else {
                        // Wait for the navigation to start before sending success
                        setTimeout(() => {
                            sendResponse({ status: "success" });
                        }, 500);
                    }
                },
            );
            return true; // Keep the message channel open for the async response
        } else {
            sendResponse({ status: "error", message: "Missing tabId or URL" });
        }
    }
});

// Listen for navigation events
chrome.webNavigation.onBeforeNavigate.addListener(
    function (details) {
        // If the navigation is to our why_prompt.html, we don't want to re-block it.
        if (details.url.startsWith(chrome.runtime.getURL("why_prompt.html"))) {
            return;
        }

        // Check if this URL for this tabId is temporarily allowed
        const allowedIndex = temporarilyAllowedUrls.findIndex(
            (item) => item.tabId === details.tabId && item.url === details.url,
        );

        if (allowedIndex > -1) {
            temporarilyAllowedUrls.splice(allowedIndex, 1); // Remove from allowed list after use
            return; // Allow navigation to proceed
        }

        const url = new URL(details.url);
        const hostname = url.hostname;

        // Check if the current site is in the block list (exact match for hostname)
        chrome.storage.sync.get(["blockedSites"], function (result) {
            const blockedSites = result.blockedSites || [];

            if (
                blockedSites.some(
                    (site) => hostname === site || hostname === `www.${site}`,
                )
            ) {
                // Create a blocking page
                chrome.tabs.update(details.tabId, {
                    url: chrome.runtime.getURL(
                        `why_prompt.html?url=${encodeURIComponent(
                            details.url,
                        )}&tabId=${details.tabId}`,
                    ),
                });
            }
        });
    },
    { url: [{ schemes: ["http", "https"] }] },
);
