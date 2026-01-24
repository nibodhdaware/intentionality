// Firebase configuration disabled for security
// Firebase integration has been removed to enhance security and eliminate login requirements
// This file is kept for compatibility but no longer initializes Firebase

// Create a fallback db object that uses Chrome storage
window.db = {
    collection: () => ({
        doc: () => ({
            get: () =>
                Promise.resolve({ exists: false, data: () => null }),
            set: () => Promise.resolve(),
            add: () => Promise.resolve(),
        }),
    }),
};

console.log("Firebase integration disabled - using local storage only");
