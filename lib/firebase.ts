import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";

// web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyBkMh0QojYD4AlWvHQz4XBUScnuEh6CQ6k",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "arise-firebase-database.firebaseapp.com",
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL ?? "https://arise-firebase-database-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "arise-firebase-database",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "arise-firebase-database.firebasedatabase.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "403922722835",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? "1:403922722835:web:1f836add1c93ffc05722d6"
};

// initialize Firebase
const app = initializeApp(firebaseConfig);

// initialize Auth with React Native persistence
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

export const db = getFirestore(app);
export const rtdb = getDatabase(app);
