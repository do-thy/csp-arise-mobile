import {
  Inter_400Regular,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import {
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

// prevent the splash screen from auto-hiding before fonts load
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_700Bold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <SafeAreaProvider>
      {/* 
        default to headerShown: false for all screens, then override specifically for the register screen 
      */}
      <Stack screenOptions={{ headerShown: false }}>
        {/* Login Screen */}
        <Stack.Screen name="index" />
        
        {/* Register Screen Configuration */}
        <Stack.Screen 
          name="register" 
          options={{ 
            headerShown: true, // enable the header just for this screen
            title: "", // remove the default "register" text
            headerTransparent: true, // make the background transparent so your UI shows underneath
            headerTintColor: "#1A1C1A", // make the back arrow match your dark theme color
            headerBackTitle: "", // hides the "Back" text next to the chevron on iOS without TS errors
            animation: "slide_from_right", // smooth native sliding animation
          }} 
        />

        {/* Authenticated Screens */}
        <Stack.Screen name="home" />
        <Stack.Screen name="placard-scanner" />
      </Stack>
    </SafeAreaProvider>
  );
}