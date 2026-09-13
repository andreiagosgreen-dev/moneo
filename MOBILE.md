# Moneo Mobile App (React Native)

React Native implementation guide for Moneo mobile app.

## Architecture

- **React Native** with Expo
- **Shared Code**: 80% of business logic can be shared with web app
- **Native Features**: Push notifications, background timer, haptic feedback
- **State Management**: React Context (same as web)

## Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- iOS: Xcode (Mac only)
- Android: Android Studio

## Quick Start

### 1. Initialize Project

```bash
npx create-expo-app moneo-mobile
cd moneo-mobile
```

### 2. Install Dependencies

```bash
npm install @react-navigation/native @react-navigation/native-stack
npm install @react-native-async-storage/async-storage
npm install @supabase/supabase-js
npm install expo-sqlite expo-secure-store
npm install expo-notifications
npm install expo-device
```

### 3. Copy Shared Code

Copy these directories from web app to mobile:

```
src/lib/
src/components/ (UI components adapted for React Native)
```

### 4. Platform-Specific Adaptations

Create `App.tsx` with platform-specific code:

```tsx
import { Platform } from 'react-native';
import { useAuth } from './lib/authProvider';
import TimerCard from './components/TimerCard';

export default function App() {
  const auth = useAuth();
  
  // Background timer (only on mobile)
  useEffect(() => {
    if (Platform.OS === 'ios') {
      // Use Background Tasks API
    }
  }, []);

  return (
    <TimerCard
      // Props...
    />
  );
}
```

### 5. Push Notifications

```bash
npx expo install expo-notifications
```

```tsx
import * as Notifications from 'expo-notifications';

async function requestPermissions() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    alert('Please enable notifications for reminders');
  }
}
```

### 6. Build and Run

**Development:**
```bash
npm start
# iOS: Press 'i'
# Android: Press 'a'
```

**Production Build:**
```bash
# iOS
eas build --platform ios

# Android
eas build --platform android
```

## Feature Parity

| Feature | Web | Mobile |
|---------|-----|--------|
| Timer | ✅ | ✅ |
| Statistics | ✅ | ✅ |
| Sync | ✅ | ✅ |
| PWA | ✅ | ❌ |
| Push Notifications | ❌ | ✅ |
| Background Timer | ❌ | ✅ |
| Haptic Feedback | ❌ | ✅ |

## Shared Code Strategy

Create a `packages/shared` monorepo to share:

- `@moneo/core` - Business logic (timer, sync, storage)
- `@moneo/web` - Web-specific UI
- `@moneo/mobile` - Mobile-specific UI

## Next Steps

1. Set up Expo project
2. Copy shared `lib/` code
3. Adapt UI components for React Native
4. Implement push notifications
5. Test on iOS and Android
6. Deploy to App Store / Play Store
