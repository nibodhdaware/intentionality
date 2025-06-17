let temporarilyAllowedUrls = []; // Stores objects like { tabId: 123, url: "https://example.com" }

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
