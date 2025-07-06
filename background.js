let temporarilyAllowedUrls = []; // Stores objects like { tabId: 123, url: "https://example.com" }

// Setup webNavigation listener for blocking
function setupWebNavigationListener() {
    // Listen for navigation events - only block direct user navigation
    chrome.webNavigation.onBeforeNavigate.addListener(async function (details) {
        // Only handle main frame navigation (frameId === 0) that is user-initiated
        if (details.frameId !== 0) {
            return; // Skip iframes and sub-frames
        }

        // Skip if this is a background request or embed
        if (details.parentFrameId !== -1) {
            return; // Skip embedded content
        }

        // If the navigation is to our why_prompt.html, we don't want to re-block it.
        if (details.url.startsWith(chrome.runtime.getURL("why_prompt.html"))) {
            return;
        }

        // Skip chrome://, chrome-extension://, and other safe protocols
        if (
            details.url.startsWith("chrome://") ||
            details.url.startsWith("chrome-extension://") ||
            details.url.startsWith("moz-extension://") ||
            details.url.startsWith("about:") ||
            details.url.startsWith("data:")
        ) {
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

        // Skip localhost and internal domains
        if (
            hostname === "localhost" ||
            hostname === "127.0.0.1" ||
            hostname.startsWith("192.168.") ||
            hostname.startsWith("10.") ||
            hostname.startsWith("172.")
        ) {
            return;
        }

        // Skip common safe domains that shouldn't be blocked
        const safeDomains = [
            "google.com",
            "google.co.uk",
            "google.ca",
            "google.com.au",
            "google.de",
            "google.fr",
            "google.it",
            "google.es",
            "google.nl",
            "google.se",
            "google.no",
            "google.dk",
            "google.fi",
            "google.pl",
            "google.ru",
            "google.co.jp",
            "google.co.kr",
            "google.com.br",
            "google.com.mx",
            "google.com.ar",
            "google.cl",
            "google.co.za",
            "google.co.in",
            "google.com.sg",
            "google.com.my",
            "google.com.ph",
            "google.co.th",
            "google.co.id",
            "google.com.vn",
            "google.com.tr",
            "google.com.ua",
            "google.com.eg",
            "google.com.sa",
            "google.ae",
            "google.com.ng",
            "google.co.ke",
            "google.com.gh",
            "google.co.ug",
            "google.co.tz",
            "google.co.zw",
            "google.co.bw",
            "google.co.na",
            "google.co.za",
            "google.com.au",
            "google.co.nz",
            "google.com.fj",
            "google.com.pg",
            "google.com.sb",
            "google.com.vu",
            "google.com.nc",
            "google.com.pf",
            "google.com.ws",
            "google.com.to",
            "google.com.ck",
            "google.com.nu",
            "google.com.tk",
            "google.com.tv",
            "google.com.ki",
            "google.com.nr",
            "google.com.pw",
            "google.com.mh",
            "google.com.fm",
            "google.com.mh",
            "google.com.pw",
            "google.com.nr",
            "google.com.ki",
            "google.com.tv",
            "google.com.tk",
            "google.com.nu",
            "google.com.ck",
            "google.com.to",
            "google.com.ws",
            "google.com.pf",
            "google.com.nc",
            "google.com.vu",
            "google.com.sb",
            "google.com.pg",
            "google.com.fj",
            "google.co.nz",
            "google.com.au",
            "google.co.za",
            "google.co.bw",
            "google.co.na",
            "google.co.zw",
            "google.co.tz",
            "google.co.ug",
            "google.com.gh",
            "google.co.ke",
            "google.com.ng",
            "google.ae",
            "google.com.sa",
            "google.com.eg",
            "google.com.ua",
            "google.com.tr",
            "google.com.vn",
            "google.co.id",
            "google.co.th",
            "google.com.ph",
            "google.com.my",
            "google.com.sg",
            "google.co.in",
            "google.co.za",
            "google.cl",
            "google.com.ar",
            "google.com.mx",
            "google.com.br",
            "google.co.kr",
            "google.co.jp",
            "google.ru",
            "google.pl",
            "google.fi",
            "google.dk",
            "google.no",
            "google.se",
            "google.nl",
            "google.es",
            "google.it",
            "google.fr",
            "google.de",
            "google.com.au",
            "google.ca",
            "google.co.uk",
            "google.com",
            "intentionality.app",
            "intentionality.com",
            "chrome.google.com",
            "webstore.google.com",
            "accounts.google.com",
            "mail.google.com",
            "drive.google.com",
            "docs.google.com",
            "sheets.google.com",
            "slides.google.com",
            "calendar.google.com",
            "meet.google.com",
            "classroom.google.com",
            "translate.google.com",
            "maps.google.com",
            "earth.google.com",
            "books.google.com",
            "news.google.com",
            "shopping.google.com",
            "finance.google.com",
            "analytics.google.com",
            "search.google.com",
            "www.google.com",
            "www.google.co.uk",
            "www.google.ca",
            "www.google.com.au",
            "www.google.de",
            "www.google.fr",
            "www.google.it",
            "www.google.es",
            "www.google.nl",
            "www.google.se",
            "www.google.no",
            "www.google.dk",
            "www.google.fi",
            "www.google.pl",
            "www.google.ru",
            "www.google.co.jp",
            "www.google.co.kr",
            "www.google.com.br",
            "www.google.com.mx",
            "www.google.com.ar",
            "www.google.cl",
            "www.google.co.za",
            "www.google.co.in",
            "www.google.com.sg",
            "www.google.com.my",
            "www.google.com.ph",
            "www.google.co.th",
            "www.google.co.id",
            "www.google.com.vn",
            "www.google.com.tr",
            "www.google.com.ua",
            "www.google.com.eg",
            "www.google.com.sa",
            "www.google.ae",
            "www.google.com.ng",
            "www.google.co.ke",
            "www.google.com.gh",
            "www.google.co.ug",
            "www.google.co.tz",
            "www.google.co.zw",
            "www.google.co.bw",
            "www.google.co.na",
            "www.google.co.za",
            "www.google.com.au",
            "www.google.co.nz",
            "www.google.com.fj",
            "www.google.com.pg",
            "www.google.com.sb",
            "www.google.com.vu",
            "www.google.com.nc",
            "www.google.com.pf",
            "www.google.com.ws",
            "www.google.com.to",
            "www.google.com.ck",
            "www.google.com.nu",
            "www.google.com.tk",
            "www.google.com.tv",
            "www.google.com.ki",
            "www.google.com.nr",
            "www.google.com.pw",
            "www.google.com.mh",
            "www.google.com.fm",
            "www.google.com.mh",
            "www.google.com.pw",
            "www.google.com.nr",
            "www.google.com.ki",
            "www.google.com.tv",
            "www.google.com.tk",
            "www.google.com.nu",
            "www.google.com.ck",
            "www.google.com.to",
            "www.google.com.ws",
            "www.google.com.pf",
            "www.google.com.nc",
            "www.google.com.vu",
            "www.google.com.sb",
            "www.google.com.pg",
            "www.google.com.fj",
            "www.google.co.nz",
            "www.google.com.au",
            "www.google.co.za",
            "www.google.co.bw",
            "www.google.co.na",
            "www.google.co.zw",
            "www.google.co.tz",
            "www.google.co.ug",
            "www.google.com.gh",
            "www.google.co.ke",
            "www.google.com.ng",
            "www.google.ae",
            "www.google.com.sa",
            "www.google.com.eg",
            "www.google.com.ua",
            "www.google.com.tr",
            "www.google.com.vn",
            "www.google.co.id",
            "www.google.co.th",
            "www.google.com.ph",
            "www.google.com.my",
            "www.google.com.sg",
            "www.google.co.in",
            "www.google.co.za",
            "www.google.cl",
            "www.google.com.ar",
            "www.google.com.mx",
            "www.google.com.br",
            "www.google.co.kr",
            "www.google.co.jp",
            "www.google.ru",
            "www.google.pl",
            "www.google.fi",
            "www.google.dk",
            "www.google.no",
            "www.google.se",
            "www.google.nl",
            "www.google.es",
            "www.google.it",
            "www.google.fr",
            "www.google.de",
            "www.google.com.au",
            "www.google.ca",
            "www.google.co.uk",
            "www.google.com",
            "www.intentionality.app",
            "www.intentionality.com",
            "www.chrome.google.com",
            "www.webstore.google.com",
            "www.accounts.google.com",
            "www.mail.google.com",
            "www.drive.google.com",
            "www.docs.google.com",
            "www.sheets.google.com",
            "www.slides.google.com",
            "www.calendar.google.com",
            "www.meet.google.com",
            "www.classroom.google.com",
            "www.translate.google.com",
            "www.maps.google.com",
            "www.earth.google.com",
            "www.books.google.com",
            "www.news.google.com",
            "www.shopping.google.com",
            "www.finance.google.com",
            "www.analytics.google.com",
            "www.search.google.com",
        ];

        if (safeDomains.includes(hostname)) {
            return;
        }

        // Check if this site is in our blocklist
        const isBlocked = await checkIfSiteBlocked(hostname);

        if (isBlocked) {
            // Block the navigation and show the why prompt
            chrome.tabs.update(details.tabId, {
                url: chrome.runtime.getURL("why_prompt.html"),
            });

            // Store the blocked URL for the why prompt
            chrome.storage.local.set({
                blockedUrl: details.url,
                blockedHostname: hostname,
                blockedTabId: details.tabId,
            });

            // Log the blocking event
            logBlockingEvent(hostname, details.url);
        }
    });
}

// Function to log blocking events for activity tracking
function logBlockingEvent(hostname, url) {
    const timestamp = Date.now();
    const blockingEvent = {
        hostname: hostname,
        url: url,
        timestamp: timestamp,
        type: "blocked_site",
    };

    // Store the blocking event in Chrome storage for activity tracking
    chrome.storage.sync.get(["activityLog"], function (result) {
        const activityLog = result.activityLog || [];
        activityLog.push(blockingEvent);

        // Keep only the last 1000 events to prevent storage bloat
        if (activityLog.length > 1000) {
            activityLog.splice(0, activityLog.length - 1000);
        }

        chrome.storage.sync.set({ activityLog: activityLog }, function () {
            console.log(`Blocking event logged for ${hostname}`);
        });
    });
}

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

// Function to get blocked sites from Chrome storage (simplified for service worker)
async function getBlockedSitesFromStorage() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(["blockedSites"], function (result) {
            const blockedSites = result.blockedSites || [];
            console.log(
                `Retrieved ${
                    blockedSites.length
                } blocked sites from Chrome storage: ${blockedSites.join(
                    ", ",
                )}`,
            );
            resolve(blockedSites);
        });
    });
}

