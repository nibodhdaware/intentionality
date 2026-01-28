let startTime;

document.addEventListener("DOMContentLoaded", function () {
    startTime = new Date(); // Record the time when the page loads

    const reasonInput = document.getElementById("reasonInput");
    const starRating = document.getElementById("starRating");
    const stars = starRating.querySelectorAll('.star');
    const ratingText = document.getElementById("ratingText");
    const proceedButton = document.getElementById("proceedButton");
    const cancelButton = document.getElementById("cancelButton");
    const mainUI = document.getElementById("mainUI");
    const wordCountDisplay = document.getElementById("wordCount");
    
    let selectedRating = 0;

    // Function to count words
    function countWords(text) {
        const trimmed = text.trim();
        if (trimmed === "") return 0;
        // Split by whitespace and filter out empty strings
        return trimmed.split(/\s+/).filter((word) => word.length > 0).length;
    }

    // Update word count as user types
    reasonInput.addEventListener("input", function () {
        chrome.storage.sync.get(["settings"], (result) => {
            const settings = result.settings || {};
            const minWords = settings.strictMode ? 5 : 3;
            const wordCount = countWords(reasonInput.value);
            
            if (wordCount < minWords) {
                wordCountDisplay.textContent = `${wordCount} words (minimum ${minWords} words)`;
                wordCountDisplay.style.color = "#e74c3c"; // Red
            } else {
                wordCountDisplay.textContent = `${wordCount} words ✓`;
                wordCountDisplay.style.color = "#27ae60"; // Green
            }
        });
    });
    
    // Star rating functionality
    const ratingDescriptions = {
        1: "Not productive at all 😔",
        2: "Slightly productive 😐",
        3: "Somewhat productive 🤔",
        4: "Pretty productive 😊",
        5: "Very productive! 🎯"
    };
    
    stars.forEach(star => {
        star.addEventListener('click', function() {
            selectedRating = parseInt(this.dataset.value);
            updateStarDisplay(selectedRating);
            ratingText.textContent = ratingDescriptions[selectedRating];
        });
        
        star.addEventListener('mouseenter', function() {
            const hoverValue = parseInt(this.dataset.value);
            updateStarDisplay(hoverValue, true);
            ratingText.textContent = ratingDescriptions[hoverValue];
        });
    });
    
    starRating.addEventListener('mouseleave', function() {
        updateStarDisplay(selectedRating);
        ratingText.textContent = selectedRating ? ratingDescriptions[selectedRating] : "Select a rating";
    });
    
    function updateStarDisplay(rating, isHover = false) {
        stars.forEach((star, index) => {
            star.classList.remove('active', 'hover');
            if (index < rating) {
                star.classList.add(isHover ? 'hover' : 'active');
            }
        });
    }

    // Get the original URL and tabId from the query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const originalUrl = urlParams.get("url");
    const originalTabId = parseInt(urlParams.get("tabId")); // Get tabId as integer

    // Load custom configuration for the site
    loadSiteConfig(originalUrl);

    async function loadSiteConfig(urlStr) {
        if (!urlStr) return;
        
        try {
            const url = new URL(urlStr);
            const hostname = url.hostname.replace('www.', '');
            
            chrome.storage.sync.get(["siteConfigs", "settings"], function(result) {
                const configs = result.siteConfigs || {};
                const settings = result.settings || { reflectionTime: 10, strictMode: false };
                const siteConfig = configs[hostname] || {};
                
                // Set custom prompt if exists
                if (siteConfig.prompt) {
                    const promptTitle = document.querySelector('h1');
                    if (promptTitle) promptTitle.textContent = siteConfig.prompt;
                }
                
                // Apply Strict Mode if enabled
                if (settings.strictMode) {
                    const cancelButton = document.getElementById("cancelButton");
                    if (cancelButton) {
                        cancelButton.style.opacity = "0.5";
                        cancelButton.style.cursor = "not-allowed";
                        cancelButton.title = "Strict mode is enabled. You must reflect or close the tab.";
                        cancelButton.onclick = (e) => {
                            e.preventDefault();
                            alert("Strict mode is enabled. Please reflect on your intention.");
                        };
                    }
                    // Inform the user
                    const p = document.querySelector('p');
                    if (p) p.innerHTML += "<br><small style='color: #ef4444'>(Strict Mode Enabled)</small>";
                }

                // Set reflection time
                const reflectionTime = siteConfig.time || settings.reflectionTime || 10;
                startCountdown(reflectionTime);
            });
        } catch (e) {
            console.error("Error loading site config:", e);
            startCountdown(10);
        }
    }

    function startCountdown(seconds) {
        const countdownSpan = document.getElementById("countdown");
        proceedButton.disabled = true;
        
        let remaining = seconds;
        
        if (remaining <= 0) {
            proceedButton.disabled = false;
            if (countdownSpan) countdownSpan.textContent = "";
            return;
        }

        const interval = setInterval(() => {
            remaining--;
            if (countdownSpan) countdownSpan.textContent = `(${remaining}s)`;
            
            if (remaining <= 0) {
                clearInterval(interval);
                proceedButton.disabled = false;
                if (countdownSpan) countdownSpan.textContent = "";
            }
        }, 1000);
        
        if (countdownSpan) countdownSpan.textContent = `(${remaining}s)`;
    }

    proceedButton.addEventListener("click", async function (e) {
        const result = await new Promise(r => chrome.storage.sync.get(["settings"], r));
        const settings = result.settings || {};
        const minWords = settings.strictMode ? 5 : 3;
        
        const reason = reasonInput.value.trim();
        const wordCount = countWords(reason);

        // Validation: both fields must be filled and reason must have at least minWords
        let valid = true;
        let validationMessage = document.getElementById("validationMessage");
        if (!validationMessage) {
            validationMessage = document.createElement("div");
            validationMessage.id = "validationMessage";
            validationMessage.style.color = "#e74c3c";
            validationMessage.style.marginBottom = "10px";
            proceedButton.parentNode.insertBefore(
                validationMessage,
                proceedButton,
            );
        }
        validationMessage.style.display = "none";

        if (!reason) {
            valid = false;
            reasonInput.focus();
            validationMessage.textContent = "Please enter your reason.";
            validationMessage.style.display = "block";
        } else if (wordCount < minWords) {
            valid = false;
            reasonInput.focus();
            validationMessage.textContent = `Please provide a more meaningful reason (at least ${minWords} words, you have ${wordCount}).`;
            validationMessage.style.display = "block";
        } else if (selectedRating === 0) {
            valid = false;
            validationMessage.textContent = "Please select a productivity rating.";
            validationMessage.style.display = "block";
        }
        if (!valid) {
            e.preventDefault();
            return;
        }
        
        // Convert star rating to original dumbReason format for compatibility
        const dumbReason = mapRatingToReason(selectedRating);

        // Always save to browser storage first
        await saveActivityToBrowser(originalUrl, reason, dumbReason);

        // Batch sync to API will be handled by the service worker every 24 hours
        // instead of syncing on every visit.
        
        // Disable button and show loading state
        proceedButton.disabled = true;
        proceedButton.textContent = "Proceeding...";
        
        // Send message to background.js to proceed with the original tabId
        if (originalUrl) {
            // Mark that we've processed this intervention to prevent refresh loops
            await markInterventionProcessed(originalUrl, originalTabId);
            
            // Try to use the background script if tabId is available
            chrome.runtime.sendMessage(
                {
                    action: "proceedToUrl",
                    url: originalUrl,
                    tabId: originalTabId,
                },
                function (response) {
                    if (response && response.status === "success") {
                        // Background handled it, close this prompt
                        window.close();
                    } else {
                        // Fallback: redirect this current tab directly to the destination
                        window.location.href = originalUrl;
                    }
                },
            );
        } else {
            console.error(
                "Missing originalUrl to proceed. Please close this tab.",
            );
            proceedButton.textContent = "You may now close this tab.";
            proceedButton.disabled = true;
        }
    });

    cancelButton.addEventListener("click", function () {
        // Show a message instead of closing
        cancelButton.innerText = "You may now close this tab.";
        cancelButton.disabled = true;
    });
});

