import { Ionicons } from "@expo/vector-icons";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { router } from "expo-router";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import React, { useEffect, useState, useRef } from "react";
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
  
  // Use a ref to prevent onAuthStateChanged from routing prematurely during a manual login
  const isManualLogin = useRef(false);

  // states for email/password login and role
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");

  useEffect(() => {
    // initialize google sign-in
    GoogleSignin.configure({
      // web client id, not the android/ios one
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    });

    // listen for authentication state changes
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Only auto-route if the user is already logged in upon opening the app.
        // If they are actively logging in, we let the manual login functions handle the routing.
        if (!isManualLogin.current) {
          router.replace("/home");
        }
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
      isManualLogin.current = true; // Lock the auto-router
      
      // sign in to firebase with email and password
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // verify the user's role from firestore
      const docRef = doc(db, "users", userCredential.user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const userData = docSnap.data();
        if (userData.role !== role) {
          // sign them back out if the roles do not match
          await signOut(auth);
          setUser(null); // reset state to remove loading screen
          throw new Error(`Access denied. This account does not have ${role} privileges.`);
        }
      } else {
        // Fallback if they somehow have an auth account but no firestore document
        await signOut(auth);
        setUser(null);
        throw new Error("User profile not found in database. Please register.");
      }

      console.log("Firebase email sign-in successful for user:", userCredential.user.email);
      
      // Validation passed securely, manually route to home
      router.replace("/home");

    } catch (error: any) {
      console.error("Email Sign-In error:", error);
      Alert.alert(
        "Login Failed",
        error.message || "Invalid email or password."
      );
    } finally {
      setIsAuthenticating(false);
      isManualLogin.current = false; // Unlock the router
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setIsAuthenticating(true);
      isManualLogin.current = true; // Lock the auto-router

      // check if device supports google play services
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });

      // get the response from google
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken;

      if (!idToken) {
        throw new Error(
          "No ID token found from Google Sign-In. Response: " +
            JSON.stringify(response),
        );
      }

      // create a firebase credential with the google token
      const googleCredential = GoogleAuthProvider.credential(idToken);

      // sign in to firebase with the credential
      const userCredential = await signInWithCredential(auth, googleCredential);
      const currentUser = userCredential.user;

      // check if user exists in firestore
      const docRef = doc(db, "users", currentUser.uid);
      const docSnap = await getDoc(docRef);

      // if new user, create full profile and assign the role they selected
      if (!docSnap.exists()) {
        await setDoc(docRef, {
          name: currentUser.displayName || "",
          username: currentUser.displayName || "user",
          email: currentUser.email,
          role: role, 
          provider: "google",
          photoURL: currentUser.photoURL || "",
        });
        console.log("New user profile created in Firestore");
        router.replace("/home");
      } else {
        const userData = docSnap.data();
        
        // Ensure their existing Google account matches the role they selected
        if (userData.role !== role) {
          await signOut(auth);
          await GoogleSignin.signOut(); // Sign out of Google locally too so they aren't stuck on the wrong account
          setUser(null);
          throw new Error(`Access denied. This account does not have ${role} privileges.`);
        }
        
        console.log("Existing user profile found and validated");
        router.replace("/home");
      }

    } catch (error: any) {
      console.error("Google Sign-In error:", error);
      Alert.alert(
        "Login Failed",
        error.message || "An error occurred during Google sign in.",
      );
    } finally {
      setIsAuthenticating(false);
      isManualLogin.current = false; // Unlock the router
    }
  };

  // navigate to register screen
  const navigateToRegister = () => {
    router.push("/register");
  };

  // don't render login screen if user is already authenticated (but validation passes)
  if (user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#1A1C1A" />
          <Text style={{ marginTop: 20, textAlign: "center", fontFamily: "Inter_400Regular" }}>
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
          {/* role selection radio buttons */}
          <View style={styles.roleContainer}>
            <TouchableOpacity
              style={styles.radioOption}
              onPress={() => setRole("user")}
              disabled={isAuthenticating}
            >
              <View style={[styles.radioCircle, role === "user" && styles.radioCircleSelected]}>
                {role === "user" && <View style={styles.radioInner} />}
              </View>
              <Text style={styles.radioText}>As User</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.radioOption}
              onPress={() => setRole("admin")}
              disabled={isAuthenticating}
            >
              <View style={[styles.radioCircle, role === "admin" && styles.radioCircleSelected]}>
                {role === "admin" && <View style={styles.radioInner} />}
              </View>
              <Text style={styles.radioText}>As Admin</Text>
            </TouchableOpacity>
          </View>

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
    marginBottom: 40,
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
  roleContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    marginBottom: 20,
  },
  radioOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#8C8886",
    justifyContent: "center",
    alignItems: "center",
  },
  radioCircleSelected: {
    borderColor: "#A12124",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#A12124",
  },
  radioText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#59413F",
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