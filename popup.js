// Only keep block list, activity stats, and chart logic. Remove all firebase/auth code.

document.addEventListener("DOMContentLoaded", function () {
    const mainPopupUI = document.getElementById("mainPopupUI");
    const siteInput = document.getElementById("siteInput");
    const addSiteButton = document.getElementById("addSite");
    const blockedSitesList = document.getElementById("blockedSitesList");
    const datePicker = document.getElementById("datePicker");
    const chartOverlay = document.getElementById("chartOverlay");

    // Show main UI
    mainPopupUI.style.display = "flex";

    // Set default date to today
    const today = new Date().toISOString().split("T")[0];
    datePicker.value = today;

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
        }
    });

    // Load and display blocked sites
    function loadBlockedSites() {
        chrome.storage.sync.get(["blockedSites"], function (result) {
            const blockedSites = result.blockedSites || [];
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
        });
    }

    // Add a new site to the block list
    function addSite() {
        const site = siteInput.value.trim().toLowerCase();
        if (!site) return;

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

    // Remove a site from the block list
    function removeSite(site) {
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
        loadActivityStats();
    });

    // Initial load for blocked sites
    loadBlockedSites();

    // Load and display activity stats
    loadActivityStats();
});

// Function to load and render activity stats
function loadActivityStats() {
    const selectedDate = document.getElementById("datePicker").value;

    chrome.storage.sync.get(["activityLog"], function (result) {
        const activityLog = result.activityLog || [];

        const activityStatsDiv = document.getElementById("activityStats");
        activityStatsDiv.innerHTML = ""; // Clear previous content

        // Filter activities by selected date
        const filteredActivities = activityLog.filter((log) => {
            const logDate = new Date(log.timestamp).toISOString().split("T")[0];
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
    });
}

// Function to create and update the activity chart
function createActivityChart(activityLog) {
    const ctx = document.getElementById("activityChart").getContext("2d");

    // Sort activities by timestamp
    const sortedActivities = activityLog.sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
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
        const date = new Date(activity.timestamp);
        // Subtract 1 hour from the timestamp for display
        date.setHours(date.getHours() - 1);
        return date.toLocaleTimeString();
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

    window.activityChartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label: "Cumulative Productivity Score",
                    data: cumulativeScores,
                    borderColor: "#2c3e50",
                    backgroundColor: "transparent",
                    fill: true,
                    tension: 0.3,
                    pointRadius: 6,
                    pointHoverRadius: 10,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false,
                },
                tooltip: {
                    enabled: true,
                    mode: "nearest",
                    intersect: true,
                    callbacks: {
                        label: function (context) {
                            const activity =
                                sortedActivities[context.dataIndex];
                            const score =
                                productivityScores[activity.dumbReason];
                            const reason = activity.dumbReason
                                .replace(/_/g, " ")
                                .replace(/\b\w/g, (char) => char.toUpperCase());

                            // Format the timestamp to show 1 hour before
                            const date = new Date(activity.timestamp);
                            date.setHours(date.getHours() - 1);
                            const timeStr = date.toLocaleTimeString();

                            return [
                                `Time: ${timeStr}`,
                                `Score: ${score}`,
                                `Reason: ${reason}`,
                                `Your Note: "${
                                    activity.reason || "No note provided"
                                }"`,
                                `URL: ${activity.url}`,
                            ];
                        },
                    },
                },
            },
            interaction: {
                mode: "nearest",
                intersect: true,
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: "Time",
                    },
                    ticks: {
                        autoSkip: true,
                        maxTicksLimit: 10,
                    },
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: "Cumulative Score",
                    },
                    beginAtZero: true,
                    suggestedMin: 0,
                },
            },
        },
    });
}
