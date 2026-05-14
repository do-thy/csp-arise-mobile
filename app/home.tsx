import { Ionicons } from "@expo/vector-icons";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { router } from "expo-router";
import { signOut } from "firebase/auth";
import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../lib/firebase";

export default function HomeScreen() {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const user = auth.currentUser;

  // handle user logout logic
  const handleLogout = async () => {
    try {
      // sign out of firebase
      await signOut(auth);
      
      // attempt to sign out of google if they used oauth
      try {
        await GoogleSignin.signOut();
      } catch (e) {
        // silently ignore if they weren't signed in with google
      }
      
      // route back to login screen
      router.replace("/"); 
    } catch (error) {
      console.error("logout error:", error);
      Alert.alert("Logout Failed", "An error occurred while logging out.");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* header */}
        <View style={styles.header}>
          {/* left side of the header */}
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>ARISE</Text>
          </View>
          
          {/* account (right side) */}
          <TouchableOpacity 
            style={styles.headerProfileCircle}
            onPress={() => setShowProfileMenu(!showProfileMenu)}
          >
            <Ionicons name="person" size={24} color="#1C1917" />
          </TouchableOpacity>
        </View>

        {/* profile menu popout */}
        {showProfileMenu && (
          <View style={styles.profileMenu}>
            <Text style={styles.profileName} numberOfLines={1}>
              {user?.displayName || "User"}
            </Text>
            <Text style={styles.profileEmail} numberOfLines={1}>
              {user?.email || "No email"}
            </Text>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.logoutButtonText}>Logout</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* hero headline */}
        <View style={styles.heroSection}>
          <Text style={styles.heroText1}>Where are you</Text>
          <Text style={styles.heroText2}>headed today?</Text>
        </View>

        {/* button column */}
        <View style={styles.columnContainer}>
          {/* placard scanner card */}
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push("/placard-scanner")}
          >
            <View style={styles.cardIconCircle}>
              <Ionicons name="qr-code-outline" size={24} color="#1C1917" />
            </View>
            <Text style={styles.cardText}>PLACARD SCANNER</Text>
          </TouchableOpacity>

          {/* 3D map card */}
          <TouchableOpacity style={styles.card}>
            <View style={styles.cardIconCircle}>
              <Ionicons name="cube-outline" size={24} color="#1C1917" />
            </View>
            <Text style={styles.cardText}>3D MAP</Text>
          </TouchableOpacity>

          {/* navigation card */}
          <TouchableOpacity style={styles.card}>
            <View style={styles.cardIconCircle}>
              <Ionicons name="navigate-outline" size={24} color="#1C1917" />
            </View>
            <Text style={styles.cardText}>NAVIGATION</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FAF9F6", // main background
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },

  // header styles
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    height: 80,
    marginTop: 10,
    zIndex: 10, // ensures the popout renders above other elements
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    fontFamily: "Manrope_700Bold",
    fontWeight: "700",
    fontSize: 18,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: "#1C1917",
  },
  headerProfileCircle: {
    width: 48,
    height: 48,
    backgroundColor: "#FFDAD7",
    borderRadius: 24,
    justifyContent: "center", // center icon
    alignItems: "center", // center icon
  },

  // profile menu popout styles
  profileMenu: {
    position: "absolute",
    top: 85,
    right: 24,
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 16,
    minWidth: 200,
    shadowColor: "#1A1C1A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
    zIndex: 20,
  },
  profileName: {
    fontFamily: "Inter_700Bold",
    fontWeight: "700",
    fontSize: 16,
    color: "#1A1C1A",
    marginBottom: 4,
  },
  profileEmail: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#8C8886",
    marginBottom: 16,
  },
  logoutButton: {
    backgroundColor: "#A12124",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  logoutButtonText: {
    fontFamily: "Inter_700Bold",
    fontWeight: "700",
    fontSize: 14,
    color: "#FFFFFF",
  },

  // hero section styles
  heroSection: {
    height: 120,
    justifyContent: "center",
    marginTop: 20,
    zIndex: 1, 
  },
  heroText1: {
    fontFamily: "Manrope_800ExtraBold",
    fontWeight: "800",
    fontSize: 48,
    letterSpacing: -2.4,
    color: "#1A1C1A",
  },
  heroText2: {
    fontFamily: "Manrope_800ExtraBold",
    fontWeight: "800",
    fontSize: 48,
    letterSpacing: -2.4,
    color: "#A12124",
  },

  // column styles
  columnContainer: {
    marginTop: 20,
    gap: 16, // space between cards
    zIndex: 1,
  },
  card: {
    width: "100%", // full width for column layout
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 24,
    height: 128,
    justifyContent: "flex-start",
    alignItems: "flex-start",
    gap: 16,
  },
  cardIconCircle: {
    width: 48,
    height: 48,
    backgroundColor: "#FFDAD7",
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  cardText: {
    fontFamily: "Inter_700Bold",
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 0.6,
    color: "#78716C",
  },
});