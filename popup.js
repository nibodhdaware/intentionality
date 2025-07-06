// Firestore-based data storage for Intentionality extension

// Get current user ID from Chrome storage
async function getCurrentUserId() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(["userInfo", "authToken"], function (result) {
            const userInfo = result.userInfo;
            const authToken = result.authToken;

            console.log("Debug - userInfo:", userInfo);
            console.log("Debug - authToken exists:", !!authToken);
            console.log(
                "Debug - userInfo.uid:",
                userInfo ? userInfo.uid : null,
            );

            resolve(userInfo ? userInfo.uid : null);
        });
    });
}

// Check if we have blocking permissions
async function hasBlockingPermissions() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(
            { action: "checkBlockingPermissions" },
            (response) => {
                resolve(response && response.hasPermissions);
            },
        );
    });
}

// Request blocking permissions
async function requestBlockingPermissions() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(
            { action: "requestBlockingPermissions" },
            (response) => {
                resolve(response && response.granted);
            },
        );
    });
}

// Check if a site is blocked (helper function)
async function checkIfSiteBlocked(hostname) {
    return new Promise((resolve) => {
        chrome.storage.sync.get(["blockedSites"], function (result) {
            const blockedSites = result.blockedSites || [];
            const isBlocked = blockedSites.some(
                (site) => hostname === site || hostname === `www.${site}`,
            );
            resolve(isBlocked);
        });
    });
}

