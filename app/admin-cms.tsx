import { router } from "expo-router";
import React, { useEffect, useState } from "react";
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

const API_BASE_URL = process.env.EXPO_PUBLIC_MAP_URL || "http://localhost:3000";

interface RoomPostBody {
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

interface RoomItem {
  _id: string;
  roomName: string;
  roomDescription: string;
  buildingName: string;
  department: string;
  ocrSearchTerms?: string[];
  asset3d?: {
    equirectangularUrl?: string;
    modelPath?: string;
    coordinateX?: number;
    coordinateY?: number;
    coordinateZ?: number;
  };
}

const normalizeSearchTerms = (terms?: string): string[] => {
  if (!terms) return [];
  return terms
    .split(",")
    .map((term) => term.trim())
    .filter(Boolean);
};

const formatAssetValue = (value?: number | string) =>
  value === undefined || value === null ? "" : String(value);

const isEmptyString = (value: string) => value.trim().length === 0;

export default function AdminCMSScreen() {
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

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

  const resetForm = () => {
    setSelectedRoomId(null);
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
  };

  const populateForm = (room: RoomItem) => {
    setSelectedRoomId(room._id);
    setRoomName(room.roomName);
    setRoomDescription(room.roomDescription);
    setBuildingName(room.buildingName);
    setDepartment(room.department);
    setOcrSearchTerms((room.ocrSearchTerms || []).join(", "));
    setEquirectangularUrl(room.asset3d?.equirectangularUrl || "");
    setModelPath(room.asset3d?.modelPath || "");
    setCoordinateX(formatAssetValue(room.asset3d?.coordinateX));
    setCoordinateY(formatAssetValue(room.asset3d?.coordinateY));
    setCoordinateZ(formatAssetValue(room.asset3d?.coordinateZ));
  };

  const fetchRooms = async () => {
    setIsLoadingRooms(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/room`);
      const jsonResponse = await response.json();

      if (!response.ok) {
        throw new Error(jsonResponse.error || "Failed to load rooms.");
      }

      setRooms(Array.isArray(jsonResponse.data) ? jsonResponse.data : []);
    } catch (error: any) {
      console.error("Failed to fetch rooms:", error);
      Alert.alert("Load Failed", error.message || "Unable to load rooms.");
    } finally {
      setIsLoadingRooms(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleSave = async () => {
    if (
      isEmptyString(roomName) ||
      isEmptyString(roomDescription) ||
      isEmptyString(buildingName) ||
      isEmptyString(department)
    ) {
      Alert.alert("Missing Fields", "Please fill out all required fields.");
      return;
    }

    try {
      setIsSubmitting(true);

      const body: RoomPostBody = {
        roomName: roomName.trim(),
        roomDescription: roomDescription.trim(),
        buildingName: buildingName.trim(),
        department: department.trim(),
        ocrSearchTerms: normalizeSearchTerms(ocrSearchTerms),
      };

      const asset3d: any = {};
      if (!isEmptyString(equirectangularUrl)) {
        asset3d.equirectangularUrl = equirectangularUrl.trim();
      }
      if (!isEmptyString(modelPath)) {
        asset3d.modelPath = modelPath.trim();
      }
      if (!isEmptyString(coordinateX)) {
        asset3d.coordinateX = Number(coordinateX.trim());
      }
      if (!isEmptyString(coordinateY)) {
        asset3d.coordinateY = Number(coordinateY.trim());
      }
      if (!isEmptyString(coordinateZ)) {
        asset3d.coordinateZ = Number(coordinateZ.trim());
      }

      if (Object.keys(asset3d).length > 0) {
        body.asset3d = asset3d;
      }

      const url = selectedRoomId
        ? `${API_BASE_URL}/api/room?id=${encodeURIComponent(selectedRoomId)}`
        : `${API_BASE_URL}/api/room`;

      const response = await fetch(url, {
        method: selectedRoomId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const jsonResponse = await response.json();

      if (!response.ok) {
        throw new Error(jsonResponse.error || "Failed to save room.");
      }

      const successMessage = selectedRoomId ? "Room updated successfully!" : "Room added successfully!";
      Alert.alert("Success", successMessage);
      resetForm();
      fetchRooms();
    } catch (error: any) {
      console.error("Save room error:", error);
      Alert.alert("Save Failed", error.message || "An error occurred while saving the room.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (roomId: string, roomNameText: string) => {
    Alert.alert(
      "Delete Room",
      `Are you sure you want to delete ${roomNameText}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setIsSubmitting(true);
              const response = await fetch(`${API_BASE_URL}/api/room?id=${encodeURIComponent(roomId)}`, {
                method: "DELETE",
              });
              const jsonResponse = await response.json();

              if (!response.ok) {
                throw new Error(jsonResponse.error || "Failed to delete room.");
              }

              Alert.alert("Deleted", "Room deleted successfully.");
              if (selectedRoomId === roomId) {
                resetForm();
              }
              fetchRooms();
            } catch (error: any) {
              console.error("Delete room error:", error);
              Alert.alert("Delete Failed", error.message || "An error occurred while deleting the room.");
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ],
    );
  };

