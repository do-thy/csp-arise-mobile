import { Ionicons } from "@expo/vector-icons";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { router } from "expo-router";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  User,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../lib/firebase";

export default function LoginScreen() {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  
  // new states for email/password login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    // initialize google sign-in
    GoogleSignin.configure({
      // web client id, not the android/ios one
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

  const handleEmailLogin = async () => {
    if (!email || !password) {
      Alert.alert("Missing Fields", "Please enter both email and password.");
      return;
    }

    try {
      setIsAuthenticating(true);
      
      // sign in to firebase with email and password
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log("Firebase email sign-in successful for user:", userCredential.user.email);
      
      // navigation is handled by the auth state listener
    } catch (error: any) {
      console.error("Email Sign-In error:", error);
      Alert.alert(
        "Login Failed",
        error.message || "Invalid email or password."
      );
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setIsAuthenticating(true);

      // check if device supports google play services
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });

      // get the response from google
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

      // create a firebase credential with the google token
      const googleCredential = GoogleAuthProvider.credential(idToken);

      // sign in to firebase with the credential
      const userCredential = await signInWithCredential(auth, googleCredential);
      const currentUser = userCredential.user;

      console.log("Firebase sign-in successful for user:", currentUser.email);

      // check if user exists in firestore
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

  // navigate to register screen
  const navigateToRegister = () => {
    router.push("/register");
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

        {/* interaction section */}
        <View style={styles.interactionSection}>
          {/* email and password form */}
          <View style={styles.formContainer}>
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor="#8C8886"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isAuthenticating}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#8C8886"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              editable={!isAuthenticating}
            />
            
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleEmailLogin}
              disabled={isAuthenticating}
            >
              {isAuthenticating ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* visual divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* google oauth container */}
          <View style={styles.authContainer}>
            <TouchableOpacity
              style={styles.googleButton}
              onPress={handleGoogleLogin}
              disabled={isAuthenticating}
            >
              <Ionicons name="logo-google" size={20} color="#1A1C1A" />
              <Text style={styles.buttonText}>Google</Text>
            </TouchableOpacity>
          </View>

          {/* register prompt */}
          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>Do not have an account? </Text>
            <TouchableOpacity onPress={navigateToRegister} disabled={isAuthenticating}>
              <Text style={styles.registerLink}>Register</Text>
            </TouchableOpacity>
          </View>
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
    marginBottom: 48,
    zIndex: 1,
  },
  logoContainer: {
    width: 80,
    height: 80,
    backgroundColor: "#F4F3F1",
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
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
  interactionSection: {
    width: "100%",
    maxWidth: 342,
    zIndex: 1,
  },
  formContainer: {
    gap: 16,
    marginBottom: 24,
  },
  input: {
    height: 56,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 20,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#1A1C1A",
    borderWidth: 1,
    borderColor: "#EAE8E3",
  },
  primaryButton: {
    height: 56,
    backgroundColor: "#A12124",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#A12124",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 4,
  },
  primaryButtonText: {
    fontFamily: "Inter_400Regular",
    fontWeight: "600",
    fontSize: 16,
    color: "#FFFFFF",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#EAE8E3",
  },
  dividerText: {
    paddingHorizontal: 16,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#8C8886",
  },
  authContainer: {
    width: "100%",
    height: 72,
    backgroundColor: "#F4F3F1",
    borderRadius: 36,
    padding: 8,
  },
  googleButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    gap: 12,
    shadowColor: "#1A1C1A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  buttonText: {
    fontFamily: "Inter_400Regular",
    fontWeight: "600",
    fontSize: 14,
    letterSpacing: -0.35,
    color: "#1A1C1A",
  },
  registerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 32,
  },
  registerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#59413F",
  },
  registerLink: {
    fontFamily: "Inter_400Regular",
    fontWeight: "600",
    fontSize: 14,
    color: "#A12124",
  },
});