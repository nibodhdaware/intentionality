document.addEventListener("DOMContentLoaded", function () {
    const siteInput = document.getElementById("siteInput");
    const addSiteButton = document.getElementById("addSite");
    const blockedSitesList = document.getElementById("blockedSitesList");

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
        activityStatsDiv.innerHTML += reasonHtml;

        // Display Time Spent on URLs (Non-productive sessions)
        if (Object.keys(urlSummary).length > 0) {
            let urlHtml =
                '<div class="stats-section-item"><h4>Time Spent (Distracted):</h4><ul>';
            for (const url in urlSummary) {
                urlHtml += `<li>${url}: ${urlSummary[url].toFixed(
                    1,
                )} seconds</li>`;
            }
            urlHtml += "</ul></div>";
            activityStatsDiv.innerHTML += urlHtml;
        }

        // Create the chart
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

        // Create the chart
        new Chart(ctx, {
            type: "line",
            data: {
                labels: labels,
                datasets: [
                    {
                        label: "Productivity Trend",
                        data: cumulativeScores,
                        borderColor: "rgba(52, 152, 219, 1)",
                        backgroundColor: "rgba(52, 152, 219, 0.1)",
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
                plugins: {
                    legend: {
                        display: false,
                    },
                    title: {
                        display: true,
                        text: "Productivity Trend Over Time",
                        color: "#2c3e50",
                        font: {
                            size: 16,
                        },
                    },
                    tooltip: {
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
                                return [
                                    `Score: ${score}`,
                                    `Reason: ${reason}`,
                                    `URL: ${activity.url}`,
                                ];
                            },
                        },
                    },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: "Cumulative Productivity Score",
                            color: "#2c3e50",
                        },
                        grid: {
                            color: "rgba(0, 0, 0, 0.1)",
                        },
                    },
                    x: {
                        title: {
                            display: true,
                            text: "Time",
                            color: "#2c3e50",
                        },
                        grid: {
                            color: "rgba(0, 0, 0, 0.1)",
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45,
                        },
                    },
                },
            },
        });
    });
}
