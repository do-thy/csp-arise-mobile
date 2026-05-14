// app/3d-map.tsx
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, TouchableOpacity, View, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { getIdToken } from "firebase/auth";
import { auth } from "../lib/firebase";

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

const appendQueryParam = (url: string, key: string, value: string) => {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set(key, value);
    return parsed.toString();
  } catch {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
  }
};

export default function ThreeDMapScreen() {
  const baseMapUrl = process.env.EXPO_PUBLIC_MAP_URL || "https://google.com";
  const [webViewUrl, setWebViewUrl] = useState(baseMapUrl);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setWebViewUrl(baseMapUrl);
      return;
    }

    let isMounted = true;
    const attachToken = async () => {
      try {
        const idToken = await getIdToken(user, true);
        if (isMounted) {
          setWebViewUrl(appendQueryParam(baseMapUrl, "mobileAuthToken", idToken));
        }
      } catch (error) {
        console.error("Failed to attach mobile auth token:", error);
        if (isMounted) {
          setWebViewUrl(baseMapUrl);
        }
      }
    };

    attachToken();
    return () => {
      isMounted = false;
    };
  }, [baseMapUrl]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1C1917" />
        </TouchableOpacity>
      </View>

      <WebView
        source={{ uri: webViewUrl }}
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