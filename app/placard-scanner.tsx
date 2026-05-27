import AsyncStorage from "@react-native-async-storage/async-storage";
import TextRecognition from "@react-native-ml-kit/text-recognition";
import {
  ViroARScene,
  ViroARSceneNavigator,
  ViroImage,
  ViroNode,
} from "@reactvision/react-viro";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { router } from "expo-router";
import { collection, getDocs } from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image as RNImage,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import ViewShot from "react-native-view-shot";

// room-card import
import { db } from "../lib/firebase";
import RoomCard, { RoomData } from "./room-card";

// !!! HARD-CODED IP ADDRESS OF PC SERVER
const PLACARD_COLLECTION = "placardDialogs";
const POSSIBLE_NAV_COLLECTIONS = [
  "Node_Main",
  "Node_Digital",
  "Nodes_Main",
  "Nodes_Digital",
  "navigationNodes",
  "nodes",
  "roomNodes",
  "graphNodes",
];

const normalizeSearchKey = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9\-'&/]/g, "");

const searchRoomInDocument = (data: any, normalizedTarget: string): any => {
  if (!Array.isArray(data.rooms)) return null;

  for (const room of data.rooms) {
    if (!room?.roomName) continue;
    if (normalizeSearchKey(room.roomName) !== normalizedTarget) continue;

    return {
      building: data.building ?? "",
      campus: data.campus ?? "",
      floor: data.floor ?? "",
      nodeID: data.nodeID ?? "",
      posX: data.posX,
      posY: data.posY,
      posZ: data.posZ,
      ...data,
    };
  }
  return null;
};

// Look up node data by roomName instead of nodeID
const getNavigationNodeByRoomName = async (roomName: string | undefined) => {
  if (!roomName) return null;

  const normalizedTarget = normalizeSearchKey(roomName);

  for (const collectionName of POSSIBLE_NAV_COLLECTIONS) {
    try {
      const snapshot = await getDocs(collection(db, collectionName));
      for (const doc of snapshot.docs) {
        const result = searchRoomInDocument(doc.data(), normalizedTarget);
        if (result) {
          return { docId: doc.id, ...result };
        }
      }
    } catch (error) {
      console.warn(
        `Unable to search ${collectionName} for roomName ${roomName}:`,
        error,
      );
    }
  }
  return null;
};

type RawPlacardRecord = {
  roomName?: string;
  roomDescription?: string;
  ocrSearchTerms?: string[];
  [key: string]: any;
};

const enrichPlacardRecord = async (pl: RawPlacardRecord): Promise<RoomData> => {
  // Look up full node data using roomName as foreign key
  const node = await getNavigationNodeByRoomName(pl.roomName);
  const enriched = {
    roomName: pl.roomName || "Unknown Room",
    roomDescription: pl.roomDescription || "",
    building: node?.building ?? "",
    campus: node?.campus ?? "",
    floor: node?.floor ?? "",
    nodeID: node?.nodeID ?? "",
    posX: node?.posX ?? undefined,
    posY: node?.posY ?? undefined,
    posZ: node?.posZ ?? undefined,
  };
  return enriched;
};

const fetchPlacards = async (): Promise<RawPlacardRecord[]> => {
  const snapshot = await getDocs(collection(db, PLACARD_COLLECTION));
  return snapshot.docs.map((it) => ({ id: it.id, ...it.data() }));
};

const computeMatchScore = (query: string, target: string) => {
  const normalizedQuery = normalizeSearchKey(query);
  const normalizedTarget = normalizeSearchKey(target);
  if (!normalizedQuery || !normalizedTarget) return 0;
  if (normalizedQuery === normalizedTarget) return 1;
  if (normalizedTarget.includes(normalizedQuery)) return 0.85;
  if (normalizedQuery.includes(normalizedTarget)) return 0.75;
  const minLen = Math.min(normalizedQuery.length, normalizedTarget.length);
  let shared = 0;
  for (let i = 0; i < minLen; i += 1) {
    if (normalizedQuery[i] === normalizedTarget[i]) shared += 1;
  }
  return shared / normalizedQuery.length;
};

