import { router } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../lib/firebase";

export default function RegisterScreen() {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async () => {
    if (!fullName || !username || !email || !password) {
      Alert.alert("Missing Fields", "Please fill out all fields to register.");
      return;
    }

    try {
      setIsAuthenticating(true);

      // 1. Create the user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const currentUser = userCredential.user;

      // 2. Create the user profile document in Firestore
      await setDoc(doc(db, "users", currentUser.uid), {
        name: fullName.trim(),
        username: username.trim().toLowerCase(),
        email: currentUser.email,
        role: "user",
        provider: "email",
        photoURL: "", // Default empty or a placeholder URL
        createdAt: new Date().toISOString(),
      });

      console.log("New user registered and profile created in Firestore");

      // Navigation will typically be handled by your onAuthStateChanged listener in _layout or index,
      // but you can manually route them if needed.
      router.replace("/home");
    } catch (error: any) {
      console.error("Registration error:", error);
      Alert.alert(
        "Registration Failed",
        error.message || "An error occurred during registration.",
      );
    } finally {
      setIsAuthenticating(false);
    }
  };

  const navigateToLogin = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* subtle background texture placeholder */}
          <View style={styles.textureOverlay} />

          {/* branding section */}
          <View style={styles.brandingSection}>
            <View style={styles.logoContainer}>
              <View style={styles.logoInnerSquare} />
            </View>
            <Text style={styles.headingText}>Join ARISE</Text>
            <Text style={styles.catchphraseText}>
              Create an account to start exploring
            </Text>
          </View>

          {/* interaction section */}
          <View style={styles.interactionSection}>
            {/* registration form */}
            <View style={styles.formContainer}>
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor="#8C8886"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                editable={!isAuthenticating}
              />
              <TextInput
                style={styles.input}
                placeholder="Username"
                placeholderTextColor="#8C8886"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                editable={!isAuthenticating}
              />
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
                onPress={handleRegister}
                disabled={isAuthenticating}
              >
                {isAuthenticating ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Create Account</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* login prompt */}
            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity
                onPress={navigateToLogin}
                disabled={isAuthenticating}
              >
                <Text style={styles.loginLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FAF9F6",
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
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
    width: 64,
    height: 64,
    backgroundColor: "#F4F3F1",
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  logoInnerSquare: {
    width: 32,
    height: 32,
    backgroundColor: "#A12124",
  },
  headingText: {
    fontFamily: "Manrope_700Bold",
    fontWeight: "700",
    fontSize: 32,
    letterSpacing: 1.2,
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
  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 16,
  },
  loginText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#59413F",
  },
  loginLink: {
    fontFamily: "Inter_400Regular",
    fontWeight: "600",
    fontSize: 14,
    color: "#A12124",
  },
});
