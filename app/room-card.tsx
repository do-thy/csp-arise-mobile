import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// add readonly to all properties to strictly prevent mutation
export type RoomData = {
  readonly roomName: string;
  readonly roomDescription: string;
  readonly buildingName: string;
  readonly department: string;
};

type ARCardProps = {
  readonly roomData: RoomData;
};

// wrap ARCardProps in the Readonly<> utility type to satisfy the linter
export default function RoomCard({ roomData }: Readonly<ARCardProps>) {
  return (
    <View style={styles.card}>
      {/* top: room name and location details */}
      <View style={styles.header}>
        <Text style={styles.title}>{roomData.roomName}</Text>
        <Text style={styles.subtitle}>{roomData.buildingName} • {roomData.department}</Text>
      </View>
      
      {/* middle: description */}
      <View style={styles.descriptionContainer}>
        <Text style={styles.descriptionLabel}>DESCRIPTION</Text>
        <Text style={styles.descriptionText}>{roomData.roomDescription}</Text>
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A12124', 
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