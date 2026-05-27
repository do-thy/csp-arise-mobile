import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { child, get, ref } from "firebase/database";
import { collection, getDocs } from "firebase/firestore";
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
import { db, rtdb } from "../lib/firebase";
import { findPath } from "../services/PathFinder";

const API_BASE_URL = process.env.EXPO_PUBLIC_MAP_URL;
const LAST_DESTINATION_KEY = "@arise-navigation-last-destination";
const SEARCH_API_LIMIT = 6;

type AriseNode = {
  nodeID: string;
  posX?: number | string;
  posY?: number | string;
  posZ?: number | string;
  neighbors?: string[];
  rooms?: any[];
};

type NodeMap = Record<string, AriseNode>;

type RoomData = {
  roomName: string;
  roomDescription?: string;
  buildingName?: string;
  department?: string;
};

const normalizeText = (value?: string) =>
  String(value || "")
    .trim()
    .toLowerCase();

const parsePosition = (value?: number | string): number | null => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const safeLabel = (node?: AriseNode) => {
  if (!node) return "Unknown waypoint";
  if (Array.isArray(node.rooms) && node.rooms.length > 0) {
    const candidate = node.rooms[0];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate;
    }
    if (typeof candidate === "object" && candidate !== null) {
      return String(
        candidate.roomName || candidate.name || candidate.id || node.nodeID,
      );
    }
  }
  if (node.nodeID && node.nodeID.trim().length > 0) {
    return node.nodeID.replaceAll("_", " ");
  }
  return "Unknown waypoint";
};

const buildRoomIndex = (nodeMap: NodeMap) => {
  const index: Record<string, string> = {};

  for (const [nodeID, node] of Object.entries(nodeMap)) {
    const normalizedNodeID = normalizeText(nodeID);
    if (normalizedNodeID) {
      index[normalizedNodeID] = nodeID;
    }

    if (node.nodeID) {
      const normalizedNodeKey = normalizeText(node.nodeID);
      if (normalizedNodeKey) {
        index[normalizedNodeKey] = nodeID;
      }
    }

    if (Array.isArray(node.rooms)) {
      node.rooms.forEach((room) => {
        let roomName = "";
        if (typeof room === "string") {
          roomName = room;
        } else if (room && typeof room === "object") {
          roomName = String(room.roomName || room.name || room.id || "");
        }
        const normalizedRoom = normalizeText(roomName);
        if (normalizedRoom) {
          index[normalizedRoom] = nodeID;
        }
      });
    }
  }

  return index;
};

const findRoomNodeID = (
  query: string,
  nodeMap: NodeMap,
  roomIndex: Record<string, string>,
) => {
  const normalized = normalizeText(query);
  if (!normalized) return null;
  if (roomIndex[normalized]) return roomIndex[normalized];

  const exactKey = Object.keys(nodeMap).find(
    (key) => normalizeText(key) === normalized,
  );
  if (exactKey) return exactKey;

  const partialMatch = Object.entries(roomIndex).find(([roomKey]) =>
    roomKey.includes(normalized),
  );
  if (partialMatch) return partialMatch[1];

  return null;
};

const getRelativeDirection = (
  from: AriseNode,
  current: AriseNode,
  next: AriseNode,
) => {
  const fromX = parsePosition(from.posX);
  const fromZ = parsePosition(from.posZ);
  const currentX = parsePosition(current.posX);
  const currentZ = parsePosition(current.posZ);
  const nextX = parsePosition(next.posX);
  const nextZ = parsePosition(next.posZ);

  if (
    fromX === null ||
    fromZ === null ||
    currentX === null ||
    currentZ === null ||
    nextX === null ||
    nextZ === null
  ) {
    return "forward";
  }

  const fx = currentX - fromX;
  const fz = currentZ - fromZ;
  const nx = nextX - currentX;
  const nz = nextZ - currentZ;

  const magA = Math.hypot(fx, fz);
  const magB = Math.hypot(nx, nz);
  if (magA === 0 || magB === 0) {
    return "forward";
  }

  const dot = fx * nx + fz * nz;
  const cosine = Math.max(-1, Math.min(1, dot / (magA * magB)));
  const angle = (Math.acos(cosine) * 180) / Math.PI;
  const cross = fx * nz - fz * nx;

  if (angle > 150) return "behind";
  if (angle < 45) return "forward";
  return cross >= 0 ? "left" : "right";
};