  const handleCancelEdit = () => {
    resetForm();
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
          <View style={styles.header}>
            <TouchableOpacity onPress={navigateBack} style={styles.backButton}>
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Admin CMS</Text>
            <View style={{ width: 60 }} />
          </View>

          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>
              {selectedRoomId ? "Edit Room" : "Add New Room"}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Room Name *"
              placeholderTextColor="#8C8886"
              value={roomName}
              onChangeText={setRoomName}
              editable={!isSubmitting}
            />

            <TextInput
              style={[styles.input, styles.multilineInput]}
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
              onPress={handleSave}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {selectedRoomId ? "Update Room" : "Add Room"}
                </Text>
              )}
            </TouchableOpacity>

            {selectedRoomId && (
              <TouchableOpacity
                style={[styles.submitButton, styles.cancelButton]}
                onPress={handleCancelEdit}
                disabled={isSubmitting}
              >
                <Text style={[styles.submitButtonText, styles.cancelButtonText]}>
                  Cancel Edit
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.listSection}>
            <View style={styles.listHeader}>
              <Text style={styles.sectionTitle}>Existing Rooms</Text>
              <TouchableOpacity onPress={fetchRooms} style={styles.refreshButton}>
                <Text style={styles.refreshButtonText}>Refresh</Text>
              </TouchableOpacity>
            </View>

            {isLoadingRooms ? (
              <ActivityIndicator size="large" color="#A12124" style={{ marginTop: 24 }} />
            ) : rooms.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No rooms found.</Text>
              </View>
            ) : (
              rooms.map((room) => (
                <View key={room._id} style={styles.roomCard}>
                  <View style={styles.roomHeader}>
                    <Text style={styles.roomName}>{room.roomName}</Text>
                    <Text style={styles.roomMeta}>{room.buildingName} • {room.department}</Text>
                  </View>
                  <Text style={styles.roomDescription}>{room.roomDescription}</Text>
                  {(room.ocrSearchTerms?.length || 0) > 0 ? (
                    <Text style={styles.roomMeta}>
                      OCR terms: {room.ocrSearchTerms?.join(", ")}
                    </Text>
                  ) : null}
                  <View style={styles.roomButtons}>
                    <TouchableOpacity
                      style={[styles.roomButton, styles.editButton]}
                      onPress={() => populateForm(room)}
                      disabled={isSubmitting}
                    >
                      <Text style={styles.roomButtonText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.roomButton, styles.deleteButton]}
                      onPress={() => handleDelete(room._id, room.roomName)}
                      disabled={isSubmitting}
                    >
                      <Text style={styles.roomButtonText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
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
    paddingBottom: 40,
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
  multilineInput: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  submitButton: {
    backgroundColor: "#A12124",
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
    marginBottom: 16,
  },
  cancelButton: {
    backgroundColor: "#F1F1F1",
  },
  submitButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  cancelButtonText: {
    color: "#1A1C1A",
  },
  listSection: {
    marginTop: 24,
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  refreshButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#F1F1F1",
  },
  refreshButtonText: {
    color: "#1A1C1A",
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
  emptyState: {
    marginTop: 20,
    alignItems: "center",
  },
  emptyStateText: {
    fontFamily: "Inter_400Regular",
    color: "#6B6B6B",
    fontSize: 16,
  },
  roomCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  roomHeader: {
    marginBottom: 8,
  },
  roomName: {
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 20,
    color: "#1A1C1A",
  },
  roomMeta: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#6B6B6B",
    marginTop: 4,
  },
  roomDescription: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: "#262626",
    marginBottom: 16,
  },
  roomButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  roomButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  editButton: {
    backgroundColor: "#1A1C1A",
    marginRight: 10,
  },
  deleteButton: {
    backgroundColor: "#E73C3C",
  },
  roomButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: "#FFFFFF",
  },
});