
class SettingsManager {
    constructor() {
        this.defaultSettings = {
            notifications: true,
            strictMode: false,
            reflectionTime: 10,
            theme: 'auto'
        };
        
        this.settings = {};
        this.init();
    }
    
    async init() {
        await this.loadSettings();
        this.bindEvents();
        this.updateUI();
    }
    
    // Helper to use chrome storage with promises
    async getStorage(keys) {
        return new Promise((resolve) => {
            chrome.storage.sync.get(keys, (result) => {
                resolve(result);
            });
        });
    }

    async setStorage(data) {
        return new Promise((resolve) => {
            chrome.storage.sync.set(data, () => {
                resolve();
            });
        });
    }

    async clearStorage() {
        return new Promise((resolve) => {
            chrome.storage.sync.clear(() => {
                resolve();
            });
        });
    }
    
    async loadSettings() {
        try {
            const stored = await this.getStorage('settings');
            this.settings = { ...this.defaultSettings, ...(stored.settings || {}) };
        } catch (error) {
            console.error('Failed to load settings:', error);
            this.settings = { ...this.defaultSettings };
        }
    }
    
    async saveSettings() {
        try {
            await this.setStorage({ settings: this.settings });
            console.log('Settings saved successfully');
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    }
    
    bindEvents() {
        // Back button
        document.getElementById('backBtn').addEventListener('click', () => {
            window.location.href = 'popup.html';
        });
        
        // Toggle switches
        document.getElementById('notificationsToggle').addEventListener('click', () => {
            this.toggleSetting('notifications');
        });
        
        document.getElementById('strictModeToggle').addEventListener('click', () => {
            this.toggleSetting('strictMode');
        });
        
        // Select inputs
        document.getElementById('reflectionTime').addEventListener('change', (e) => {
            this.settings.reflectionTime = parseInt(e.target.value);
            this.saveSettings();
        });
        
        document.getElementById('theme').addEventListener('change', (e) => {
            this.settings.theme = e.target.value;
            this.saveSettings();
            this.applyTheme();
        });
        
        // Action buttons
        document.getElementById('exportData').addEventListener('click', () => {
            this.exportData();
        });
        
        document.getElementById('clearData').addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
                this.clearAllData();
            }
        });
    }
    
    toggleSetting(key) {
        this.settings[key] = !this.settings[key];
        this.saveSettings();
        this.updateUI();
    }
    
    updateUI() {
        // Update toggles
        const notificationsToggle = document.getElementById('notificationsToggle');
        const strictModeToggle = document.getElementById('strictModeToggle');
        
        if (this.settings.notifications) {
            notificationsToggle.classList.add('active');
        } else {
            notificationsToggle.classList.remove('active');
        }
        
        if (this.settings.strictMode) {
            strictModeToggle.classList.add('active');
        } else {
            strictModeToggle.classList.remove('active');
        }
        
        // Update selects
        document.getElementById('reflectionTime').value = this.settings.reflectionTime;
        document.getElementById('theme').value = this.settings.theme;
        
        // Apply theme
        this.applyTheme();
    }
    
    applyTheme() {
        const { theme } = this.settings;
        const html = document.documentElement;
        
        if (theme === 'dark') {
            html.style.colorScheme = 'dark';
        } else if (theme === 'light') {
            html.style.colorScheme = 'light';
        } else {
            html.style.colorScheme = '';
        }
    }
    
    async exportData() {
        try {
            const data = await this.getStorage(null);
            
            // Create export data
            const exportData = {
                settings: data.settings || {},
                blockedSites: data.blockedSites || [],
                activityLog: data.activityLog || [],
                lastResetDate: data.lastResetDate || null,
                exportDate: new Date().toISOString(),
                version: '1.0'
            };
            
            // Create blob and download
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `intentionality-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
            
            // Show success message
            this.showNotification('Data exported successfully!', 'success');
            
        } catch (error) {
            console.error('Export failed:', error);
            this.showNotification('Failed to export data', 'error');
        }
    }
    
    async clearAllData() {
        try {
            // Clear all sync storage
            await this.clearStorage();
            
            // Reset to defaults
            this.settings = { ...this.defaultSettings };
            await this.saveSettings();
            
            this.updateUI();
            this.showNotification('All data cleared successfully', 'success');
            
            // Wait a moment then redirect back to popup
            setTimeout(() => {
                window.location.href = 'popup.html';
            }, 1500);
            
        } catch (error) {
            console.error('Failed to clear data:', error);
            this.showNotification('Failed to clear data', 'error');
        }
    }
    
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 0.875rem;
            font-weight: 500;
            z-index: 10000;
            transition: all 0.3s ease;
            max-width: 280px;
            text-align: center;
            opacity: 0;
        `;
        
        // Set colors based on type
        switch (type) {
            case 'success':
                notification.style.backgroundColor = '#10b981';
                notification.style.color = 'white';
                break;
            case 'error':
                notification.style.backgroundColor = '#ef4444';
                notification.style.color = 'white';
                break;
            default:
                notification.style.backgroundColor = '#3b82f6';
                notification.style.color = 'white';
        }
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(-50%) translateY(0)';
        }, 10);
        
        // Remove after delay
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(-50%) translateY(-10px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Initialize settings manager
document.addEventListener('DOMContentLoaded', () => {
    new SettingsManager();
});