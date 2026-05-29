import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.flockos.app',
  appName: 'FlockOS',
  webDir: 'www',

  // Load the main app shell directly
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
  },

  ios: {
    // Allow mixed content for GAS API calls
    allowsLinkPreview: false,
    scrollEnabled: true,
    contentInset: 'automatic',
    backgroundColor: '#1a1a2e',
  },

  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#1a1a2e',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1a1a2e',
    },
  },
};

export default config;
