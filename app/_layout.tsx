import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      {/* looks for index.tsx file and hides the top header bar */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}