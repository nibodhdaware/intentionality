// Only keep block list, activity stats, and chart logic. Remove all firebase/auth code.

document.addEventListener("DOMContentLoaded", function () {
    const mainPopupUI = document.getElementById("mainPopupUI");
    const siteInput = document.getElementById("siteInput");
    const addSiteButton = document.getElementById("addSite");
    const blockedSitesList = document.getElementById("blockedSitesList");

    // Show main UI
    mainPopupUI.style.display = "flex";

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

    // Event listeners
    addSiteButton.addEventListener("click", addSite);
    siteInput.addEventListener("keypress", function (e) {
        if (e.key === "Enter") {
            addSite();
        }
    });

    // Initial load for blocked sites
    loadBlockedSites();

    // Load and display activity stats
    loadActivityStats();
});

// Function to load and render activity stats
function loadActivityStats() {
    chrome.storage.sync.get(["activityLog"], function (result) {
        const activityLog = result.activityLog || [];
        const activityStatsDiv = document.getElementById("activityStats");
        activityStatsDiv.innerHTML = ""; // Clear previous content

        if (activityLog.length === 0) {
            activityStatsDiv.innerHTML = "<p>No activity recorded yet.</p>";
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

        activityLog.forEach((log) => {
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

        // Create the activity chart
        createActivityChart(reasonSummary, urlSummary);
    });
}

// Function to create and update the activity chart
function createActivityChart(reasonSummary, urlSummary) {
    const ctx = document.getElementById("activityChart").getContext("2d");

    // Get activity log and sort by timestamp
    chrome.storage.sync.get(["activityLog"], function (result) {
        const activityLog = result.activityLog || [];

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
            return date.toLocaleDateString() + " " + date.toLocaleTimeString();
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
                        backgroundColor: "rgba(44, 62, 80, 0.1)",
                        fill: true,
                        tension: 0.3,
                        pointRadius: 6,
                        pointHoverRadius: 10,
                    },
                ],
            },
            options: {
                responsive: true,
                aspectRatio: 1.2,
                maintainAspectRatio: true,
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
                                    .replace(/\b\w/g, (char) =>
                                        char.toUpperCase(),
                                    );

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
                            maxTicksLimit: 5,
                            maxRotation: 45,
                            minRotation: 0,
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
    });
}