// Function to check if a site is blocked (Chrome storage only for service worker)
async function checkIfSiteBlocked(hostname) {
    try {
        console.log(`Checking if ${hostname} is blocked...`);

        const blockedSites = await getBlockedSitesFromStorage();
        const isBlocked = blockedSites.some(
            (site) => hostname === site || hostname === `www.${site}`,
        );

        console.log(`Blocked sites: ${blockedSites.join(", ")}`);
        console.log(`Is ${hostname} blocked? ${isBlocked}`);
        return isBlocked;
    } catch (error) {
        console.error("Error checking blocked sites:", error);
        return false; // Default to not blocked if there's an error
    }
}

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
    } else if (request.action === "getBlockedSitesFromFirestore") {
        // This will be handled by the popup if it's open
        // For now, return null to indicate fallback to Chrome storage
        sendResponse({ success: false, blockedSites: null });
    } else if (request.type === "LOGIN_SUCCESS") {
        // Handle login success from the login page
        console.log("Login success received in background script");

        // Store the authentication data
        chrome.storage.sync.set(
            {
                authToken: request.token,
                userInfo: request.userInfo,
            },
            function () {
                console.log("Authentication data stored");

                // Forward the message to any open popup
                chrome.runtime.sendMessage(request);

                sendResponse({ status: "success" });
            },
        );

        return true; // Keep the message channel open for the async response
    }
});

