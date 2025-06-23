// Migration utility for Intentionality extension
// This utility helps migrate data from Chrome storage to Firestore

class MigrationUtility {
    constructor() {
        // Check if Firebase is available
        if (typeof firebase !== "undefined" && firebase.firestore) {
            this.db = firebase.firestore();
        } else {
            console.warn(
                "Firebase not available, migration will use Chrome storage only",
            );
            this.db = null;
        }
    }

    // Migrate all user data from Chrome storage to Firestore
    async migrateAllData() {
        try {
            if (!this.db) {
                throw new Error("Firebase not available for migration");
            }

            const userId = await this.getCurrentUserId();
            if (!userId) {
                throw new Error("No user ID available for migration");
            }

            console.log("Starting data migration for user:", userId);

            // Migrate blocked sites
            await this.migrateBlockedSites(userId);

            // Migrate activity log
            await this.migrateActivityLog(userId);

            // Migrate user settings
            await this.migrateUserSettings(userId);

            console.log("Data migration completed successfully");
            return {
                success: true,
                message: "Migration completed successfully",
            };
        } catch (error) {
            console.error("Migration failed:", error);
            return { success: false, error: error.message };
        }
    }

    // Migrate blocked sites from Chrome storage to Firestore
    async migrateBlockedSites(userId) {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.get(["blockedSites"], async (result) => {
                try {
                    const blockedSites = result.blockedSites || [];
                    if (blockedSites.length > 0 && this.db) {
                        const docRef = this.db
                            .collection("users")
                            .doc(userId)
                            .collection("settings")
                            .doc("blockedSites");

                        await docRef.set({
                            sites: blockedSites,
                            migratedAt:
                                firebase.firestore.FieldValue.serverTimestamp(),
                        });

                        console.log(
                            `Migrated ${blockedSites.length} blocked sites`,
                        );
                    }
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    // Migrate activity log from Chrome storage to Firestore
    async migrateActivityLog(userId) {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.get(["activityLog"], async (result) => {
                try {
                    const activityLog = result.activityLog || [];
                    if (activityLog.length > 0 && this.db) {
                        const activitiesRef = this.db
                            .collection("users")
                            .doc(userId)
                            .collection("activities");

                        // Batch write for better performance
                        const batch = this.db.batch();
                        let migratedCount = 0;

                        for (const activity of activityLog) {
                            // Add migration timestamp
                            const activityData = {
                                ...activity,
                                migratedAt:
                                    firebase.firestore.FieldValue.serverTimestamp(),
                            };

                            const docRef = activitiesRef.doc();
                            batch.set(docRef, activityData);
                            migratedCount++;
                        }

                        await batch.commit();
                        console.log(`Migrated ${migratedCount} activities`);
                    }
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    // Migrate user settings from Chrome storage to Firestore
    async migrateUserSettings(userId) {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.get(
                ["lastResetDate", "userInfo"],
                async (result) => {
                    try {
                        const settings = {};

                        if (result.lastResetDate) {
                            settings.lastResetDate = result.lastResetDate;
                        }

                        if (result.userInfo) {
                            settings.userInfo = result.userInfo;
                        }

                        if (Object.keys(settings).length > 0 && this.db) {
                            const docRef = this.db
                                .collection("users")
                                .doc(userId)
                                .collection("settings")
                                .doc("userSettings");

                            await docRef.set({
                                ...settings,
                                migratedAt:
                                    firebase.firestore.FieldValue.serverTimestamp(),
                            });

                            console.log("Migrated user settings");
                        }
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                },
            );
        });
    }

    // Check if migration is needed
    async checkMigrationStatus() {
        try {
            if (!this.db) {
                return {
                    needsMigration: false,
                    reason: "Firebase not available",
                };
            }

            const userId = await this.getCurrentUserId();
            if (!userId) {
                return {
                    needsMigration: false,
                    reason: "No user ID available",
                };
            }

            // Check if blocked sites exist in Firestore
            const blockedSitesDoc = await this.db
                .collection("users")
                .doc(userId)
                .collection("settings")
                .doc("blockedSites")
                .get();

            // Check if activities exist in Firestore
            const activitiesSnapshot = await this.db
                .collection("users")
                .doc(userId)
                .collection("activities")
                .limit(1)
                .get();

            const hasFirestoreData =
                blockedSitesDoc.exists || !activitiesSnapshot.empty;

            if (hasFirestoreData) {
                return {
                    needsMigration: false,
                    reason: "Data already Synced",
                };
            }

            // Check if Chrome storage has data
            return new Promise((resolve) => {
                chrome.storage.sync.get(
                    ["blockedSites", "activityLog"],
                    (result) => {
                        const hasChromeData =
                            (result.blockedSites &&
                                result.blockedSites.length > 0) ||
                            (result.activityLog &&
                                result.activityLog.length > 0);

                        resolve({
                            needsMigration: hasChromeData,
                            reason: hasChromeData
                                ? "Chrome storage has data to migrate"
                                : "No data to migrate",
                        });
                    },
                );
            });
        } catch (error) {
            console.error("Error checking migration status:", error);
            return {
                needsMigration: false,
                reason: "Error checking migration status",
            };
        }
    }

    // Get current user ID from Chrome storage
    async getCurrentUserId() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(["userInfo"], (result) => {
                const userInfo = result.userInfo;
                resolve(userInfo ? userInfo.uid : null);
            });
        });
    }

    // Clear Chrome storage after successful migration (optional)
    async clearChromeStorage() {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.clear((result) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    console.log("Chrome storage cleared after migration");
                    resolve();
                }
            });
        });
    }
}

// Export for use in other files
window.MigrationUtility = MigrationUtility;
