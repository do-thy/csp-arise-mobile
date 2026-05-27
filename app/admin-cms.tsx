import { router } from "expo-router";
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    setDoc,
} from "firebase/firestore";
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
import { db } from "../lib/firebase";

const PLACARD_COLLECTION = "placardDialogs";
const NODE_COLLECTIONS = [
  "Node_Main",
  "Node_Digital",
  "Nodes_Main",
  "Nodes_Digital",
  "navigationNodes",
  "nodes",
  "roomNodes",
  "graphNodes",
];

type NodeData = {
  roomName: string;
  nodeID: string;
  building: string;
  campus?: string;
  floor?: string;
  posX?: number;
  posY?: number;
  posZ?: number;
  [key: string]: any;
};

type PlacardItem = {
  id: string;
  roomName: string;
  roomDescription: string;
  ocrSearchTerms?: string[];
};

const normalizeSearchTerms = (terms?: string): string[] => {
  if (!terms) return [];
  return terms
    .split(",")
    .map((term) => term.trim())
    .filter(Boolean);
};

const normalizeSearchKey = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "");

const normalizeSearchTerm = (value: string) =>
  value.toLowerCase().trim().replace(/\s+/g, " ");

const computeTextScore = (text: string, query: string) => {
  const normalizedText = normalizeSearchTerm(text);
  const normalizedQuery = normalizeSearchTerm(query);

  if (!normalizedText || !normalizedQuery) return 0;
  if (normalizedText === normalizedQuery) return 1;
  if (normalizedText.includes(normalizedQuery)) return 0.9;
  if (normalizedQuery.includes(normalizedText)) return 0.8;
  if (normalizedText.startsWith(normalizedQuery)) return 0.85;

  const minLen = Math.min(normalizedText.length, normalizedQuery.length);
  let shared = 0;
  for (let i = 0; i < minLen; i += 1) {
    if (normalizedText[i] === normalizedQuery[i]) shared += 1;
  }

  return shared / normalizedQuery.length;
};

const computeNodeSearchScore = (node: NodeData, term: string) => {
  return Math.max(
    computeTextScore(node.roomName, term),
    computeTextScore(node.building || "", term),
    computeTextScore(node.campus || "", term),
    computeTextScore(node.floor || "", term),
    computeTextScore(node.nodeID || "", term),
  );
};

const isEmptyString = (value: string) => value.trim().length === 0;

const formatAssetValue = (value?: number | string) =>
  value === undefined || value === null ? "" : String(value);

const buildPlacardItem = (id: string, data: any): PlacardItem => ({
  id,
  roomName: String(data.roomName || ""),
  roomDescription: String(data.roomDescription || ""),
  ocrSearchTerms: Array.isArray(data.ocrSearchTerms)
    ? data.ocrSearchTerms.map(String)
    : [],
});

// Fetch all node entries from all node collections
const fetchAllNodes = async (): Promise<NodeData[]> => {
  const allNodes: NodeData[] = [];

  for (const collectionName of NODE_COLLECTIONS) {
    try {
      const snapshot = await getDocs(collection(db, collectionName));
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const nodeID = String(data.nodeID || docSnap.id);
        const building = String(data.building || "");
        const campus = data.campus ? String(data.campus) : undefined;
        const floor = data.floor ? String(data.floor) : undefined;
        const posX = data.posX;
        const posY = data.posY;
        const posZ = data.posZ;

        // Extract roomNames from nested rooms array
        if (Array.isArray(data.rooms)) {
          data.rooms.forEach((room: any) => {
            if (room && room.roomName) {
              allNodes.push({
                roomName: String(room.roomName),
                nodeID,
                building,
                campus,
                floor,
                posX,
                posY,
                posZ,
                ...data,
              });
            }
          });
        }
      });
    } catch (error) {
      console.warn(`Unable to load nodes from ${collectionName}:`, error);
    }
  }

  // Remove duplicates based on roomName
  const uniqueNodes = Array.from(
    new Map(allNodes.map((node) => [node.roomName, node])).values(),
  );

  return uniqueNodes.sort((a, b) => a.roomName.localeCompare(b.roomName));
};

const getNodeByRoomName = async (
  roomName: string,
): Promise<NodeData | null> => {
  const normalizedTarget = normalizeSearchKey(roomName);

  for (const collectionName of NODE_COLLECTIONS) {
    try {
      const snapshot = await getDocs(collection(db, collectionName));
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const nodeID = String(data.nodeID || docSnap.id);
        const building = String(data.building || "");
        const campus = data.campus ? String(data.campus) : undefined;
        const floor = data.floor ? String(data.floor) : undefined;

        // Search through nested rooms array for matching roomName
        if (Array.isArray(data.rooms)) {
          for (const room of data.rooms) {
            if (
              room &&
              room.roomName &&
              normalizeSearchKey(room.roomName) === normalizedTarget
            ) {
              return {
                roomName: String(room.roomName),
                nodeID,
                building,
                campus,
                floor,
                posX: data.posX,
                posY: data.posY,
                posZ: data.posZ,
                ...data,
              };
            }
          }
        }
      }
    } catch (error) {
      console.warn(`Unable to search ${collectionName}:`, error);
    }
  }
  return null;
};

