import { router } from 'expo-router';
import { StyleSheet, Text, View, Button } from 'react-native';

export default function LoginScreen() {
  return (
    <View style={styles.container}>
      <Text>Mock Login Screen</Text>

      <Button 
        title="Mock Login" 
        onPress={() => router.replace('/home')} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, // flex: 1 to let the container take over the enitre screen
    justifyContent: 'center',
    alignItems: 'center',
  },
});