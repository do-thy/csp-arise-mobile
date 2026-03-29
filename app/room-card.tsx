import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

type ARCardProps = {
  roomName: string;
  description?: string;
};

export default function RoomCard({ 
  roomName, 
  description = "This room is primarily used for lectures, desktop hands-on activities, and software development presentations. Please ensure all hardware is powered down after use." 
}: ARCardProps) {
  return (
    <View style={styles.card}>
      {/* top: room name */}
      <View style={styles.header}>
        <Text style={styles.title}>{roomName}</Text>
      </View>
      
      {/* middle: description */}
      <View style={styles.descriptionContainer}>
        <Text style={styles.descriptionLabel}>DESCRIPTION</Text>
        <Text style={styles.descriptionText}>{description}</Text>
      </View>

      {/* bottom: "more info" button */}
      <View style={styles.button}>
        <Text style={styles.buttonText}>MORE INFO</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 320,
    minHeight: 460,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    borderColor: '#FFDAD7',
    borderWidth: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1.5,
    color: '#1A1C1A',
    lineHeight: 40,
  },
  descriptionContainer: {
    flex: 1,
    borderTopWidth: 2,
    borderTopColor: '#FAF9F6',
    paddingTop: 16,
    marginBottom: 24,
  },
  descriptionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#78716C',
    marginBottom: 8,
    letterSpacing: 1,
  },
  descriptionText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#1C1917',
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#A12124',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  }
});