const findExactPlacardByText = async (
  sanitizedText: string,
): Promise<RoomData | null> => {
  const allPlacards = await fetchPlacards();
  const searchKey = normalizeSearchKey(sanitizedText);

  const exact = allPlacards.find((placard) => {
    const placardKey = normalizeSearchKey(placard.roomName || "");
    const terms = Array.isArray(placard.ocrSearchTerms)
      ? placard.ocrSearchTerms
      : [];
    return (
      placardKey === searchKey ||
      terms.some((term: string) => normalizeSearchKey(term) === searchKey)
    );
  });

  if (!exact) return null;
  return enrichPlacardRecord(exact);
};

const findFuzzyPlacardCandidates = async (sanitizedText: string) => {
  const allPlacards = await fetchPlacards();
  return allPlacards
    .map((placard) => {
      const roomNameScore = computeMatchScore(
        sanitizedText,
        placard.roomName || "",
      );
      const ocrScore = Array.isArray(placard.ocrSearchTerms)
        ? Math.max(
            0,
            ...placard.ocrSearchTerms.map((term: string) =>
              computeMatchScore(sanitizedText, term),
            ),
          )
        : 0;
      return {
        placard,
        matchScore: Math.max(roomNameScore, ocrScore),
      };
    })
    .filter((item) => item.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 3);
};

// Threshold for auto-selecting a fuzzy match
const HIGH_CONFIDENCE_THRESHOLD = 0.92;
const NAV_DESTINATION_KEY = "@arise-navigation-last-destination";

const { width: screenW, height: screenH } = Dimensions.get("window");
const SCANNER_WIDTH = screenW * 0.7; // 70% of screen width
const SCANNER_HEIGHT = SCANNER_WIDTH * 1.8; // two squares tall relative to the width

// AR scene - this component lives inside the camera view
const ARScannerScene = (props: any) => {
  const { cardImageUri } = props.sceneNavigator.viroAppProps;

  return (
    <ViroARScene>
      {cardImageUri ? (
        <ViroNode position={[0, 1, -1.5]} scale={[0.6, 0.6, 0.6]}>
          <ViroImage
            source={{ uri: cardImageUri }}
            width={1}
            height={1.75} // UPDATED: 560 / 320 = 1.75 aspect ratio to prevent cropping
            resizeMode="ScaleToFill"
          />
        </ViroNode>
      ) : null}
    </ViroARScene>
  );
};

