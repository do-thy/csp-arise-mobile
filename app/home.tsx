import { router } from "expo-router";
import { Button, StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text>Mock Home Screen</Text>

      <Button
        title="Placard Scanner"
        onPress={() => router.push("/placard-scanner")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