const createStepsFromPath = (path: AriseNode[]) => {
  if (!path || path.length === 0) return [];

  const steps: string[] = [];
  const startLabel = safeLabel(path[0]);
  const destination = safeLabel(path.at(-1));

  steps.push(`Face the room entrance of ${startLabel}.`);

  if (path.length === 1) {
    steps.push(`You are already at ${destination}.`);
    return steps;
  }

  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1];
    const current = path[index];
    const label = safeLabel(current);
    const isDestination = index === path.length - 1;

    if (index === 1) {
      steps.push(`Leave ${startLabel} and continue toward ${label}.`);
      continue;
    }

    const direction = getRelativeDirection(path[index - 2], previous, current);
    if (isDestination) {
      steps.push(`Turn ${direction} and arrive at ${label}.`);
    } else {
      steps.push(`Turn ${direction} and continue to ${label}.`);
    }
  }

  return steps;
};

const possibleRTDBPaths = [
  "nodes",
  "navigationNodes",
  "navNodes",
  "graphNodes",
  "roomNodes",
  "places",
];

const possibleFirestoreCollections = [
  "Node_Main",
  "Node_Digital",
  "Nodes_Main",
  "Nodes_Digital",
  "navigationNodes",
  "nodes",
  "roomNodes",
  "graphNodes",
];

const normalizeApiSearch = async (text: string) => {
  if (!API_BASE_URL) return [];
  const encoded = encodeURIComponent(text.trim());
  const url = `${API_BASE_URL}/api/room/fuzzy?scannedText=${encoded}&limit=${SEARCH_API_LIMIT}`;

  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    const jsonResponse = await response.json();
    if (!jsonResponse?.data || !Array.isArray(jsonResponse.data)) return [];
    return jsonResponse.data as RoomData[];
  } catch (error) {
    console.error("Room search failed:", error);
    return [];
  }
};

const buildRoomSuggestions = (nodeMap: NodeMap) => {
  const rooms: RoomData[] = [];
  const seen = new Set<string>();

  for (const node of Object.values(nodeMap)) {
    if (!Array.isArray(node.rooms)) continue;
    node.rooms.forEach((room) => {
      let roomName = "";
      if (typeof room === "string") {
        roomName = room;
      } else if (room && typeof room === "object") {
        roomName = String(room.roomName || room.name || room.id || "");
      }

      if (!roomName || seen.has(roomName)) return;
      seen.add(roomName);
      rooms.push({
        roomName,
        roomDescription: "",
      });
    });
  }

  return rooms;
};

