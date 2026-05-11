import { Ionicons } from "@expo/vector-icons";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { router } from "expo-router";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  User,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../lib/firebase";

export default function LoginScreen() {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // initialize Google Sign-In
    GoogleSignin.configure({
      // web client ID, not the Android/iOS one
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    });

    // listen for authentication state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        // navigate to home screen when user is authenticated
        router.replace("/home");
      } else {
        setUser(null);
      }
    });

    return unsubscribe;
  }, []);

  const handleGoogleLogin = async () => {
    try {
      setIsAuthenticating(true);

      // check if device supports Google Play Services
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });

      // get the response from Google
      const response = await GoogleSignin.signIn();
      console.log("Google Sign-In response:", response);

      const idToken = response.data?.idToken;

      if (!idToken) {
        throw new Error(
          "No ID token found from Google Sign-In. Response: " +
            JSON.stringify(response),
        );
      }

      console.log("ID Token obtained:", idToken.substring(0, 50) + "...");

      // create a Firebase credential with the Google token
      const googleCredential = GoogleAuthProvider.credential(idToken);

      // sign in to Firebase with the credential
      const userCredential = await signInWithCredential(auth, googleCredential);
      const currentUser = userCredential.user;

      console.log("Firebase sign-in successful for user:", currentUser.email);

      // check if user exists in Firestore
      const docRef = doc(db, "users", currentUser.uid);
      const docSnap = await getDoc(docRef);

      // if new user, create full profile
      if (!docSnap.exists()) {
        await setDoc(docRef, {
          name: currentUser.displayName || "",
          username: currentUser.displayName || "user",
          email: currentUser.email,
          role: "user",
          provider: "google",
          photoURL: currentUser.photoURL || "",
        });
        console.log("New user profile created in Firestore");
      } else {
        console.log("Existing user profile found");
      }

      // navigation will be handled by the auth state listener
    } catch (error: any) {
      console.error("Google Sign-In error:", error);
      Alert.alert(
        "Login Failed",
        error.message || "An error occurred during Google sign in.",
      );
    } finally {
      setIsAuthenticating(false);
    }
  };

  // don't render login screen if user is already authenticated
  if (user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#1A1C1A" />
          <Text style={{ marginTop: 20, textAlign: "center" }}>
            Signing you in...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

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
            onPress={handleGoogleLogin}
            disabled={isAuthenticating}
          >
            {isAuthenticating ? (
              <ActivityIndicator color="#1A1C1A" size="small" />
            ) : (
              <Ionicons name="logo-google" size={20} color="#1A1C1A" />
            )}
            <Text style={styles.buttonText}>
              {isAuthenticating ? "Signing in..." : "Sign in with Google"}
            </Text>
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
    flex: 1,
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
  },
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
    gap: 16,
    shadowColor: "#1A1C1A",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.04,
    shadowRadius: 32,
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