// Function to save activity to browser storage (fallback)
async function saveActivityToBrowser(urlStr, reason, dumbReason) {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get(["activityLog"], function (result) {
            const activityLog = result.activityLog || [];
            const timestamp = Date.now(); // Use number timestamp for compatibility

            let hostname = "unknown";
            try {
                const url = new URL(urlStr);
                hostname = url.hostname.replace('www.', '');
            } catch (e) {
                console.error("Invalid URL for logging:", urlStr);
            }

            let sessionDuration = null;
            // Calculate session duration for all distracted activities
            if (dumbReason && dumbReason !== "productive" && startTime) {
                const endTime = new Date();
                sessionDuration =
                    (endTime.getTime() - startTime.getTime()) / 1000; // Duration in seconds
            }

            activityLog.push({
                hostname: hostname,
                url: urlStr,
                reason: reason,
                dumbReason: dumbReason,
                timestamp: timestamp,
                sessionDuration: sessionDuration,
                type: "user_confirmed_visit" // Distinguish from the old automatic logs
            });

            // Keep only the last 1000 events
            if (activityLog.length > 1000) {
                activityLog.splice(0, activityLog.length - 1000);
            }

            chrome.storage.sync.set({ activityLog }, function () {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    console.log(
                        "Activity saved to browser storage successfully",
                    );
                    resolve();
                }
            });
        });
    });
}

// Map star rating to original dumbReason format for compatibility
function mapRatingToReason(rating) {
    const mapping = {
        1: "extremely_distracted",
        2: "very_distracted", 
        3: "pretty_distracted",
        4: "slightly_distracted",
        5: "productive"
    };
    return mapping[rating] || "pretty_distracted";
}

// Mark intervention as processed to prevent refresh loops
async function markInterventionProcessed(url, tabId) {
    const key = `intervention_${tabId}_${btoa(url).substring(0, 20)}`;
    const timestamp = new Date().toISOString();
    
    return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: timestamp }, () => {
            console.log('Intervention marked as processed:', key);
            resolve();
        });
    });
}