// main UI
export default function RoomScanner() {
  const viroRef = useRef<any>(null);
  const viewShotRef = useRef<any>(null); // ref for taking the snapshot

  // track exact logical dimensions of the camera view on screen
  const [viewDims, setViewDims] = useState({ width: screenW, height: screenH });

  const [isScanning, setIsScanning] = useState(false);

  // state to hold the fetched database object instead of just a string
  const [detectedRoom, setDetectedRoom] = useState<RoomData | null>(null);

  // state to hold the final rendered image of the card
  const [cardImageUri, setCardImageUri] = useState<string | null>(null);

  // NEW: Fuzzy match state
  const [fuzzyMatches, setFuzzyMatches] = useState<
    (RoomData & { matchScore: number })[]
  >([]);
  const [savedDestination, setSavedDestination] = useState<string | null>(null);

  // Fetch fuzzy matches when exact match fails
  const fetchFuzzyMatches = async (sanitizedText: string) => {
    try {
      const candidates = await findFuzzyPlacardCandidates(sanitizedText);
      if (Array.isArray(candidates) && candidates.length > 0) {
        const enrichedMatches = await Promise.all(
          candidates.map(async (match) => ({
            ...(await enrichPlacardRecord(match.placard)),
            matchScore: match.matchScore,
          })),
        );

        const topMatch = enrichedMatches[0];
        if (topMatch.matchScore >= HIGH_CONFIDENCE_THRESHOLD) {
          Vibration.vibrate(100);
          setDetectedRoom(topMatch);
          setFuzzyMatches([]);
        } else {
          Vibration.vibrate([0, 50, 100, 50]);
          setFuzzyMatches(enrichedMatches);
        }
      } else {
        Alert.alert(
          "No Matches Found",
          `Scanned & Cleaned: "${sanitizedText}". No similar rooms found in database.`,
        );
      }
    } catch (fetchError) {
      console.error("Fuzzy search error:", fetchError);
      Alert.alert(
        "Fuzzy Search Error",
        "Could not search for similar matches. Check your connection.",
      );
    }
  };

  const handleSelectFuzzyMatch = (room: RoomData) => {
    Vibration.vibrate(50); // Small tactile click
    setDetectedRoom(room);
    setFuzzyMatches([]);
  };

  const handleDismissFuzzyDropdown = () => {
    setFuzzyMatches([]);
  };

  const loadSavedDestination = async () => {
    try {
      const destination = await AsyncStorage.getItem(NAV_DESTINATION_KEY);
      if (destination) {
        setSavedDestination(destination);
      }
    } catch (error) {
      console.error("Failed to load saved destination:", error);
    }
  };

  const navigateToNavigation = async (useSavedDestination = false) => {
    if (!detectedRoom) return;

    const targetDestination = useSavedDestination
      ? savedDestination
      : undefined;
    const queryParams = [
      `startRoom=${encodeURIComponent(detectedRoom.roomName)}`,
    ];

    if (targetDestination) {
      queryParams.push(`destination=${encodeURIComponent(targetDestination)}`);
    }

    router.push(`/navigation?${queryParams.join("&")}` as any);
  };

  const calculateCropParams = (imgW: number, imgH: number) => {
    const screenRatio = viewDims.width / viewDims.height;
    const imageRatio = imgW / imgH;
    const scale =
      imageRatio > screenRatio ? imgH / viewDims.height : imgW / viewDims.width;

    const imgCenterX = imgW / 2;
    const imgCenterY = imgH / 2;
    const cropW = SCANNER_WIDTH * scale;
    const cropH = SCANNER_HEIGHT * scale;
    const cropX = imgCenterX - cropW / 2;
    const cropY = imgCenterY - cropH / 2;

    return {
      originX: Math.max(0, Math.floor(cropX)),
      originY: Math.max(0, Math.floor(cropY)),
      width: Math.floor(cropW),
      height: Math.floor(cropH),
    };
  };

  const takeScannerScreenshot = async (): Promise<string> => {
    const screenshot = await viroRef.current!.sceneNavigator.takeScreenshot(
      "scanned_image",
      false,
    );

    if (!screenshot.success) throw new Error("Failed to take screenshot");

    return screenshot.url.startsWith("file://")
      ? screenshot.url
      : `file://${screenshot.url}`;
  };

  const cropScannerImage = async (uri: string): Promise<string> => {
    const { width: imgW, height: imgH } = await new Promise<{
      width: number;
      height: number;
    }>((resolve, reject) => {
      RNImage.getSize(
        uri,
        (width, height) => resolve({ width, height }),
        reject,
      );
    });

    const preProcessRef = await ImageManipulator.manipulate(uri)
      .resize({ width: imgW, height: imgH })
      .renderAsync();

    const preProcessPhoto = await preProcessRef.saveAsync({
      compress: 1,
      format: SaveFormat.JPEG,
    });

    const cropParams = calculateCropParams(imgW, imgH);
    const imageRef = await ImageManipulator.manipulate(preProcessPhoto.uri)
      .crop(cropParams)
      .renderAsync();

    const finalPhoto = await imageRef.saveAsync({
      compress: 1,
      format: SaveFormat.JPEG,
    });

    return finalPhoto.uri;
  };

  const recognizePlacardText = async (imageUri: string): Promise<string> => {
    let result = await TextRecognition.recognize(imageUri);
    let detectedText = result.text?.trim();

    if (!detectedText) {
      const rotatedRef = await ImageManipulator.manipulate(imageUri)
        .rotate(90)
        .renderAsync();

      const rotatedPhoto = await rotatedRef.saveAsync({
        compress: 1,
        format: SaveFormat.JPEG,
      });

      result = await TextRecognition.recognize(rotatedPhoto.uri);
      detectedText = result.text?.trim();
    }

    return detectedText || "";
  };

  useEffect(() => {
    loadSavedDestination();
    if (detectedRoom && viewShotRef.current) {
      setTimeout(() => {
        viewShotRef.current
          .capture()
          .then((uri: string) => {
            setCardImageUri(uri);
          })
          .catch((err: any) => console.error("Snapshot failed", err));
      }, 300);
    } else if (!detectedRoom) {
      setCardImageUri(null);
    }
  }, [detectedRoom]);

  const handleScan = async () => {
    if (!viroRef.current || isScanning) return;

    try {
      setIsScanning(true);
      setFuzzyMatches([]);
      Vibration.vibrate(50);

      const rawImageUri = await takeScannerScreenshot();
      const croppedImageUri = await cropScannerImage(rawImageUri);
      const text = await recognizePlacardText(croppedImageUri);

      if (!text) {
        Alert.alert("No Text Found", "Could not read text inside the bounds.");
        return;
      }

      const sanitizedText = text
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[^a-z0-9\-'&/]/g, "");

      if (!sanitizedText) {
        Alert.alert("Invalid Text", "No valid characters found.");
        return;
      }

      try {
        const exactMatch = await findExactPlacardByText(sanitizedText);
        if (exactMatch) {
          Vibration.vibrate(100);
          setDetectedRoom(exactMatch);
        } else {
          await fetchFuzzyMatches(sanitizedText);
        }
      } catch (error) {
        console.error("Firestore Error:", error);
        Alert.alert("Database Error", "Could not search the room database.");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to process the image.");
    } finally {
      setIsScanning(false);
    }
  };

  // Dynamic values for overlay layout
  const topMaskHeight = (viewDims.height - SCANNER_HEIGHT) / 2;
  const sideMaskWidth = (viewDims.width - SCANNER_WIDTH) / 2;
  const isSuggestingFuzzy = fuzzyMatches.length > 0;

  // Dynamic color for scanner box
  const cornerColor = isSuggestingFuzzy ? "#FFD700" : "#ff0000";

  return (
    <View
      style={styles.container}
      onLayout={(e) =>
        setViewDims({
          width: e.nativeEvent.layout.width,
          height: e.nativeEvent.layout.height,
        })
      }
    >
      <ViroARSceneNavigator
        ref={viroRef}
        autofocus={true}
        initialScene={{ scene: ARScannerScene as any }}
        viroAppProps={{ cardImageUri }}
        style={styles.camera}
      />

      {!detectedRoom && (
        <View style={styles.overlay} pointerEvents="box-none">
          {/* Top Mask */}
          <View
            style={{ height: topMaskHeight, backgroundColor: overlayColor }}
            pointerEvents="none"
          />

          {/* Middle Row */}
          <View
            style={{ flexDirection: "row", height: SCANNER_HEIGHT }}
            pointerEvents="none"
          >
            <View
              style={{ width: sideMaskWidth, backgroundColor: overlayColor }}
            />

            <View style={styles.focusedBox}>
              <View
                style={[styles.cornerTopLeft, { borderColor: cornerColor }]}
              />
              <View
                style={[styles.cornerTopRight, { borderColor: cornerColor }]}
              />
              <View
                style={[styles.cornerBottomLeft, { borderColor: cornerColor }]}
              />
              <View
                style={[styles.cornerBottomRight, { borderColor: cornerColor }]}
              />
            </View>

            <View
              style={{ width: sideMaskWidth, backgroundColor: overlayColor }}
            />
          </View>

          {/* Bottom Mask */}
          <View
            style={{ flex: 1, backgroundColor: overlayColor }}
            pointerEvents="none"
          />

          {/* INLINE FUZZY VIEWFINDER (Positioned absolutely so it accepts touches properly) */}
          {isSuggestingFuzzy && (
            <View
              style={[
                styles.inlineFuzzyWrapper,
                { top: topMaskHeight + SCANNER_HEIGHT + 15 },
              ]}
            >
              <Text style={styles.inlineFuzzyTitle}>
                No exact match. Did you mean?
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.fuzzyPillsScroll}
              >
                {fuzzyMatches.map((match, idx) => (
                  <TouchableOpacity
                    key={`${match.roomName}-${idx}`}
                    style={styles.fuzzyPill}
                    onPress={() => handleSelectFuzzyMatch(match)}
                  >
                    <Text style={styles.fuzzyPillRoom}>{match.roomName}</Text>
                    <Text style={styles.fuzzyPillSub}>
                      {Math.round((match.matchScore || 0) * 100)}% Match
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity
                style={styles.fuzzyInlineCancel}
                onPress={handleDismissFuzzyDropdown}
              >
                <Text style={styles.fuzzyInlineCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* hidden off-screen renderer for view-shot */}
      {detectedRoom && (
        <View style={styles.hiddenOffScreen}>
          <ViewShot ref={viewShotRef} options={{ format: "png", quality: 1 }}>
            <RoomCard roomData={detectedRoom} />
          </ViewShot>
        </View>
      )}

      {/* controls */}
      <View style={styles.controlsContainer}>
        {detectedRoom ? (
          <>
            <View style={styles.navControls}>
              <TouchableOpacity
                style={styles.scanButton}
                onPress={() => navigateToNavigation(false)}
              >
                <Text style={styles.scanButtonText}>
                  Navigate from this room
                </Text>
              </TouchableOpacity>

              {savedDestination ? (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={() => navigateToNavigation(true)}
                >
                  <Text style={styles.scanButtonText}>
                    Recalibrate to {savedDestination}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => {
                Vibration.vibrate(50);
                setDetectedRoom(null);
              }}
            >
              <Text style={styles.scanButtonText}>CLOSE INFO</Text>
            </TouchableOpacity>
          </>
        ) : (
          !isSuggestingFuzzy && (
            <>
              <Text style={styles.instructionText}>
                Ensure the entire placard is inside the box.
              </Text>
              <TouchableOpacity
                style={[
                  styles.scanButton,
                  isScanning && styles.scanButtonDisabled,
                ]}
                onPress={handleScan}
                disabled={isScanning}
              >
                {isScanning ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.scanButtonText}>SCAN PLACARD</Text>
                )}
              </TouchableOpacity>
            </>
          )
        )}
      </View>
    </View>
  );
}

const overlayColor = "rgba(20, 20, 20, 0.6)";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "black" },
  camera: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject },

  hiddenOffScreen: {
    position: "absolute",
    left: -5000,
    top: 0,
  },

  focusedBox: {
    width: SCANNER_WIDTH,
    height: SCANNER_HEIGHT,
    backgroundColor: "transparent",
  },
  cornerTopLeft: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 50,
    height: 50,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 25,
  },
  cornerTopRight: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 50,
    height: 50,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 25,
  },
  cornerBottomLeft: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: 50,
    height: 50,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 25,
  },
  cornerBottomRight: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 50,
    height: 50,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 25,
  },

  controlsContainer: {
    position: "absolute",
    bottom: 50,
    width: "100%",
    alignItems: "center",
  },
  instructionText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 15,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingVertical: 5,
    paddingHorizontal: 15,
    borderRadius: 20,
    overflow: "hidden",
  },
  scanButton: {
    backgroundColor: "#D53E0F",
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "white",
  },
  clearButton: {
    backgroundColor: "#333333",
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "white",
  },
  scanButtonDisabled: { backgroundColor: "gray" },
  scanButtonText: { color: "white", fontSize: 18, fontWeight: "bold" },
  navControls: {
    width: "100%",
    gap: 10,
    alignItems: "center",
    marginBottom: 14,
  },

  // INLINE FUZZY STYLES
  inlineFuzzyWrapper: {
    position: "absolute",
    width: "100%",
    alignItems: "center",
  },
  inlineFuzzyTitle: {
    color: "#FFD700",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  fuzzyPillsScroll: {
    paddingHorizontal: 20,
    gap: 12, // React Native 0.71+ supports gap
  },
  fuzzyPill: {
    backgroundColor: "white",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 24,
    marginRight: 12, // fallback if gap isn't supported
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  fuzzyPillRoom: {
    color: "#1A1C1A",
    fontSize: 16,
    fontWeight: "800",
  },
  fuzzyPillSub: {
    color: "#A12124",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  fuzzyInlineCancel: {
    marginTop: 20,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  fuzzyInlineCancelText: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});
