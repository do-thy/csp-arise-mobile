import { router } from "expo-router";
import { Button, StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import React from 'react';
import { Ionicons } from '@expo/vector-icons';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        
        {/* header */}
        <View style={styles.header}>
          {/* left side of the header */}
          <View style={styles.headerLeft}>
            {/* hamburger menu (left side) */}
            <Ionicons name="menu" size={24} color="#1C1917" />
            <Text style={styles.headerTitle}>ARISE</Text>
          </View>
          {/* account (right side) */}
          <View style={styles.headerProfileCircle}>
            <Ionicons name="person" size={24} color="#1C1917" />
          </View>
        </View>

        {/* hero headline */}
        <View style={styles.heroSection}>
          <Text style={styles.heroText1}>Where are you</Text>
          <Text style={styles.heroText2}>headed today?</Text>
        </View>

        {/* button grid */}
        <View style={styles.gridContainer}>
          
          {/* row 1 */}
          <View style={styles.gridRow}>
            {/* placard scanner card */}
            <TouchableOpacity 
              style={styles.card}
              onPress={() => router.push('/placard-scanner')}>
              <View style={styles.cardIconCircle}>
                <Ionicons name="qr-code-outline" size={24} color="#1C1917" />
              </View>
              <Text style={styles.cardText}>PLACARD SCANNER</Text>
            </TouchableOpacity>

            {/* 3D map card */}
            <TouchableOpacity style={styles.card}>
              <View style={styles.cardIconCircle}>
                <Ionicons name="cube-outline" size={24} color="#1C1917" />
              </View>
              <Text style={styles.cardText}>3D MAP</Text>
            </TouchableOpacity>
          </View>

          {/* row 2 */}
          <View style={styles.gridRow}>
            {/* 2D map card */}
            <TouchableOpacity style={styles.card}>
              <View style={styles.cardIconCircle}>
                <Ionicons name="map-outline" size={24} color="#1C1917" />
              </View>
              <Text style={styles.cardText}>2D MAP</Text>
            </TouchableOpacity>

            {/* room search card */}
            <TouchableOpacity style={styles.card}>
              <View style={styles.cardIconCircle}>
                <Ionicons name="search-outline" size={24} color="#1C1917" />
              </View>
              <Text style={styles.cardText}>ROOM SEARCH</Text>
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
    backgroundColor: '#FAF9F6', // main background
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },

  // header styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 80,
    marginTop: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hamburgerIcon: {
    width: 32,
    height: 32,
    marginRight: 8,
  },
  headerTitle: {
    fontFamily: 'Manrope_700Bold', 
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 1.8,
    marginLeft: 18,
    textTransform: 'uppercase',
    color: '#1C1917',
  },
  headerProfileCircle: {
    width: 48,
    height: 48,
    backgroundColor: '#FFDAD7',
    borderRadius: 24,
    justifyContent: 'center', // center icon
    alignItems: 'center', // center icon
  },

  heroSection: {
    height: 120,
    justifyContent: 'center',
    marginTop: 20,
  },
  heroText1: {
    fontFamily: 'Manrope_800ExtraBold',
    fontWeight: '800',
    fontSize: 48,
    letterSpacing: -2.4,
    color: '#1A1C1A',
  },
  heroText2: {
    fontFamily: 'Manrope_800ExtraBold',
    fontWeight: '800',
    fontSize: 48,
    letterSpacing: -2.4,
    color: '#A12124',
  },

  // grid styles
  gridContainer: {
    marginTop: 20,
    gap: 16, // space between rows
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16, // space between columns
  },
  card: {
    flex: 1, // equal card spacing
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    height: 128,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    gap: 16,
  },
  cardIconCircle: {
    width: 48,
    height: 48,
    backgroundColor: '#FFDAD7',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center', 
  },
  cardText: {
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.6,
    color: '#78716C',
  },
});