const computeSearchScore = (text: string, query: string) => {
  const normalizedText = normalizeText(text);
  const normalizedQuery = normalizeText(query);
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

const localRoomSearch = (text: string, nodeMapArg: NodeMap | null) => {
  const query = normalizeText(text);
  if (!query || !nodeMapArg) return [];

  const candidates = buildRoomSuggestions(nodeMapArg)
    .map((room) => ({
      ...room,
      score: computeSearchScore(room.roomName, query),
    }))
    .filter((room) => room.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, SEARCH_API_LIMIT)
    .map(({ score, ...room }) => room);

  return candidates;
};

const fetchFirebaseNodes = async (): Promise<{
  nodeMap: NodeMap;
  source: string;
} | null> => {
  try {
    for (const pathKey of possibleRTDBPaths) {
      const snapshot = await get(child(ref(rtdb), pathKey));
      if (snapshot.exists()) {
        const value = snapshot.val();
        if (
          value &&
          typeof value === "object" &&
          Object.keys(value).length > 0
        ) {
          return {
            nodeMap: value as NodeMap,
            source: `RealtimeDB /${pathKey}`,
          };
        }
      }
    }
  } catch (error) {
    console.warn("RealtimeDB node lookup failed:", error);
  }

  try {
    for (const collectionName of possibleFirestoreCollections) {
      const snapshot = await getDocs(collection(db, collectionName));
      if (!snapshot.empty) {
        const nodeMap: NodeMap = {};
        snapshot.forEach((doc) => {
          const data = doc.data() as AriseNode;
          const { nodeID: _ignored, ...rest } = data;
          nodeMap[doc.id] = { ...rest, nodeID: doc.id };
        });
        return { nodeMap, source: `Firestore /${collectionName}` };
      }
    }
  } catch (error) {
    console.warn("Firestore node lookup failed:", error);
  }

  return null;
};

export default function NavigationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [startRoom, setStartRoom] = useState("");
  const [destination, setDestination] = useState("");
  const [savedDestination, setSavedDestination] = useState<string | null>(null);
  const [searchSuggestions, setSearchSuggestions] = useState<RoomData[]>([]);
  const [activeField, setActiveField] = useState<"start" | "destination">(
    "destination",
  );
  const [nodeMap, setNodeMap] = useState<NodeMap | null>(null);
  const [roomIndex, setRoomIndex] = useState<Record<string, string>>({});
  const [nodeSource, setNodeSource] = useState<string | null>(null);
  const [instructions, setInstructions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const isStartLocked = Boolean(params.startRoom);
  const isRoomSearchEnabled = Boolean(API_BASE_URL);

  useEffect(() => {
    if (params.startRoom) {
      setStartRoom(String(params.startRoom));
    }
    if (params.destination) {
      setDestination(String(params.destination));
    }
  }, [params.startRoom, params.destination]);

  useEffect(() => {
    const loadSavedDestination = async () => {
      try {
        const saved = await AsyncStorage.getItem(LAST_DESTINATION_KEY);
        if (saved) {
          setSavedDestination(saved);
        }
      } catch (error) {
        console.error("Could not load saved destination:", error);
      }
    };

    const loadNodes = async () => {
      setLoading(true);
      const result = await fetchFirebaseNodes();
      if (result) {
        setNodeMap(result.nodeMap);
        setRoomIndex(buildRoomIndex(result.nodeMap));
        setNodeSource(result.source);
      } else {
        setNodeSource(null);
      }
      setLoading(false);
    };

    loadSavedDestination();
    loadNodes();
  }, []);

  const updateSearchText = async (
    field: "start" | "destination",
    text: string,
  ) => {
    setActiveField(field);
    if (field === "start") {
      setStartRoom(text);
    } else {
      setDestination(text);
    }

    if (!isRoomSearchEnabled) {
      setSearchSuggestions(localRoomSearch(text, nodeMap));
      return;
    }

    if (text.trim().length < 2) {
      setSearchSuggestions([]);
      return;
    }

    const results = await normalizeApiSearch(text);
    if (results.length > 0) {
      setSearchSuggestions(results);
    } else {
      setSearchSuggestions(localRoomSearch(text, nodeMap));
    }
  };

  const selectSuggestion = (room: RoomData) => {
    if (activeField === "start" && !isStartLocked) {
      setStartRoom(room.roomName);
    } else {
      setDestination(room.roomName);
    }
    setSearchSuggestions([]);
  };

  const buildRoute = async () => {
    if (!startRoom.trim() || !destination.trim()) {
      Alert.alert(
        "Missing fields",
        "Please enter both a start and destination room.",
      );
      return;
    }

    if (!nodeMap) {
      setError(
        "No navigation graph was found in Firebase. Make sure room nodes are available in Realtime DB or Firestore.",
      );
      setInstructions([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const startNodeID = findRoomNodeID(startRoom, nodeMap, roomIndex);
      const destinationNodeID = findRoomNodeID(destination, nodeMap, roomIndex);

      if (!startNodeID || !destinationNodeID) {
        setError(
          `Could not match ${startNodeID ? "destination" : "start"} room to a node in the navigation graph. Try a nearby room name or scan a room placard first.`,
        );
        setInstructions([]);
        return;
      }

      const path = findPath(startNodeID, destinationNodeID, nodeMap);
      if (!path) {
        setError(
          `A path could not be found between ${startRoom} and ${destination}. If you are moving between digital and main campus, make sure your graph includes the campus entrance connection.`,
        );
        setInstructions([]);
        return;
      }

      const routeInstructions = createStepsFromPath(path);
      setInstructions(routeInstructions);
      await AsyncStorage.setItem(LAST_DESTINATION_KEY, destination.trim());
      setSavedDestination(destination.trim());
    } catch (err) {
      console.error("Route generation failed:", err);
      setError("Unable to build directions. Please try again.");
      setInstructions([]);
    } finally {
      setLoading(false);
    }
  };

  const hasSavedDestination = Boolean(savedDestination);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#1A1C1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Navigation</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flexOne}
      >
        <ScrollView contentContainerStyle={styles.contentContainer}>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Route Builder</Text>
            <Text style={styles.helpText}>
              Use a scanned placard as your starting point, or type any room
              name to begin. The app will tell you when to face the entrance and
              then provide turn-by-turn steps.
            </Text>

            <TextInput
              style={[styles.input, isStartLocked && styles.inputDisabled]}
              placeholder="Start room"
              placeholderTextColor="#9A9691"
              value={startRoom}
              onFocus={() => setActiveField("start")}
              onChangeText={(text) => updateSearchText("start", text)}
              editable={!isStartLocked}
              autoCapitalize="words"
            />
            <TextInput
              style={styles.input}
              placeholder="Destination room"
              placeholderTextColor="#9A9691"
              value={destination}
              onFocus={() => setActiveField("destination")}
              onChangeText={(text) => updateSearchText("destination", text)}
              autoCapitalize="words"
            />

            {searchSuggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                {searchSuggestions.map((room) => (
                  <TouchableOpacity
                    key={room.roomName}
                    style={styles.suggestionItem}
                    onPress={() => selectSuggestion(room)}
                  >
                    <Text style={styles.suggestionText}>{room.roomName}</Text>
                    <Text style={styles.suggestionMeta}>
                      {room.buildingName || room.department || ""}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.primaryButton,
                (!startRoom.trim() || !destination.trim()) &&
                  styles.disabledButton,
              ]}
              onPress={buildRoute}
              disabled={loading || !startRoom.trim() || !destination.trim()}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.primaryButtonText}>Build Directions</Text>
              )}
            </TouchableOpacity>

            {hasSavedDestination && (
              <Text style={styles.savedText}>
                Last saved destination: {savedDestination}
              </Text>
            )}

            {nodeSource ? (
              <Text style={styles.nodeSourceText}>
                Navigation graph loaded from {nodeSource}.
              </Text>
            ) : (
              <Text style={styles.nodeSourceText}>
                No navigation graph source detected yet.
              </Text>
            )}
          </View>

          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>Route issue</Text>
              <Text style={styles.errorMessage}>{error}</Text>
            </View>
          ) : null}

          {instructions.length > 0 ? (
            <View style={styles.instructionsCard}>
              <Text style={styles.sectionTitle}>Navigation Steps</Text>
              {instructions.map((step, index) => (
                <View key={`${step}-${index}`} style={styles.stepRow}>
                  <Text style={styles.stepIndex}>{index + 1}</Text>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.footerSpacer} />
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
  flexOne: {
    flex: 1,
  },
  header: {
    height: 70,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E8E5E1",
    backgroundColor: "#FAF9F6",
  },
  backButton: {
    marginRight: 12,
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1A1C1A",
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    marginBottom: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1A1C1A",
    marginBottom: 10,
  },
  helpText: {
    fontSize: 14,
    color: "#4A4A4A",
    marginBottom: 18,
    lineHeight: 22,
  },
  input: {
    backgroundColor: "#F7F5F2",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#1A1C1A",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E8E5E1",
  },
  inputDisabled: {
    backgroundColor: "#E8E5E1",
    color: "#78716C",
  },
  suggestionsContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E8E5E1",
    marginBottom: 16,
    overflow: "hidden",
  },
  suggestionItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0ECE7",
  },
  suggestionText: {
    fontSize: 16,
    color: "#1A1C1A",
    fontWeight: "600",
  },
  suggestionMeta: {
    fontSize: 12,
    color: "#78716C",
    marginTop: 4,
  },
  primaryButton: {
    backgroundColor: "#A12124",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  disabledButton: {
    backgroundColor: "#C9B4B1",
  },
  primaryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "800",
  },
  savedText: {
    marginTop: 14,
    fontSize: 13,
    color: "#4A4A4A",
    fontStyle: "italic",
  },
  nodeSourceText: {
    marginTop: 6,
    fontSize: 12,
    color: "#78716C",
  },
  errorCard: {
    backgroundColor: "#FEF3F2",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#F5C2C0",
    marginBottom: 18,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#A12124",
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: "#5E191B",
    lineHeight: 20,
  },
  instructionsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  stepIndex: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#A12124",
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 26,
    fontWeight: "800",
  },
  stepText: {
    flex: 1,
    color: "#1A1C1A",
    fontSize: 15,
    lineHeight: 22,
  },
  footerSpacer: {
    height: 20,
  },
});
