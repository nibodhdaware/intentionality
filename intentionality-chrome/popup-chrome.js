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
            removeButton.className = "btn-icon";
            removeButton.innerHTML = "&times;";
            removeButton.title = "Remove site";
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
        // Check if Chart.js is available
        if (typeof Chart === "undefined") {
            console.warn("Chart.js not available, skipping chart creation");
            return;
        }

        const toDate = (timestamp) => {
            const date = new Date(timestamp);
            return date.toISOString().split("T")[0];
        };

        const canvas = document.getElementById("activityChart");
        if (!canvas) {
            console.warn("Activity chart canvas not found");
            return;
        }

        const ctx = canvas.getContext("2d");

        // Clear previous chart safely
        if (
            window.activityChart &&
            typeof window.activityChart.destroy === "function"
        ) {
            try {
                window.activityChart.destroy();
            } catch (error) {
                console.warn("Error destroying previous chart:", error);
            }
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

        // Create chart with error handling
        try {
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
        } catch (error) {
            console.error("Error creating activity chart:", error);
            // Hide the chart container if chart creation fails
            const chartContainer = document.getElementById("chartContainer");
            if (chartContainer) {
                chartContainer.style.display = "none";
            }
        }
    }
});
