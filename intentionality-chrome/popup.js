// Firestore-based data storage for Intentionality extension
import './lib/browser-polyfill.js';

// Get current user ID (now using local storage only)
async function getCurrentUserId() {
    return "local_user";
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
    const mainPopupUI = document.querySelector(".main-container");
    const siteInput = document.getElementById("siteInput");
    const addSiteButton = document.getElementById("addSite");
    const blockedSitesList = document.getElementById("blockedSitesList");
    const settingsLink = document.getElementById("settingsLink");
    
    // Modal Elements
    const configModal = document.getElementById("configModal");
    const closeConfigBtn = document.getElementById("closeConfig");
    const saveConfigBtn = document.getElementById("saveConfigBtn");
    const removeSiteBtn = document.getElementById("removeSiteBtn");
    const configSiteName = document.getElementById("configSiteName");
    const customPromptInput = document.getElementById("customPrompt");
    const customTimeInput = document.getElementById("customTime");

    let currentEditingSite = null;

    // Add settings link handler
    settingsLink.addEventListener("click", function(e) {
        e.preventDefault();
        window.location.href = chrome.runtime.getURL("settings.html");
    });

    // Modal Event Listeners
    closeConfigBtn.onclick = closeConfig;
    window.onclick = function(event) {
        if (event.target == configModal) {
            closeConfig();
        }
    };

    saveConfigBtn.onclick = async () => {
        if (!currentEditingSite) return;
        
        const config = {
            prompt: customPromptInput.value.trim(),
            time: parseInt(customTimeInput.value) || 10
        };

        await saveSiteConfig(currentEditingSite, config);
        closeConfig();
    };

    removeSiteBtn.onclick = async () => {
        if (!currentEditingSite) return;
        
        // Use a standard confirm for now, but ensure it works
        const confirmed = confirm(`Are you sure you want to unblock ${currentEditingSite}?`);
        if (confirmed) {
            const siteToRemove = currentEditingSite;
            closeConfig(); // Close first to avoid UI glitches
            await removeSite(siteToRemove);
        }
    };

    function closeConfig() {
        configModal.classList.add("hidden");
        currentEditingSite = null;
    }

    async function openConfig(site) {
        currentEditingSite = site;
        configSiteName.textContent = `Configure ${site}`;
        configModal.classList.remove("hidden");

        // Load existing config
        chrome.storage.sync.get(["siteConfigs"], function(result) {
            const configs = result.siteConfigs || {};
            const siteConfig = configs[site] || {};
            
            customPromptInput.value = siteConfig.prompt || "";
            customTimeInput.value = siteConfig.time || ""; 
        });
    }

    async function saveSiteConfig(site, config) {
        return new Promise((resolve) => {
            chrome.storage.sync.get(["siteConfigs"], function(result) {
                const configs = result.siteConfigs || {};
                configs[site] = config;
                
                chrome.storage.sync.set({ siteConfigs: configs }, function() {
                    console.log(`Saved config for ${site}`);
                    resolve();
                });
            });
        });
    }

    // Load today's activity stats
    setTimeout(() => {
        loadActivityStats();
    }, 100);

    // Check and reset state if it's a new day
    checkAndResetDailyState();

    // Listen for messages from other parts of the extension
    chrome.runtime.onMessage.addListener(function (
        request,
        sender,
        sendResponse,
    ) {
        if (request.action === "getBlockedSitesFromStorage") {
            // Handle request from background script for blocked sites
            getBlockedSitesFromStorage()
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
    async function getBlockedSitesFromStorage() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(["blockedSites"], function (result) {
                const blockedSites = result.blockedSites || [];
                resolve(blockedSites);
            });
        });
    }

    // Load and display blocked sites from local storage
    async function loadBlockedSites() {
        chrome.storage.sync.get(["blockedSites"], function (result) {
            let blockedSites = result.blockedSites || [];
            displayBlockedSites(blockedSites);
        });
    }

    // Display blocked sites in the UI
    function displayBlockedSites(blockedSites) {
        blockedSitesList.innerHTML = "";

        if (blockedSites.length === 0) {
            blockedSitesList.innerHTML = '<div class="empty">No websites blocked yet</div>';
        }

        blockedSites.forEach((site) => {
            const siteItem = document.createElement("div");
            siteItem.className = "site-item";

            const siteText = document.createElement("span");
            siteText.className = "site-name";
            siteText.textContent = site;

            const configButton = document.createElement("button");
            configButton.className = "btn-icon";
            configButton.innerHTML = "&#9881;"; // Gear symbol
            configButton.title = "Configure site";
            configButton.onclick = (e) => {
                e.stopPropagation();
                openConfig(site);
            };

            siteItem.appendChild(siteText);
            siteItem.appendChild(configButton);
            blockedSitesList.appendChild(siteItem);
        });
    }

    // Sync blocked sites to browser storage for background script access
    function syncBlockedSitesToBrowser(blockedSites) {
        chrome.storage.sync.set({ blockedSites: blockedSites });
    }

    // Add a new site to the block list
    async function addSite() {
        const site = siteInput.value.trim().toLowerCase().replace(/https?:\/\//, "").replace(/www\./, "").split('/')[0];
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
    async function removeSite(site) {
        return new Promise((resolve) => {
            chrome.storage.sync.get(["blockedSites", "siteConfigs"], function (result) {
                const blockedSites = result.blockedSites || [];
                const updatedSites = blockedSites.filter((s) => s !== site);
                
                const configs = result.siteConfigs || {};
                if (configs[site]) {
                    delete configs[site];
                }

                chrome.storage.sync.set(
                    { 
                        blockedSites: updatedSites,
                        siteConfigs: configs
                    },
                    function () {
                        console.log(`Removed ${site}`);
                        loadBlockedSites();
                        resolve();
                    },
                );
            });
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

    // Initial load for blocked sites
    loadBlockedSites();

    // Load activity statistics
    async function loadActivityStats() {
        const today = new Date().toISOString().split("T")[0];
        loadActivityStatsFromBrowser(today);
    }

    // Fallback function to load activity stats from browser storage
    function loadActivityStatsFromBrowser(selectedDate) {
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

        if (filteredActivities.length === 0) {
            activityStats.innerHTML = `
                <div class="stats-container">
                    <div class="stats-row">
                        <span class="stats-label">Productive visits:</span>
                        <span class="stats-value productive">0</span>
                    </div>
                    <div class="stats-row">
                        <span class="stats-label">Distracted visits:</span>
                        <span class="stats-value distracted">0</span>
                    </div>
                    <div class="stats-row">
                        <span class="stats-label">Total activities:</span>
                        <span class="stats-value">0</span>
                    </div>
                </div>
            `;
            // Create empty chart
            createActivityChart([]);
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
            <div class="stats-container">
                <div class="stat-card">
                    <span class="stat-label">Productive</span>
                    <span class="stat-value productive">${productiveCount}</span>
                </div>
                <div class="stat-card">
                    <span class="stat-label">Distracted</span>
                    <span class="stat-value distracted">${distractedCount}</span>
                </div>
                <div class="stat-card">
                    <span class="stat-label">Total Visits</span>
                    <span class="stat-value">${filteredActivities.length}</span>
                </div>
                <div class="stat-card">
                    <span class="stat-label">Score</span>
                    <span class="stat-value">${averageScore > 0 ? '+' : ''}${averageScore.toFixed(2)}</span>
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

        // Sort activities by timestamp for chronological order
        const sortedActivities = activityLog.sort((a, b) => 
            new Date(a.timestamp) - new Date(b.timestamp)
        );

        // Calculate cumulative productivity score
        const productivityScores = {
            productive: 1,
            slightly_distracted: 0.5,
            pretty_distracted: 0,
            very_distracted: -0.5,
            extremely_distracted: -1,
        };

        let cumulativeScore = 0;
        const chartData = [];
        
        sortedActivities.forEach((activity, index) => {
            const score = productivityScores[activity.dumbReason] || 0;
            cumulativeScore += score;
            
            const date = new Date(activity.timestamp);
            const timeLabel = date.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
            });
            
            chartData.push({
                x: timeLabel,
                y: cumulativeScore,
                activity: activity.reason,
                score: score
            });
        });

        // If no data, create empty chart
        if (chartData.length === 0) {
            chartData.push({ x: '00:00', y: 0, activity: 'No activity', score: 0 });
        }

        const labels = chartData.map(d => d.x);
        const productivityData = chartData.map(d => d.y);

        // Create line chart with error handling
        try {
            window.activityChart = new Chart(ctx, {
                type: "line",
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: "Productivity Trend",
                            data: productivityData,
                            borderColor: cumulativeScore >= 0 ? "#10b981" : "#ef4444",
                            backgroundColor: cumulativeScore >= 0 ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                            borderWidth: 3,
                            fill: true,
                            tension: 0.3,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            pointBackgroundColor: "#fff",
                            pointBorderColor: cumulativeScore >= 0 ? "#10b981" : "#ef4444",
                            pointBorderWidth: 2,
                        }
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        intersect: false,
                        mode: 'index',
                    },
                    scales: {
                        x: {
                            grid: {
                                display: false,
                            },
                            ticks: {
                                maxTicksLimit: 10,
                                color: '#6b7280',
                                font: {
                                    size: 10
                                },
                                autoSkip: true,
                                maxRotation: 45,
                                minRotation: 45
                            }
                        },
                        y: {
                            grid: {
                                color: 'rgba(107, 114, 128, 0.1)',
                                borderDash: [2, 2],
                            },
                            ticks: {
                                color: '#6b7280',
                                font: {
                                    size: 11
                                },
                                callback: function(value) {
                                    return value > 0 ? '+' + value : value;
                                }
                            },
                            title: {
                                display: true,
                                text: 'Cumulative Score',
                                color: '#6b7280',
                                font: {
                                    size: 11
                                }
                            }
                        },
                    },
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            padding: 12,
                            cornerRadius: 8,
                            titleFont: {
                                size: 12
                            },
                            bodyFont: {
                                size: 11
                            },
                            callbacks: {
                                title: function(context) {
                                    return 'Time: ' + context[0].label;
                                },
                                label: function(context) {
                                    const dataPoint = chartData[context.dataIndex];
                                    const scoreText = dataPoint.score > 0 ? 'Productive' : dataPoint.score < 0 ? 'Distracted' : 'Neutral';
                                    return [
                                        'Score: ' + (context.parsed.y > 0 ? '+' : '') + context.parsed.y.toFixed(1),
                                        'Reason: ' + dataPoint.activity,
                                        'Type: ' + scoreText
                                    ];
                                }
                            }
                        }
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
