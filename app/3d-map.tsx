// app/3d-map.tsx
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { StyleSheet, TouchableOpacity, View, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

const injectedViewportScript = `
  (function() {
    var meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'viewport';
      meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
      document.head.appendChild(meta);
    } else {
      meta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    }
  })();
  true;
`;

export default function ThreeDMapScreen() {
  // Pull the URL from your environment variables
  // Fallback to a safe default if the env var fails to load
  const mapUrl = process.env.EXPO_PUBLIC_MAP_URL || "https://google.com";

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* custom header for navigation */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1C1917" />
        </TouchableOpacity>
      </View>

      <WebView
        source={{ uri: mapUrl }}
        style={styles.webview}
        startInLoadingState={true}
        injectedJavaScriptBeforeContentLoaded={injectedViewportScript}
        scalesPageToFit={true}
        automaticallyAdjustContentInsets={false}
        renderLoading={() => (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#A12124" />
          </View>
        )}
        // These settings are often required for 3D/WebGL experiences to run smoothly
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowsInlineMediaPlayback={true}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FAF9F6",
  },
  header: {
    height: 60,
    justifyContent: "center",
    paddingHorizontal: 16,
    backgroundColor: "#FAF9F6",
    borderBottomWidth: 1,
    borderBottomColor: "#EAE8E3",
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  webview: {
    flex: 1,
  },
  loaderContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FAF9F6",
  },
});