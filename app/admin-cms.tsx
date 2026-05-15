import { router } from "expo-router";
import { collection, addDoc } from "firebase/firestore";
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
import { db } from "../lib/firebase";

interface RoomData {
  roomName: string;
  roomDescription: string;
  buildingName: string;
  department: string;
  ocrSearchTerms: string[];
  asset3d?: {
    equirectangularUrl?: string;
    modelPath?: string;
    coordinateX?: number;
    coordinateY?: number;
    coordinateZ?: number;
  };
}

export default function AdminCMSScreen() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [roomDescription, setRoomDescription] = useState("");
  const [buildingName, setBuildingName] = useState("");
  const [department, setDepartment] = useState("");
  const [ocrSearchTerms, setOcrSearchTerms] = useState("");
  const [equirectangularUrl, setEquirectangularUrl] = useState("");
  const [modelPath, setModelPath] = useState("");
  const [coordinateX, setCoordinateX] = useState("");
  const [coordinateY, setCoordinateY] = useState("");
  const [coordinateZ, setCoordinateZ] = useState("");

  const handleSubmit = async () => {
    if (!roomName || !roomDescription || !buildingName || !department) {
      Alert.alert("Missing Fields", "Please fill out all required fields.");
      return;
    }

    try {
      setIsSubmitting(true);

      const roomData: RoomData = {
        roomName: roomName.trim(),
        roomDescription: roomDescription.trim(),
        buildingName: buildingName.trim(),
        department: department.trim(),
        ocrSearchTerms: ocrSearchTerms.split(",").map(term => term.trim()).filter(term => term),
      };

      // Add asset3d only if any field is provided
      const asset3d: any = {};
      if (equirectangularUrl.trim()) asset3d.equirectangularUrl = equirectangularUrl.trim();
      if (modelPath.trim()) asset3d.modelPath = modelPath.trim();
      if (coordinateX.trim()) asset3d.coordinateX = parseFloat(coordinateX);
      if (coordinateY.trim()) asset3d.coordinateY = parseFloat(coordinateY);
      if (coordinateZ.trim()) asset3d.coordinateZ = parseFloat(coordinateZ);

      if (Object.keys(asset3d).length > 0) {
        roomData.asset3d = asset3d;
      }

      // Add to Firestore "rooms" collection
      await addDoc(collection(db, "rooms"), roomData);

      Alert.alert("Success", "Room added successfully!");
      
      // Clear form
      setRoomName("");
      setRoomDescription("");
      setBuildingName("");
      setDepartment("");
      setOcrSearchTerms("");
      setEquirectangularUrl("");
      setModelPath("");
      setCoordinateX("");
      setCoordinateY("");
      setCoordinateZ("");

    } catch (error: any) {
      console.error("Submit error:", error);
      Alert.alert(
        "Submission Failed",
        error.message || "An error occurred while adding the room.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const navigateBack = () => {
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
          {/* header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={navigateBack} style={styles.backButton}>
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Admin CMS</Text>
            <View style={{ width: 60 }} />
          </View>

          {/* form section */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Add New Room</Text>

            <TextInput
              style={styles.input}
              placeholder="Room Name *"
              placeholderTextColor="#8C8886"
              value={roomName}
              onChangeText={setRoomName}
              editable={!isSubmitting}
            />

            <TextInput
              style={styles.input}
              placeholder="Room Description *"
              placeholderTextColor="#8C8886"
              value={roomDescription}
              onChangeText={setRoomDescription}
              multiline
              editable={!isSubmitting}
            />

            <TextInput
              style={styles.input}
              placeholder="Building Name *"
              placeholderTextColor="#8C8886"
              value={buildingName}
              onChangeText={setBuildingName}
              editable={!isSubmitting}
            />

            <TextInput
              style={styles.input}
              placeholder="Department *"
              placeholderTextColor="#8C8886"
              value={department}
              onChangeText={setDepartment}
              editable={!isSubmitting}
            />

            <TextInput
              style={styles.input}
              placeholder="OCR Search Terms (comma-separated)"
              placeholderTextColor="#8C8886"
              value={ocrSearchTerms}
              onChangeText={setOcrSearchTerms}
              editable={!isSubmitting}
            />

            <Text style={styles.subSectionTitle}>3D Asset (Optional)</Text>

            <TextInput
              style={styles.input}
              placeholder="Equirectangular URL"
              placeholderTextColor="#8C8886"
              value={equirectangularUrl}
              onChangeText={setEquirectangularUrl}
              editable={!isSubmitting}
            />

            <TextInput
              style={styles.input}
              placeholder="Model Path"
              placeholderTextColor="#8C8886"
              value={modelPath}
              onChangeText={setModelPath}
              editable={!isSubmitting}
            />

            <TextInput
              style={styles.input}
              placeholder="Coordinate X"
              placeholderTextColor="#8C8886"
              value={coordinateX}
              onChangeText={setCoordinateX}
              keyboardType="numeric"
              editable={!isSubmitting}
            />

            <TextInput
              style={styles.input}
              placeholder="Coordinate Y"
              placeholderTextColor="#8C8886"
              value={coordinateY}
              onChangeText={setCoordinateY}
              keyboardType="numeric"
              editable={!isSubmitting}
            />

            <TextInput
              style={styles.input}
              placeholder="Coordinate Z"
              placeholderTextColor="#8C8886"
              value={coordinateZ}
              onChangeText={setCoordinateZ}
              keyboardType="numeric"
              editable={!isSubmitting}
            />

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>Add Room</Text>
              )}
            </TouchableOpacity>
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
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    height: 80,
    marginTop: 10,
  },
  backButton: {
    padding: 10,
  },
  backButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#1A1C1A",
  },
  headerTitle: {
    fontFamily: "Manrope_700Bold",
    fontSize: 18,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: "#1C1917",
  },
  formSection: {
    flex: 1,
    marginTop: 20,
  },
  sectionTitle: {
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 32,
    color: "#1A1C1A",
    marginBottom: 24,
  },
  subSectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: "#1A1C1A",
    marginTop: 20,
    marginBottom: 12,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: "#1A1C1A",
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  submitButton: {
    backgroundColor: "#A12124",
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
    marginBottom: 40,
  },
  submitButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#FFFFFF",
  },
});