export default function AdminCMSScreen() {
  const [allNodes, setAllNodes] = useState<NodeData[]>([]);
  const [placardsMap, setPlacards] = useState<Map<string, PlacardItem>>(
    new Map(),
  );
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRoomName, setSelectedRoomName] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [showNodeSelector, setShowNodeSelector] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [roomDescription, setRoomDescription] = useState("");
  const [ocrSearchTerms, setOcrSearchTerms] = useState("");

  const resetForm = () => {
    setSelectedRoomName(null);
    setSelectedNode(null);
    setRoomDescription("");
    setOcrSearchTerms("");
    setSearchTerm("");
    setShowNodeSelector(false);
  };

  const selectNode = async (node: NodeData) => {
    setSelectedNode(node);
    setSelectedRoomName(node.roomName);
    setShowNodeSelector(false);

    // Load existing placard data if it exists
    const existingPlacard = placardsMap.get(node.roomName);
    if (existingPlacard) {
      setRoomDescription(existingPlacard.roomDescription);
      setOcrSearchTerms((existingPlacard.ocrSearchTerms || []).join(", "));
    } else {
      setRoomDescription("");
      setOcrSearchTerms("");
    }
  };

  const fetchData = async () => {
    setIsLoadingData(true);
    try {
      // Load all node entries
      const nodes = await fetchAllNodes();
      setAllNodes(nodes);

      // Load all placard entries
      const placardSnapshot = await getDocs(collection(db, PLACARD_COLLECTION));
      const placardMap = new Map<string, PlacardItem>();
      placardSnapshot.forEach((docSnap) => {
        const item = buildPlacardItem(docSnap.id, docSnap.data());
        placardMap.set(item.roomName, item);
      });
      setPlacards(placardMap);
    } catch (error: any) {
      console.error("Failed to fetch data:", error);
      Alert.alert("Load Failed", error.message || "Unable to load data.");
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async () => {
    if (!selectedNode) {
      Alert.alert("Select Room", "Please select a room from the node list.");
      return;
    }

    if (isEmptyString(roomDescription)) {
      Alert.alert("Missing Fields", "Room description is required.");
      return;
    }

    try {
      setIsSubmitting(true);

      const payload: PlacardItem = {
        id: placardsMap.get(selectedNode.roomName)?.id || "",
        roomName: selectedNode.roomName,
        roomDescription: roomDescription.trim(),
        ocrSearchTerms: normalizeSearchTerms(ocrSearchTerms),
      };

      const existingPlacard = placardsMap.get(selectedNode.roomName);
      if (existingPlacard?.id) {
        // Update existing placard entry
        await setDoc(
          doc(db, PLACARD_COLLECTION, existingPlacard.id),
          {
            roomName: payload.roomName,
            roomDescription: payload.roomDescription,
            ocrSearchTerms: payload.ocrSearchTerms,
          },
          { merge: true },
        );
      } else {
        // Create new placard entry
        await addDoc(collection(db, PLACARD_COLLECTION), {
          roomName: payload.roomName,
          roomDescription: payload.roomDescription,
          ocrSearchTerms: payload.ocrSearchTerms,
        });
      }

      Alert.alert(
        "Success",
        existingPlacard
          ? "Room updated successfully!"
          : "Room added successfully!",
      );
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error("Save room error:", error);
      Alert.alert(
        "Save Failed",
        error.message || "An error occurred while saving.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (roomName: string) => {
    const existingPlacard = placardsMap.get(roomName);
    if (!existingPlacard) {
      Alert.alert("No Entry", "There is no placard entry for this room yet.");
      return;
    }

    Alert.alert(
      "Delete Entry",
      `Delete placard data for ${roomName}? This only removes the placard entry, not the navigation node.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setIsSubmitting(true);
              await deleteDoc(doc(db, PLACARD_COLLECTION, existingPlacard.id));
              Alert.alert("Deleted", "Placard entry deleted successfully.");
              resetForm();
              fetchData();
            } catch (error: any) {
              console.error("Delete error:", error);
              Alert.alert(
                "Delete Failed",
                error.message || "An error occurred.",
              );
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

  const filteredNodes = allNodes
    .map((node) => ({
      node,
      score: searchTerm ? computeNodeSearchScore(node, searchTerm) : 1,
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.node.roomName.localeCompare(b.node.roomName);
    })
    .map(({ node }) => node);

  let contentView: React.ReactNode;

  if (isLoadingData) {
    contentView = (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#A12124" />
      </View>
    );
  } else if (!selectedNode) {
    // Show node selector
    contentView = (
      <View style={styles.selectorContainer}>
        <Text style={styles.sectionTitle}>Select a Room</Text>
        <TextInput
          style={styles.input}
          placeholder="Search rooms..."
          placeholderTextColor="#8C8886"
          value={searchTerm}
          onChangeText={setSearchTerm}
          editable={!isSubmitting}
        />

        <View style={styles.nodeList}>
          {filteredNodes.length === 0 ? (
            <Text style={styles.emptyStateText}>No rooms found.</Text>
          ) : (
            filteredNodes.map((node) => {
              const existingPlacard = placardsMap.get(node.roomName);
              return (
                <TouchableOpacity
                  key={node.roomName}
                  style={styles.nodeCard}
                  onPress={() => selectNode(node)}
                  disabled={isSubmitting}
                >
                  <View style={styles.nodeHeader}>
                    <Text style={styles.nodeName}>{node.roomName}</Text>
                    {existingPlacard ? (
                      <Text style={styles.existingBadge}>Has Entry</Text>
                    ) : (
                      <Text style={styles.missingBadge}>No Entry</Text>
                    )}
                  </View>
                  <Text style={styles.nodeMeta}>
                    {node.building}
                    {node.floor ? ` • Floor ${node.floor}` : ""}
                  </Text>
                  {node.campus ? (
                    <Text style={styles.nodeMeta}>{node.campus}</Text>
                  ) : null}
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </View>
    );
  } else {
    // Show placard editor for selected node
    const existingPlacard = placardsMap.get(selectedNode.roomName);
    contentView = (
      <View style={styles.editorContainer}>
        <View style={styles.selectedNodeDisplay}>
          <Text style={styles.sectionTitle}>
            {existingPlacard ? "Edit" : "Add"} Placard Entry
          </Text>
          <View style={styles.nodeInfoBox}>
            <Text style={styles.nodeInfoLabel}>Room:</Text>
            <Text style={styles.nodeInfoValue}>{selectedNode.roomName}</Text>

            <Text style={styles.nodeInfoLabel}>Building:</Text>
            <Text style={styles.nodeInfoValue}>{selectedNode.building}</Text>

            {selectedNode.floor ? (
              <>
                <Text style={styles.nodeInfoLabel}>Floor:</Text>
                <Text style={styles.nodeInfoValue}>{selectedNode.floor}</Text>
              </>
            ) : null}

            {selectedNode.campus ? (
              <>
                <Text style={styles.nodeInfoLabel}>Campus:</Text>
                <Text style={styles.nodeInfoValue}>{selectedNode.campus}</Text>
              </>
            ) : null}

            <Text style={styles.nodeInfoLabel}>Node ID:</Text>
            <Text style={styles.nodeInfoValue}>{selectedNode.nodeID}</Text>
          </View>
        </View>

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
          placeholder="OCR Search Terms (comma-separated)"
          placeholderTextColor="#8C8886"
          value={ocrSearchTerms}
          onChangeText={setOcrSearchTerms}
          editable={!isSubmitting}
        />

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.formButton, styles.submitButton]}
            onPress={handleSave}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.submitButtonText}>
                {existingPlacard ? "Update" : "Create"} Entry
              </Text>
            )}
          </TouchableOpacity>

          {existingPlacard && (
            <TouchableOpacity
              style={[styles.formButton, styles.deleteButton]}
              onPress={() => handleDelete(selectedNode.roomName)}
              disabled={isSubmitting}
            >
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.formButton, styles.cancelButton]}
            onPress={handleCancelEdit}
            disabled={isSubmitting}
          >
            <Text style={styles.cancelButtonText}>Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

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

          {contentView}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F5F5F3",
  },
  scrollContainer: {
    paddingBottom: 32,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: "#A12124",
    fontWeight: "600",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1C1917",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  selectorContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  editorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1C1917",
    marginBottom: 16,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D0CCCB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: "#1C1917",
    marginBottom: 12,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  nodeList: {
    marginTop: 12,
  },
  nodeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#D0CCCB",
  },
  nodeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  nodeName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1C1917",
    flex: 1,
  },
  existingBadge: {
    fontSize: 12,
    color: "#FFFFFF",
    backgroundColor: "#4CAF50",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontWeight: "600",
  },
  missingBadge: {
    fontSize: 12,
    color: "#FFFFFF",
    backgroundColor: "#9E9E9E",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontWeight: "600",
  },
  nodeMeta: {
    fontSize: 13,
    color: "#6B6B6B",
    marginVertical: 2,
  },
  selectedNodeDisplay: {
    marginBottom: 20,
  },
  nodeInfoBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#D0CCCB",
    marginBottom: 16,
  },
  nodeInfoLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B6B6B",
    marginTop: 8,
  },
  nodeInfoValue: {
    fontSize: 14,
    color: "#1C1917",
    marginTop: 2,
    marginBottom: 4,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  formButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButton: {
    backgroundColor: "#A12124",
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  deleteButton: {
    backgroundColor: "#D32F2F",
  },
  deleteButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  cancelButton: {
    backgroundColor: "#9E9E9E",
  },
  cancelButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyStateText: {
    fontSize: 14,
    color: "#6B6B6B",
    fontStyle: "italic",
  },
});