// Show permission request dialog
function showPermissionRequestDialog() {
    return new Promise((resolve) => {
        // Create overlay
        const overlay = document.createElement("div");
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        // Create dialog
        const dialog = document.createElement("div");
        dialog.style.cssText = `
            background: white;
            padding: 24px;
            border-radius: 12px;
            max-width: 400px;
            margin: 20px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
        `;

        dialog.innerHTML = `
            <h3 style="margin: 0 0 16px 0; color: #18344A; font-size: 18px;">
                Enable Automatic Blocking
            </h3>
            <p style="margin: 0 0 16px 0; color: #666; line-height: 1.5;">
                To automatically block distracting websites, Intentionality needs permission to monitor your browsing.
            </p>
            <p style="margin: 0 0 20px 0; color: #666; line-height: 1.5;">
                This allows the extension to show the "Why are you visiting?" prompt when you try to visit blocked sites.
            </p>
            <div style="display: flex; gap: 12px; justify-content: flex-end; align-items: center;">
                <button id="skip-permission" style="
                    padding: 8px 16px;
                    border: 1px solid #ddd;
                    background: white;
                    border-radius: 6px;
                    cursor: pointer;
                    color: #666;
                ">Skip (Manual Mode)</button>
                <button id="grant-permission" style="
                    width: 40px;
                    height: 40px;
                    border: none;
                    background: #4A90A4;
                    color: white;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 500;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                ">✓</button>
            </div>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // Event listeners
        document.getElementById("grant-permission").onclick = async () => {
            const granted = await requestBlockingPermissions();
            overlay.remove();
            resolve(granted);
        };

        document.getElementById("skip-permission").onclick = () => {
            overlay.remove();
            resolve(false);
        };
    });
}

// Show manual blocking mode message
function showManualBlockingMessage() {
    const message = document.createElement("div");
    message.style.cssText = `
        background: #f0f8ff;
        border: 1px solid #4A90A4;
        border-radius: 8px;
        padding: 12px;
        margin: 12px 0;
        color: #18344A;
        font-size: 14px;
    `;
    message.innerHTML = `
        <strong>Manual Blocking Mode</strong><br>
        You can still block sites, but you'll need to check manually via the popup. 
        To enable automatic blocking, click the extension icon and grant permissions.
    `;

    // Insert after the blocked sites list
    const blockedSitesList = document.getElementById("blockedSitesList");
    blockedSitesList.parentNode.insertBefore(
        message,
        blockedSitesList.nextSibling,
    );
}

// Check current tab for blocking
async function checkCurrentTabForBlocking() {
    try {
        const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
        });
        if (tab && tab.url) {
            const hostname = new URL(tab.url).hostname;
            const isBlocked = await checkIfSiteBlocked(hostname);

            if (isBlocked) {
                showManualBlockingPopup(tab.url, hostname);
            }
        }
    } catch (error) {
        console.error("Error checking current tab:", error);
    }
}

// Show manual blocking popup when visiting blocked site
function showManualBlockingPopup(url, hostname) {
    // Create overlay
    const overlay = document.createElement("div");
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;

    // Create popup
    const popup = document.createElement("div");
    popup.style.cssText = `
        background: white;
        padding: 24px;
        border-radius: 12px;
        max-width: 400px;
        margin: 20px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
        text-align: center;
    `;

    popup.innerHTML = `
        <div style="margin-bottom: 20px;">
            <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
            <h3 style="margin: 0 0 16px 0; color: #18344A; font-size: 18px;">
                Block This Site?
            </h3>
            <p style="margin: 0 0 20px 0; color: #666; line-height: 1.5;">
                You're visiting <strong>${hostname}</strong> which is in your block list.
                <br><br>
                Would you like to block this site now?
            </p>
        </div>
        <div style="display: flex; gap: 12px; justify-content: center;">
            <button id="block-site" style="
                padding: 12px 24px;
                border: none;
                background: #dc3545;
                color: white;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 500;
                font-size: 14px;
            ">Yes, Block This Site</button>
            <button id="enable-automatic" style="
                width: 40px;
                height: 40px;
                border: none;
                background: #4A90A4;
                color: white;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 500;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
            " title="Enable Automatic Blocking">✓</button>
        </div>
        <div style="margin-top: 16px;">
            <button id="dismiss-popup" style="
                padding: 8px 16px;
                border: 1px solid #ddd;
                background: white;
                border-radius: 6px;
                cursor: pointer;
                color: #666;
                font-size: 12px;
            ">Dismiss</button>
        </div>
    `;

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Event listeners
    document.getElementById("block-site").onclick = async () => {
        // Get current tab for tabId
        const [currentTab] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
        });

        // Show the why_prompt for this site
        const whyPromptUrl = chrome.runtime.getURL(
            `why_prompt.html?url=${encodeURIComponent(url)}&tabId=${
                currentTab.id
            }`,
        );

        // Open why_prompt in new tab
        chrome.tabs.create({ url: whyPromptUrl });

        overlay.remove();
    };

    document.getElementById("enable-automatic").onclick = async () => {
        const granted = await requestBlockingPermissions();
        if (granted) {
            // Show success message
            popup.innerHTML = `
                <div style="margin-bottom: 20px;">
                    <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
                    <h3 style="margin: 0 0 16px 0; color: #18344A; font-size: 18px;">
                        Automatic Blocking Enabled!
                    </h3>
                    <p style="margin: 0 0 20px 0; color: #666; line-height: 1.5;">
                        You can now close this popup. Automatic blocking is now active.
                    </p>
                </div>
                <button id="close-popup" style="
                    padding: 8px 16px;
                    border: 1px solid #ddd;
                    background: white;
                    border-radius: 6px;
                    cursor: pointer;
                    color: #666;
                ">Close</button>
            `;

            document.getElementById("close-popup").onclick = () => {
                overlay.remove();
            };
        } else {
            // Show error message
            popup.innerHTML = `
                <div style="margin-bottom: 20px;">
                    <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
                    <h3 style="margin: 0 0 16px 0; color: #18344A; font-size: 18px;">
                        Permission Denied
                    </h3>
                    <p style="margin: 0 0 20px 0; color: #666; line-height: 1.5;">
                        Automatic blocking was not enabled. You can still block sites manually.
                    </p>
                </div>
                <button id="close-popup" style="
                    padding: 8px 16px;
                    border: 1px solid #ddd;
                    background: white;
                    border-radius: 6px;
                    cursor: pointer;
                    color: #666;
                ">Close</button>
            `;

            document.getElementById("close-popup").onclick = () => {
                overlay.remove();
            };
        }
    };

    document.getElementById("dismiss-popup").onclick = () => {
        overlay.remove();
    };
}

// Show message when current tab is blocked
function showCurrentTabBlockedMessage(url, hostname) {
    const message = document.createElement("div");
    message.style.cssText = `
        background: #fff3cd;
        border: 1px solid #ffc107;
        border-radius: 8px;
        padding: 12px;
        margin: 12px 0;
        color: #856404;
        font-size: 14px;
    `;
    message.innerHTML = `
        <strong>⚠️ Current site is blocked</strong><br>
        You're currently on <strong>${hostname}</strong> which is in your block list.
        <br><br>
        <button id="proceed-anyway" style="
            background: #ffc107;
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            color: #856404;
            font-size: 12px;
        ">Proceed Anyway</button>
    `;

    // Insert at the top of the popup
    const container = document.querySelector(".container");
    container.insertBefore(message, container.firstChild);

    // Handle proceed anyway button
    document.getElementById("proceed-anyway").onclick = () => {
        message.remove();
    };
}

document.addEventListener("DOMContentLoaded", function () {
    const mainPopupUI = document.getElementById("mainPopupUI");
    const siteInput = document.getElementById("siteInput");
    const addSiteButton = document.getElementById("addSite");
    const blockedSitesList = document.getElementById("blockedSitesList");
    const datePicker = document.getElementById("datePicker");
    const chartOverlay = document.getElementById("chartOverlay");

    // Show main UI
    mainPopupUI.style.display = "flex";

    // Set default date to today - ensure this happens after DOM is ready
    function setDefaultDate() {
        const today = new Date().toISOString().split("T")[0];
        datePicker.value = today;
        console.log("Date picker set to:", today);
    }

    // Set the date immediately and also after a short delay to ensure it takes effect
    setDefaultDate();
    setTimeout(() => {
        setDefaultDate();
        // Trigger initial load after setting the date
        loadActivityStats();
    }, 100);

    // Check authentication state
    checkAuthState();

    // Check and reset state if it's a new day
    checkAndResetDailyState();

    // Check current tab for blocking on popup open
    checkCurrentTabForBlocking();

    // Check for active blocked site notifications
    checkForBlockedSiteNotifications();

    // Function to check authentication state
    function checkAuthState() {
        chrome.storage.sync.get(["authToken", "userInfo"], function (result) {
            const authToken = result.authToken;
            const userInfo = result.userInfo;

            if (authToken && userInfo) {
                // User is logged in, hide overlay
                chartOverlay.classList.add("hidden");
            } else {
                // User is not logged in, show overlay
                chartOverlay.classList.remove("hidden");
            }
        });
    }

    // Listen for messages from the login page
    chrome.runtime.onMessage.addListener(function (
        request,
        sender,
        sendResponse,
    ) {
        if (request.type === "LOGIN_SUCCESS") {
            // Store the auth token and user info
            chrome.storage.sync.set(
                {
                    authToken: request.token,
                    userInfo: request.userInfo,
                },
                function () {
                    // Hide the overlay after successful login
                    chartOverlay.classList.add("hidden");
                    console.log("User logged in successfully");
                },
            );
        } else if (request.action === "getBlockedSitesFromFirestore") {
            // Handle request from background script for blocked sites
            getBlockedSitesForBackground()
                .then((blockedSites) => {
                    sendResponse({
                        success: true,
                        blockedSites: blockedSites,
                    });
                })
                .catch((error) => {
                    console.error(
                        "Error getting blocked sites for background:",
                        error,
                    );
                    sendResponse({
                        success: false,
                        blockedSites: null,
                    });
                });
            return true; // Keep the message channel open for the async response
        }
    });

    // Function to get blocked sites for background script
    async function getBlockedSitesForBackground() {
        try {
            // Check if Firebase is available
            if (typeof firebase === "undefined" || !firebase.firestore) {
                console.log("Firebase not available for background script");
                return null;
            }

            const userId = await getCurrentUserId();
            if (!userId) {
                return null;
            }

            const docRef = firebase
                .firestore()
                .collection("users")
                .doc(userId)
                .collection("settings")
                .doc("blockedSites");
            const doc = await docRef.get();

            if (doc.exists) {
                const data = doc.data();
                return data.sites || [];
            }

            return null;
        } catch (error) {
            console.error("Error getting blocked sites for background:", error);
            return null;
        }
    }

    // Load and display blocked sites from Firestore
    async function loadBlockedSites() {
        try {
            // Check if Firebase is available
            if (typeof firebase === "undefined" || !firebase.firestore) {
                console.log("Firebase not available, using Chrome storage");
                loadBlockedSitesFromChrome();
                return;
            }

            const userId = await getCurrentUserId();
            console.log(
                "Debug - Attempting to load blocked sites for userId:",
                userId,
            );

            if (!userId) {
                console.log(
                    "No user ID available, using local storage fallback",
                );
                loadBlockedSitesFromChrome();
                return;
            }

            const docRef = firebase
                .firestore()
                .collection("users")
                .doc(userId)
                .collection("settings")
                .doc("blockedSites");
            const doc = await docRef.get();

            if (doc.exists) {
                const data = doc.data();
                const blockedSites = data.sites || [];
                displayBlockedSites(blockedSites);
            } else {
                // If no Firestore document exists, try to migrate from Chrome storage
                await migrateBlockedSitesToFirestore();
            }
        } catch (error) {
            console.error("Error loading blocked sites from Firestore:", error);
            console.log(
                "Falling back to Chrome storage due to Firestore error",
            );
            // Fallback to Chrome storage
            loadBlockedSitesFromChrome();
        }
    }

    // Fallback function to load blocked sites from Chrome storage
    function loadBlockedSitesFromChrome() {
        chrome.storage.sync.get(["blockedSites"], function (result) {
            const blockedSites = result.blockedSites || [];
            displayBlockedSites(blockedSites);
        });
    }

    // Sync blocked sites from Firestore to Chrome storage on popup load
    async function syncBlockedSitesFromFirestore() {
        try {
            // Check if Firebase is available
            if (typeof firebase === "undefined" || !firebase.firestore) {
                return; // No Firebase, skip sync
            }

            const userId = await getCurrentUserId();
            if (!userId) {
                return; // No user ID, skip sync
            }

            const docRef = firebase
                .firestore()
                .collection("users")
                .doc(userId)
                .collection("settings")
                .doc("blockedSites");
            const doc = await docRef.get();

            if (doc.exists) {
                const data = doc.data();
                const blockedSites = data.sites || [];
                // Sync to Chrome storage for background script
                syncBlockedSitesToChrome(blockedSites);
            }
        } catch (error) {
            console.error("Error syncing blocked sites from Firestore:", error);
        }
    }

    // Display blocked sites in the UI
    function displayBlockedSites(blockedSites) {
        blockedSitesList.innerHTML = "";

        blockedSites.forEach((site) => {
            const siteItem = document.createElement("div");
            siteItem.className = "site-item";

            const siteText = document.createElement("span");
            siteText.textContent = site;

            const removeButton = document.createElement("button");
            removeButton.className = "remove-btn";
            removeButton.textContent = "Remove";
            removeButton.onclick = () => removeSite(site);

            siteItem.appendChild(siteText);
            siteItem.appendChild(removeButton);
            blockedSitesList.appendChild(siteItem);
        });

        // Sync to Chrome storage for background script access
        syncBlockedSitesToChrome(blockedSites);
    }

    // Sync blocked sites to Chrome storage for background script access
    function syncBlockedSitesToChrome(blockedSites) {
        chrome.storage.sync.set({ blockedSites: blockedSites }, function () {
            if (chrome.runtime.lastError) {
                console.error(
                    "Error syncing blocked sites to Chrome storage:",
                    chrome.runtime.lastError,
                );
            } else {
                console.log(
                    `Synced ${blockedSites.length} blocked sites to Chrome storage`,
                );
            }
        });
    }

    // Add a new site to the block list in Firestore
    async function addSite() {
        const site = siteInput.value.trim().toLowerCase();
        if (!site) return;

        // Check if we have blocking permissions
        const hasPermissions = await hasBlockingPermissions();

        if (!hasPermissions) {
            // Request permissions before adding site
            const granted = await showPermissionRequestDialog();
            if (!granted) {
                // User denied permissions - show manual blocking message
                showManualBlockingMessage();
                // Still add the site to the list for manual checking
            }
        }

        try {
            // Check if Firebase is available
            if (typeof firebase === "undefined" || !firebase.firestore) {
                console.log("Firebase not available, using Chrome storage");
                addSiteToChrome(site);
                return;
            }

            const userId = await getCurrentUserId();
            if (!userId) {
                // Fallback to Chrome storage
                addSiteToChrome(site);
                return;
            }

            const docRef = firebase
                .firestore()
                .collection("users")
                .doc(userId)
                .collection("settings")
                .doc("blockedSites");
            const doc = await docRef.get();

            let blockedSites = [];
            if (doc.exists) {
                const data = doc.data();
                blockedSites = data.sites || [];
            }

            if (!blockedSites.includes(site)) {
                blockedSites.push(site);
                await docRef.set({ sites: blockedSites });
                siteInput.value = "";
                loadBlockedSites();
                // Sync to Chrome storage for background script
                syncBlockedSitesToChrome(blockedSites);
            }
        } catch (error) {
            console.error("Error adding site to Firestore:", error);
            // Fallback to Chrome storage
            addSiteToChrome(site);
        }
    }

    // Fallback function to add site to Chrome storage
    function addSiteToChrome(site) {
        chrome.storage.sync.get(["blockedSites"], function (result) {
            const blockedSites = result.blockedSites || [];
            if (!blockedSites.includes(site)) {
                blockedSites.push(site);
                chrome.storage.sync.set({ blockedSites }, function () {
                    siteInput.value = "";
                    loadBlockedSites();
                });
            }
        });
    }

    // Remove a site from the block list in Firestore
    async function removeSite(site) {
        try {
            // Check if Firebase is available
            if (typeof firebase === "undefined" || !firebase.firestore) {
                console.log("Firebase not available, using Chrome storage");
                removeSiteFromChrome(site);
                return;
            }

            const userId = await getCurrentUserId();
            if (!userId) {
                // Fallback to Chrome storage
                removeSiteFromChrome(site);
                return;
            }

            const docRef = firebase
                .firestore()
                .collection("users")
                .doc(userId)
                .collection("settings")
                .doc("blockedSites");
            const doc = await docRef.get();

            if (doc.exists) {
                const data = doc.data();
                let blockedSites = data.sites || [];
                blockedSites = blockedSites.filter((s) => s !== site);
                await docRef.set({ sites: blockedSites });
                loadBlockedSites();
                // Sync to Chrome storage for background script
                syncBlockedSitesToChrome(blockedSites);
            }
        } catch (error) {
            console.error("Error removing site from Firestore:", error);
            // Fallback to Chrome storage
            removeSiteFromChrome(site);
        }
    }

    // Fallback function to remove site from Chrome storage
    function removeSiteFromChrome(site) {
        chrome.storage.sync.get(["blockedSites"], function (result) {
            const blockedSites = result.blockedSites || [];
            const updatedSites = blockedSites.filter((s) => s !== site);
            chrome.storage.sync.set(
                { blockedSites: updatedSites },
                function () {
                    loadBlockedSites();
                },
            );
        });
    }

    // Migrate blocked sites from Chrome storage to Firestore
    async function migrateBlockedSitesToFirestore() {
        try {
            // Check if Firebase is available
            if (typeof firebase === "undefined" || !firebase.firestore) {
                console.log("Firebase not available, cannot migrate");
                return;
            }

            const userId = await getCurrentUserId();
            if (!userId) return;

            chrome.storage.sync.get(["blockedSites"], async function (result) {
                const blockedSites = result.blockedSites || [];
                if (blockedSites.length > 0) {
                    const docRef = firebase
                        .firestore()
                        .collection("users")
                        .doc(userId)
                        .collection("settings")
                        .doc("blockedSites");
                    await docRef.set({ sites: blockedSites });
                    console.log("Migrated blocked sites to Firestore");
                }
                displayBlockedSites(blockedSites);
            });
        } catch (error) {
            console.error("Error migrating blocked sites:", error);
        }
    }

    // Check if it's a new day and reset state if needed
    function checkAndResetDailyState() {
        chrome.storage.sync.get(["lastResetDate"], function (result) {
            const lastResetDate = result.lastResetDate;
            const today = new Date().toDateString();

            if (lastResetDate !== today) {
                // Just update the last reset date, don't clear activity log
                // This preserves historical data for date selection
                chrome.storage.sync.set(
                    {
                        lastResetDate: today,
                    },
                    function () {
                        console.log("Daily reset date updated");
                    },
                );
            }
        });
    }

    // Event listeners
    addSiteButton.addEventListener("click", addSite);
    siteInput.addEventListener("keypress", function (e) {
        if (e.key === "Enter") {
            addSite();
        }
    });

    // Date picker event listener
    datePicker.addEventListener("change", function () {
        console.log("Date picker changed to:", datePicker.value);
        loadActivityStats();
    });

    // Initial load for blocked sites
    loadBlockedSites();

    // Sync blocked sites from Firestore to Chrome storage for background script
    syncBlockedSitesFromFirestore();

    // Check migration status and show migration button if needed
    checkMigrationStatus();

    // Function to check migration status and show migration button if needed
    async function checkMigrationStatus() {
        try {
            // Check if Firebase is available
            if (typeof firebase === "undefined" || !firebase.firestore) {
                return; // No Firebase, skip migration check
            }

            const userId = await getCurrentUserId();
            if (!userId) {
                return; // No user ID, skip migration check
            }

            const migrationUtil = new MigrationUtility();
            const status = await migrationUtil.checkMigrationStatus();

            if (status.needsMigration) {
                const migrateButton = document.getElementById("migrateButton");
                const migrationStatus =
                    document.getElementById("migrationStatus");

                migrateButton.style.display = "block";
                migrationStatus.textContent = status.reason;
                migrateButton.onclick = performMigration;
            }
        } catch (error) {
            console.error("Error checking migration status:", error);
        }
    }

    // Function to perform data migration
    async function performMigration() {
        try {
            // Check if Firebase is available
            if (typeof firebase === "undefined" || !firebase.firestore) {
                const migrationStatus =
                    document.getElementById("migrationStatus");
                migrationStatus.textContent =
                    "Firebase not available for migration";
                return;
            }

            const migrateButton = document.getElementById("migrateButton");
            const migrationStatus = document.getElementById("migrationStatus");

            // Disable button and show loading state
            migrateButton.disabled = true;
            migrateButton.textContent = "Migrating...";
            migrationStatus.textContent = "Migrating your data to the cloud...";

            const migrationUtil = new MigrationUtility();
            const result = await migrationUtil.migrateAllData();

            if (result.success) {
                migrationStatus.textContent =
                    "Migration completed successfully!";
                migrateButton.style.display = "none";

                // Reload data to show migrated content
                loadBlockedSites();
                loadActivityStats();
            } else {
                migrationStatus.textContent = `Migration failed: ${result.error}`;
                migrateButton.disabled = false;
                migrateButton.textContent = "Retry Migration";
            }
        } catch (error) {
            console.error("Migration error:", error);
            const migrationStatus = document.getElementById("migrationStatus");
            const migrateButton = document.getElementById("migrateButton");

            migrationStatus.textContent = `Migration failed: ${error.message}`;
            migrateButton.disabled = false;
            migrateButton.textContent = "Retry Migration";
        }
    }

    // Load activity statistics
    async function loadActivityStats() {
        try {
            // Check if Firebase is available
            if (typeof firebase === "undefined" || !firebase.firestore) {
                console.log("Firebase not available, using Chrome storage");
                loadActivityStatsFromChrome(datePicker.value);
                return;
            }

            const userId = await getCurrentUserId();
            if (!userId) {
                console.log("No user ID available, using Chrome storage");
                loadActivityStatsFromChrome(datePicker.value);
                return;
            }

            const selectedDate = datePicker.value;
            const startOfDay = new Date(selectedDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(selectedDate);
            endOfDay.setHours(23, 59, 59, 999);

            const activitiesRef = firebase
                .firestore()
                .collection("users")
                .doc(userId)
                .collection("activities");
            const snapshot = await activitiesRef
                .where("timestamp", ">=", startOfDay)
                .where("timestamp", "<=", endOfDay)
                .orderBy("timestamp", "desc")
                .get();

            const activityLog = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                activityLog.push({
                    url: data.url,
                    reason: data.reason,
                    dumbReason: data.dumbReason,
                    timestamp: data.timestamp.toDate().toISOString(),
                    sessionDuration: data.sessionDuration,
                });
            });

            renderActivityStats(activityLog, selectedDate);
        } catch (error) {
            console.error(
                "Error loading activity stats from Firestore:",
                error,
            );
            // Fallback to Chrome storage
            loadActivityStatsFromChrome(datePicker.value);
        }
    }

    // Fallback function to load activity stats from Chrome storage
    function loadActivityStatsFromChrome(selectedDate) {
        chrome.storage.sync.get(["activityLog"], function (result) {
            const activityLog = result.activityLog || [];
            renderActivityStats(activityLog, selectedDate);
        });
    }

    // Render activity statistics
    function renderActivityStats(activityLog, selectedDate) {
        const toDate = (timestamp) => {
            const date = new Date(timestamp);
            return date.toISOString().split("T")[0];
        };

        // Filter activities for the selected date
        const filteredActivities = activityLog.filter((activity) => {
            return toDate(activity.timestamp) === selectedDate;
        });

        const activityStats = document.getElementById("activityStats");
        activityStats.innerHTML = "";

        if (filteredActivities.length === 0) {
            activityStats.innerHTML = `
                <div style="text-align: center; color: #666; padding: 20px;">
                    No activities recorded for ${selectedDate}
                </div>
            `;
            return;
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

        filteredActivities.forEach((activity) => {
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

        const averageScore = totalScore / filteredActivities.length;
        const productivePercentage =
            (productiveCount / filteredActivities.length) * 100;
        const distractedPercentage =
            (distractedCount / filteredActivities.length) * 100;

        const minutesDistracted = Math.round(totalTimeDistracted / 60);

        activityStats.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 16px;">
                <div style="background: #e8f5e8; padding: 12px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #2d5a2d;">${productiveCount}</div>
                    <div style="font-size: 12px; color: #666;">Productive Visits</div>
                </div>
                <div style="background: #fff3cd; padding: 12px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #856404;">${distractedCount}</div>
                    <div style="font-size: 12px; color: #666;">Distracted Visits</div>
                </div>
            </div>
            <div style="background: #f8f9fa; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Productive:</span>
                    <span style="font-weight: bold;">${productivePercentage.toFixed(
                        1,
                    )}%</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Distracted:</span>
                    <span style="font-weight: bold;">${distractedPercentage.toFixed(
                        1,
                    )}%</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Time Distracted:</span>
                    <span style="font-weight: bold;">${minutesDistracted} min</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>Overall Score:</span>
                    <span style="font-weight: bold; color: ${
                        averageScore >= 0 ? "#2d5a2d" : "#856404"
                    };">${averageScore.toFixed(2)}</span>
                </div>
            </div>
        `;

        // Create activity chart
        createActivityChart(filteredActivities);
    }

    // Create activity chart
    function createActivityChart(activityLog) {
        const toDate = (timestamp) => {
            const date = new Date(timestamp);
            return date.toISOString().split("T")[0];
        };

        const canvas = document.getElementById("activityChart");
        const ctx = canvas.getContext("2d");

        // Clear previous chart
        if (window.activityChart) {
            window.activityChart.destroy();
        }

        // Group activities by hour
        const hourlyData = {};
        activityLog.forEach((activity) => {
            const date = new Date(activity.timestamp);
            const hour = date.getHours();
            if (!hourlyData[hour]) {
                hourlyData[hour] = { productive: 0, distracted: 0 };
            }

            const productivityScores = {
                productive: 1,
                slightly_distracted: 0.5,
                pretty_distracted: 0,
                very_distracted: -0.5,
                extremely_distracted: -1,
            };

            const score = productivityScores[activity.dumbReason] || 0;
            if (score > 0) {
                hourlyData[hour].productive++;
            } else if (score < 0) {
                hourlyData[hour].distracted++;
            }
        });

        // Prepare chart data
        const labels = [];
        const productiveData = [];
        const distractedData = [];

        for (let hour = 0; hour < 24; hour++) {
            labels.push(`${hour}:00`);
            productiveData.push(hourlyData[hour]?.productive || 0);
            distractedData.push(hourlyData[hour]?.distracted || 0);
        }

        // Create chart
        window.activityChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: labels,
                datasets: [
                    {
                        label: "Productive",
                        data: productiveData,
                        backgroundColor: "#28a745",
                        borderColor: "#28a745",
                        borderWidth: 1,
                    },
                    {
                        label: "Distracted",
                        data: distractedData,
                        backgroundColor: "#ffc107",
                        borderColor: "#ffc107",
                        borderWidth: 1,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                        },
                    },
                },
                plugins: {
                    legend: {
                        display: true,
                        position: "top",
                    },
                },
            },
        });
    }

    // Check for active blocked site notifications
    function checkForBlockedSiteNotifications() {
        // Get current tab to check if we should show the popup
        chrome.tabs.query(
            { active: true, currentWindow: true },
            async (tabs) => {
                if (tabs[0] && tabs[0].url) {
                    try {
                        const hostname = new URL(tabs[0].url).hostname;
                        const isBlocked = await checkIfSiteBlocked(hostname);

                        if (isBlocked) {
                            // Show the manual blocking popup automatically
                            showManualBlockingPopup(tabs[0].url, hostname);
                        }
                    } catch (error) {
                        console.error(
                            "Error checking for blocked site notifications:",
                            error,
                        );
                    }
                }
            },
        );
    }
});
