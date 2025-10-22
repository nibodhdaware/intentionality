# Firestore Integration Setup Guide

This guide explains how to set up Firebase Firestore for the Intentionality Chrome extension.

## Overview

The extension now uses Firebase Firestore as the primary data storage solution, with Chrome storage as a fallback. This provides:

-   **Cloud synchronization** across devices
-   **Better data persistence** and reliability
-   **Scalable storage** for user data
-   **Real-time updates** (future feature)

## Firebase Project Setup

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Enter a project name (e.g., "intentionality-extension")
4. Follow the setup wizard (you can disable Google Analytics if not needed)
5. Click "Create project"

### 2. Enable Firestore Database

1. In your Firebase project, go to "Firestore Database" in the left sidebar
2. Click "Create database"
3. Choose "Start in test mode" for development (you can secure it later)
4. Select a location close to your users
5. Click "Done"

### 3. Get Firebase Configuration

1. In your Firebase project, click the gear icon (⚙️) next to "Project Overview"
2. Select "Project settings"
3. Scroll down to "Your apps" section
4. Click the web icon (</>)
5. Register your app with a nickname (e.g., "intentionality-extension")
6. Copy the configuration object

### 4. Update Configuration

Replace the placeholder configuration in `lib/firebase-config.js` with your actual Firebase config:

```javascript
const firebaseConfig = {
    apiKey: "your-actual-api-key",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef123456",
};
```

## Data Structure

The extension uses the following Firestore structure:

```
users/
  {userId}/
    settings/
      blockedSites/
        sites: ["facebook.com", "twitter.com", ...]
        migratedAt: timestamp
      userSettings/
        lastResetDate: "Mon Dec 16 2024"
        userInfo: {...}
        migratedAt: timestamp
    activities/
      {activityId}/
        url: "https://facebook.com"
        reason: "Checking notifications"
        dumbReason: "pretty_distracted"
        timestamp: "2024-12-16T10:30:00.000Z"
        sessionDuration: 300
        createdAt: timestamp
        migratedAt: timestamp
```

## Migration Process

The extension includes an automatic migration system:

1. **Migration Detection**: When a user logs in, the extension checks if they have local data that needs migration
2. **Migration Button**: If migration is needed, a "Migrate Data to Cloud" button appears in the popup
3. **Automatic Migration**: Clicking the button migrates all local data to Firestore
4. **Fallback Support**: If Firestore is unavailable, the extension falls back to Chrome storage

## Security Rules (Optional)

For production use, you should set up Firestore security rules. Here's a basic example:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Testing the Integration

1. **Load the extension** in Chrome with your Firebase configuration
2. **Sign in** with Google through the extension
3. **Add some blocked sites** and record some activities
4. **Check Firestore** to see the data being stored
5. **Test migration** by clearing Chrome storage and checking if data persists

## Troubleshooting

### Common Issues

1. **"No user ID available"**: Make sure the user is properly signed in
2. **"Firebase not initialized"**: Check that the Firebase configuration is correct
3. **"Permission denied"**: Verify Firestore security rules allow the operation
4. **"Network error"**: Check internet connection and Firebase project status

### Debug Mode

Enable debug logging by opening the browser console and looking for:

-   `"Activity saved to Firestore successfully"`
-   `"Migrated X blocked sites"`
-   `"Data migration completed successfully"`

## Fallback Behavior

The extension gracefully handles Firestore unavailability:

-   **Blocked Sites**: Falls back to Chrome storage
-   **Activity Log**: Falls back to Chrome storage
-   **User Settings**: Falls back to Chrome storage
-   **Background Script**: Uses hybrid approach (Firestore first, then Chrome storage)

## Performance Considerations

-   **Batch Operations**: Activity migration uses batch writes for better performance
-   **Lazy Loading**: Data is loaded only when needed
-   **Caching**: Frequently accessed data is cached locally
-   **Offline Support**: Chrome storage provides offline functionality

## Future Enhancements

-   Real-time synchronization across devices
-   Advanced analytics and insights
-   Data export functionality
-   Multi-user collaboration features
