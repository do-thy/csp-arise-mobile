import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LoginScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* subtle background texture placeholder */}
        <View style={styles.textureOverlay} />

        {/* branding section */}
        <View style={styles.brandingSection}>
          {/* logo icon */}
          <View style={styles.logoContainer}>
            <View style={styles.logoInnerSquare} />
          </View>

          {/* heading */}
          <Text style={styles.headingText}>ARISE</Text>

          {/* catchphrase */}
          <Text style={styles.catchphraseText}>
            Augmented Reality Interactive Spatial Explorer
          </Text>
        </View>

        {/* authentication container */}
        <View style={styles.authContainer}>
          {/* google oauth button */}
          <TouchableOpacity
            style={styles.googleButton}
            onPress={() => router.replace("/home")}
          >
            <Ionicons name="logo-google" size={20} color="#1A1C1A" />
            <Text style={styles.buttonText}>Sign in with Google</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FAF9F6",
  },
  container: {
    flex: 1, // flex: 1 to let the container take over the entire screen
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  textureOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    opacity: 0.03,
    // add background image logic here
  },

  /* branding styles */
  brandingSection: {
    alignItems: "center",
    width: "100%",
    maxWidth: 384,
    marginBottom: 64,
    zIndex: 1,
  },
  logoContainer: {
    width: 80,
    height: 80,
    backgroundColor: "#F4F3F1",
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 32,
  },
  logoInnerSquare: {
    width: 40,
    height: 40,
    backgroundColor: "#A12124",
  },
  headingText: {
    fontFamily: "Manrope_700Bold",
    fontWeight: "700",
    fontSize: 36,
    letterSpacing: 1.8,
    color: "#1A1C1A",
    textAlign: "center",
    marginBottom: 8,
  },
  catchphraseText: {
    fontFamily: "Inter_400Regular",
    fontWeight: "400",
    fontSize: 16,
    letterSpacing: 0.4,
    color: "#59413F",
    opacity: 0.8,
    textAlign: "center",
  },

  /* authentication styles */
  authContainer: {
    width: 342,
    height: 72,
    backgroundColor: "#F4F3F1",
    borderRadius: 36,
    padding: 8,
    zIndex: 1,
  },
  googleButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    gap: 16, // space between icon and text
    // shadow properties for iOS
    shadowColor: "#1A1C1A",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.04,
    shadowRadius: 32,
    // elevation for Android shadow
    elevation: 3,
  },
  buttonText: {
    fontFamily: "Inter_400Regular",
    fontWeight: "600",
    fontSize: 14,
    letterSpacing: -0.35,
    color: "#1A1C1A",
  },
});
