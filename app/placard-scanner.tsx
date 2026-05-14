import TextRecognition from "@react-native-ml-kit/text-recognition";
import {
  ViroARScene,
  ViroARSceneNavigator,
  ViroImage,
  ViroNode,
} from "@reactvision/react-viro";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
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
import RoomCard, { RoomData } from "./room-card";

// !!! HARD-CODED IP ADDRESS OF PC SERVER
const API_BASE_URL = process.env.EXPO_PUBLIC_MAP_URL;

// Threshold for auto-selecting a fuzzy match
const HIGH_CONFIDENCE_THRESHOLD = 0.92;

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
            width={1.0}
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
  const [fuzzyMatches, setFuzzyMatches] = useState<(RoomData & { matchScore: number })[]>([]);
  const [lastScannedText, setLastScannedText] = useState<string>("");

  // Fetch fuzzy matches when exact match fails
  const fetchFuzzyMatches = async (sanitizedText: string) => {
    try {
      const encodedText = encodeURIComponent(sanitizedText);
      const response = await fetch(
        `${API_BASE_URL}/api/room/fuzzy?scannedText=${encodedText}&limit=3`, // limited to 3 for inline UI
      );
      const jsonResponse = await response.json();

      if (response.ok && jsonResponse.data && Array.isArray(jsonResponse.data) && jsonResponse.data.length > 0) {
        const topMatch = jsonResponse.data[0];

        // AUTO-SELECT LOGIC
        if (topMatch.matchScore >= HIGH_CONFIDENCE_THRESHOLD) {
          Vibration.vibrate(100); // Quick success buzz
          setDetectedRoom(topMatch);
          setFuzzyMatches([]);
          setLastScannedText("");
        } else {
          // REQUIRE USER SELECTION
          Vibration.vibrate([0, 50, 100, 50]); // Distinct "attention needed" pattern
          setFuzzyMatches(jsonResponse.data);
          setLastScannedText(sanitizedText);
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
    setLastScannedText("");
  };

  // when a room is detected, wait a split second for the off-screen view to render, then snapshot it
  useEffect(() => {
    if (detectedRoom && viewShotRef.current) {
      setTimeout(() => {
        viewShotRef.current
          .capture()
          .then((uri: string) => {
            setCardImageUri(uri); // push the generated image to the AR scene
          })
          .catch((err: any) => console.error("Snapshot failed", err));
      }, 300); // 300ms delay to ensure proper rendering
    } else if (!detectedRoom) {
      setCardImageUri(null);
    }
  }, [detectedRoom]);

  const handleScan = async () => {
    if (!viroRef.current || isScanning) return;

    try {
      setIsScanning(true);
      setFuzzyMatches([]); // clear any old suggestions
      Vibration.vibrate(50); // Tap to indicate scan started

      // 1. take a screenshot of the Viro AR view
      const screenshot = await viroRef.current.sceneNavigator.takeScreenshot(
        "scanned_image",
        false,
      );

      if (!screenshot.success) throw new Error("Failed to take screenshot");

      const rawImageUri = screenshot.url.startsWith("file://")
        ? screenshot.url
        : `file://${screenshot.url}`;

      // 2. get the physical dimensions of the raw screenshot
      const { width: imgW, height: imgH } = await new Promise<{
        width: number;
        height: number;
      }>((resolve, reject) => {
        RNImage.getSize(
          rawImageUri,
          (w, h) => resolve({ width: w, height: h }),
          reject,
        );
      });

      // EXIF normalizer
      const preProcessRef = await ImageManipulator.manipulate(rawImageUri)
        .resize({ width: imgW, height: imgH })
        .renderAsync();

      const preProcessPhoto = await preProcessRef.saveAsync({
        compress: 1,
        format: SaveFormat.JPEG,
      });

      const readyToCropUri = preProcessPhoto.uri;

      // 3. cropping math
      const screenRatio = viewDims.width / viewDims.height;
      const imageRatio = imgW / imgH;

      let scale;
      if (imageRatio > screenRatio) {
        scale = imgH / viewDims.height;
      } else {
        scale = imgW / viewDims.width;
      }

      const imgCenterX = imgW / 2;
      const imgCenterY = imgH / 2;
      const cropW = SCANNER_WIDTH * scale;
      const cropH = SCANNER_HEIGHT * scale;
      const cropX = imgCenterX - cropW / 2;
      const cropY = imgCenterY - cropH / 2;

      // 4. crop the normalized image
      const manipulator = ImageManipulator.manipulate(readyToCropUri);
      const imageRef = await manipulator
        .crop({
          originX: Math.max(0, Math.floor(cropX)),
          originY: Math.max(0, Math.floor(cropY)),
          width: Math.floor(cropW),
          height: Math.floor(cropH),
        })
        .renderAsync();

      const finalCroppedPhoto = await imageRef.saveAsync({
        compress: 1,
        format: SaveFormat.JPEG,
      });

      // 5. pass to Google ML Kit
      let result = await TextRecognition.recognize(finalCroppedPhoto.uri);
      let validTextFound = result.text && result.text.trim().length > 0;

      // 6. Landscape Fallback
      if (!validTextFound) {
        const rotateManipulator = ImageManipulator.manipulate(
          finalCroppedPhoto.uri,
        );
        const rotatedRef = await rotateManipulator.rotate(90).renderAsync();
        const rotatedPhoto = await rotatedRef.saveAsync({
          compress: 1,
          format: SaveFormat.JPEG,
        });

        result = await TextRecognition.recognize(rotatedPhoto.uri);
        validTextFound = result.text && result.text.trim().length > 0;
      }

      // 7. Process Text & Query DB
      if (validTextFound) {
        const sanitizedText = result.text
          .toLowerCase()
          .replace(/\s+/g, "")
          .replace(/[^a-z0-9\-'&\/]/g, "");

        if (sanitizedText.length > 0) {
          const encodedText = encodeURIComponent(sanitizedText);

          try {
            const response = await fetch(
              `${API_BASE_URL}/api/room?scannedText=${encodedText}`,
            );
            const jsonResponse = await response.json();

            if (response.ok && jsonResponse.data) {
              Vibration.vibrate(100); // Exact match success
              setDetectedRoom(jsonResponse.data);
            } else {
              await fetchFuzzyMatches(sanitizedText);
            }
          } catch (fetchError) {
            console.error("Network Error:", fetchError);
            Alert.alert("Network Error", "Could not connect to the database.");
          }
        } else {
          Alert.alert("Invalid Text", "No valid characters found.");
        }
      } else {
        Alert.alert("No Text Found", "Could not read text inside the bounds.");
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
          <View style={{ height: topMaskHeight, backgroundColor: overlayColor }} pointerEvents="none" />

          {/* Middle Row */}
          <View style={{ flexDirection: "row", height: SCANNER_HEIGHT }} pointerEvents="none">
            <View style={{ width: sideMaskWidth, backgroundColor: overlayColor }} />

            <View style={styles.focusedBox}>
              <View style={[styles.cornerTopLeft, { borderColor: cornerColor }]} />
              <View style={[styles.cornerTopRight, { borderColor: cornerColor }]} />
              <View style={[styles.cornerBottomLeft, { borderColor: cornerColor }]} />
              <View style={[styles.cornerBottomRight, { borderColor: cornerColor }]} />
            </View>

            <View style={{ width: sideMaskWidth, backgroundColor: overlayColor }} />
          </View>

          {/* Bottom Mask */}
          <View style={{ flex: 1, backgroundColor: overlayColor }} pointerEvents="none" />

          {/* INLINE FUZZY VIEWFINDER (Positioned absolutely so it accepts touches properly) */}
          {isSuggestingFuzzy && (
            <View style={[styles.inlineFuzzyWrapper, { top: topMaskHeight + SCANNER_HEIGHT + 15 }]}>
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
                    key={idx}
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

              <TouchableOpacity style={styles.fuzzyInlineCancel} onPress={handleDismissFuzzyDropdown}>
                <Text style={styles.fuzzyInlineCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* hidden off-screen renderer for view-shot */}
      {detectedRoom && (
        <View style={styles.hiddenOffScreen}>
          <ViewShot ref={viewShotRef} options={{ format: "png", quality: 1.0 }}>
            <RoomCard roomData={detectedRoom} />
          </ViewShot>
        </View>
      )}

      {/* controls */}
      <View style={styles.controlsContainer}>
        {detectedRoom ? (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => {
              Vibration.vibrate(50);
              setDetectedRoom(null);
            }}
          >
            <Text style={styles.scanButtonText}>CLOSE INFO</Text>
          </TouchableOpacity>
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
  cornerTopLeft: { position: "absolute", top: 0, left: 0, width: 50, height: 50, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 25 },
  cornerTopRight: { position: "absolute", top: 0, right: 0, width: 50, height: 50, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 25 },
  cornerBottomLeft: { position: "absolute", bottom: 0, left: 0, width: 50, height: 50, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 25 },
  cornerBottomRight: { position: "absolute", bottom: 0, right: 0, width: 50, height: 50, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 25 },

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
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
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