// Listen for messages from external websites (like the login page)
chrome.runtime.onMessageExternal.addListener(
    (message, sender, sendResponse) => {
        console.log("External message received:", message, "from:", sender);

        if (message.type === "LOGIN_SUCCESS") {
            const token = message.token;
            const userInfo = message.userInfo;

            console.log(
                "External login success received with token:",
                token ? "present" : "missing",
            );

            // Store token and user info using chrome.storage
            chrome.storage.sync.set(
                {
                    authToken: token,
                    userInfo: userInfo,
                },
                () => {
                    console.log(
                        "User is logged in! Token and user info stored.",
                    );

                    // Forward the message to any open popup
                    chrome.runtime.sendMessage({
                        type: "LOGIN_SUCCESS",
                        token: token,
                        userInfo: userInfo,
                    });
                },
            );

            sendResponse({ status: "received" });
        }
    },
);

// Listen for extension installation
chrome.runtime.onInstalled.addListener(function (details) {
    if (details.reason === "install") {
        console.log("Extension installed - redirecting to login");

        // Open the login page in a new tab
        chrome.tabs.create({
            url: "https://intentionality.app/login.html",
        });
    }
});

// Set uninstall URL to redirect to feedback form
chrome.runtime.setUninstallURL("https://forms.gle/xHuRVeYARy1LVXA47");

// Inject content script for login page communication
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (
        changeInfo.status === "complete" &&
        tab.url &&
        (tab.url.includes("intentionality.app/login") ||
            tab.url.includes("intentionality.app/login.html"))
    ) {
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            function: injectLoginCommunication,
        });
    }
});

// Content script function to inject into login page
function injectLoginCommunication() {
    // Listen for custom events from the login page
    window.addEventListener("intentionalityUserLoggedIn", function (event) {
        // Forward the login event to the extension
        chrome.runtime.sendMessage({
            type: "LOGIN_SUCCESS",
            userInfo: event.detail,
            timestamp: Date.now(),
        });
    });

    // Listen for localStorage changes
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function (key, value) {
        originalSetItem.apply(this, arguments);
        if (key === "intentionality_user_login") {
            try {
                const loginData = JSON.parse(value);
                chrome.runtime.sendMessage({
                    type: "LOGIN_SUCCESS",
                    userInfo: loginData.userInfo,
                    timestamp: loginData.timestamp,
                });
            } catch (e) {
                console.error("Error parsing login data:", e);
            }
        }
    };
}

// Initialize: Enable automatic blocking
setupWebNavigationListener();
