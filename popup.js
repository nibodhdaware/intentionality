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
                console.log("Firebase not available, migration not possible");
                const migrationStatus =
                    document.getElementById("migrationStatus");
                migrationStatus.textContent =
                    "Firebase not available for migration";
                return;
            }

            if (typeof MigrationUtility === "undefined") {
                console.log("Migration utility not loaded");
                return;
            }

            const migrationUtil = new MigrationUtility();
            const status = await migrationUtil.checkMigrationStatus();

            const migrateButton = document.getElementById("migrateButton");
            const migrationStatus = document.getElementById("migrationStatus");

            if (status.needsMigration) {
                migrateButton.style.display = "block";
                migrationStatus.textContent =
                    "You have local data that can be migrated to the cloud";
            } else {
                migrateButton.style.display = "none";
                migrationStatus.textContent = status.reason;
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

    // Add event listener for migration button
    const migrateButton = document.getElementById("migrateButton");
    if (migrateButton) {
        migrateButton.addEventListener("click", performMigration);
    }

    // Function to load and render activity stats from Firestore
    async function loadActivityStats() {
        const selectedDate = document.getElementById("datePicker").value;

        try {
            // Check if Firebase is available
            if (typeof firebase === "undefined" || !firebase.firestore) {
                console.log("Firebase not available, using Chrome storage");
                loadActivityStatsFromChrome(selectedDate);
                return;
            }

            const userId = await getCurrentUserId();
            console.log(
                "Debug - Attempting to load activity stats for userId:",
                userId,
            );

            if (!userId) {
                // Fallback to Chrome storage
                console.log(
                    "No user ID available, using Chrome storage fallback",
                );
                loadActivityStatsFromChrome(selectedDate);
                return;
            }

            // Query Firestore for activities on the selected date
            const startOfDay = new Date(selectedDate);
            const endOfDay = new Date(selectedDate);
            endOfDay.setDate(endOfDay.getDate() + 1);

            const activitiesRef = firebase
                .firestore()
                .collection("users")
                .doc(userId)
                .collection("activities");
            const query = activitiesRef
                .where("timestamp", ">=", startOfDay)
                .where("timestamp", "<", endOfDay)
                .orderBy("timestamp");

            const snapshot = await query.get();
            const activityLog = [];

            snapshot.forEach((doc) => {
                activityLog.push(doc.data());
            });

            renderActivityStats(activityLog, selectedDate);
        } catch (error) {
            console.error(
                "Error loading activity stats from Firestore:",
                error,
            );
            console.log(
                "Falling back to Chrome storage due to Firestore error",
            );
            // Fallback to Chrome storage
            loadActivityStatsFromChrome(selectedDate);
        }
    }

    // Fallback function to load activity stats from Chrome storage
    function loadActivityStatsFromChrome(selectedDate) {
        chrome.storage.sync.get(["activityLog"], function (result) {
            const activityLog = result.activityLog || [];
            renderActivityStats(activityLog, selectedDate);
        });
    }

    // Render activity stats (common function for both Firestore and Chrome storage)
    function renderActivityStats(activityLog, selectedDate) {
        const activityStatsDiv = document.getElementById("activityStats");
        activityStatsDiv.innerHTML = ""; // Clear previous content

        // Helper to convert timestamp to Date object
        const toDate = (timestamp) => {
            if (!timestamp) return new Date();
            // Firestore timestamps have a toDate() method
            if (typeof timestamp.toDate === "function") {
                return timestamp.toDate();
            }
            // Fallback for ISO strings from older data
            return new Date(timestamp);
        };

        // Filter activities by selected date
        const filteredActivities = activityLog.filter((log) => {
            const logDate = toDate(log.timestamp).toISOString().split("T")[0];
            return logDate === selectedDate;
        });

        if (filteredActivities.length === 0) {
            activityStatsDiv.innerHTML = `<p>No activity recorded for ${selectedDate}.</p>`;
            // Clear the chart
            if (window.activityChartInstance) {
                window.activityChartInstance.destroy();
                window.activityChartInstance = null;
            }
            return;
        }

        // Group by dumbReason and calculate total duration
        const reasonSummary = {};
        const urlSummary = {};

        const reasonEmojis = {
            productive: "🎯",
            slightly_distracted: "😅",
            pretty_distracted: "😬",
            very_distracted: "😫",
            extremely_distracted: "🤦‍♂️",
        };

        filteredActivities.forEach((log) => {
            // Summarize reasons
            if (log.dumbReason && log.dumbReason !== "") {
                reasonSummary[log.dumbReason] =
                    (reasonSummary[log.dumbReason] || 0) + 1;
            }

            // Summarize time spent on URLs (only for non-productive sessions)
            if (
                log.dumbReason !== "productive" &&
                log.sessionDuration !== null
            ) {
                const hostname = new URL(log.url).hostname;
                urlSummary[hostname] =
                    (urlSummary[hostname] || 0) + log.sessionDuration;
            }
        });

        // Display Reason Summary
        let reasonHtml =
            '<div class="stats-section-item"><h4>Reason Distribution:</h4><ul>';
        for (const reason in reasonSummary) {
            const emoji = reasonEmojis[reason] || "";
            const readableReason = reason
                .replace(/_/g, " ")
                .replace(/\b\w/g, (char) => char.toUpperCase());
            reasonHtml += `<li>${readableReason} ${emoji}: ${reasonSummary[reason]} times</li>`;
        }
        reasonHtml += "</ul></div>";

        // Display URL Summary
        let urlHtml =
            '<div class="stats-section-item"><h4>Most Distracting Sites:</h4><ul>';
        const sortedUrls = Object.entries(urlSummary).sort(
            (a, b) => b[1] - a[1],
        );
        sortedUrls.forEach(([hostname, duration]) => {
            urlHtml += `<li>${hostname}: ${Math.round(duration / 60)} min</li>`;
        });
        urlHtml += "</ul></div>";

        activityStatsDiv.innerHTML = reasonHtml + urlHtml;

        // Create the activity chart with filtered data
        createActivityChart(filteredActivities);
    }

    // Function to create and update the activity chart
    function createActivityChart(activityLog) {
        const ctx = document.getElementById("activityChart").getContext("2d");

        // Helper to convert timestamp to Date object
        const toDate = (timestamp) => {
            if (!timestamp) return new Date();
            if (typeof timestamp.toDate === "function") {
                return timestamp.toDate(); // Firestore timestamp
            }
            return new Date(timestamp); // ISO string
        };

        // Sort activities by timestamp
        const sortedActivities = activityLog.sort(
            (a, b) => toDate(a.timestamp) - toDate(b.timestamp),
        );

        // Create a productivity score for each activity
        const productivityScores = {
            productive: 1,
            slightly_distracted: 0.5,
            pretty_distracted: 0,
            very_distracted: -0.5,
            extremely_distracted: -1,
        };

        // Prepare data for the chart
        const labels = sortedActivities.map((activity) => {
            return toDate(activity.timestamp).toLocaleTimeString();
        });

        const scores = sortedActivities.map(
            (activity) => productivityScores[activity.dumbReason] || 0,
        );

        // Calculate cumulative score
        let cumulativeScore = 0;
        const cumulativeScores = scores.map((score) => {
            cumulativeScore += score;
            return cumulativeScore;
        });

        // Destroy previous chart instance if exists
        if (window.activityChartInstance) {
            window.activityChartInstance.destroy();
        }

        // Create new chart
        window.activityChartInstance = new Chart(ctx, {
            type: "line",
            data: {
                labels: labels,
                datasets: [
                    {
                        label: "Productivity Score",
                        data: cumulativeScores,
                        borderColor: "#2c3e50",
                        backgroundColor: "rgba(44, 62, 80, 0.1)",
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: "index",
                },
                plugins: {
                    legend: {
                        display: false,
                    },
                    tooltip: {
                        enabled: true,
                        mode: "index",
                        intersect: false,
                        backgroundColor: "rgba(44, 62, 80, 0.9)",
                        titleColor: "white",
                        bodyColor: "white",
                        borderColor: "#2c3e50",
                        borderWidth: 1,
                        cornerRadius: 6,
                        displayColors: false,
                        callbacks: {
                            title: (context) => {
                                const activity =
                                    sortedActivities[context[0].dataIndex];
                                return `Time: ${toDate(
                                    activity.timestamp,
                                ).toLocaleTimeString()}`;
                            },
                            label: (context) => {
                                const activity =
                                    sortedActivities[context.dataIndex];
                                const score = scores[context.dataIndex];
                                const readableReason = (
                                    activity.dumbReason || ""
                                )
                                    .replace(/_/g, " ")
                                    .replace(/\b\w/g, (char) =>
                                        char.toUpperCase(),
                                    );

                                let tooltip = [];
                                tooltip.push(
                                    `Cumulative Score: ${context.formattedValue}`,
                                );
                                tooltip.push(`Event Score: ${score}`);
                                tooltip.push(`Reason: ${readableReason}`);

                                try {
                                    const hostname = new URL(activity.url)
                                        .hostname;
                                    tooltip.push(`URL: ${hostname}`);
                                } catch (e) {
                                    // Invalid URL, ignore
                                }

                                if (activity.reason) {
                                    tooltip.push(`Note: "${activity.reason}"`);
                                }

                                return tooltip;
                            },
                        },
                    },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: "rgba(0, 0, 0, 0.1)",
                        },
                        title: {
                            display: true,
                            text: "Cumulative Score",
                        },
                    },
                    x: {
                        grid: {
                            color: "rgba(0, 0, 0, 0.1)",
                        },
                        title: {
                            display: true,
                            text: "Time of Day",
                        },
                    },
                },
            },
        });
    }
});
