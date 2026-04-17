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
  Image as RNImage, // for debugging
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import ViewShot from "react-native-view-shot";

// room-card import
import RoomCard from "./room-card";

const { width: screenW, height: screenH } = Dimensions.get("window");
const SCANNER_WIDTH = screenW * 0.7; // 70% of screen width
const SCANNER_HEIGHT = SCANNER_WIDTH * 1.8; // two squares tall relative to the width

// AR scene - this component lives inside the camera view
const ARScannerScene = (props: any) => {
  const { cardImageUri } = props.sceneNavigator.viroAppProps;

  return (
    <ViroARScene>
      {cardImageUri ? (
        // renders the room-card
        <ViroNode position={[0, 0, -1.5]} scale={[0.6, 0.6, 0.6]}>
          <ViroImage
            source={{ uri: cardImageUri }}
            width={1.0}
            height={1.43} // 460 / 320 = ~1.43 aspect ratio
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
  const [debugImage, setDebugImage] = useState<string | null>(null);

  // state for hardcoded logic
  const [detectedRoomName, setDetectedRoomName] = useState<string | null>(null);

  // state to hold the final rendered image of the card
  const [cardImageUri, setCardImageUri] = useState<string | null>(null);

  // when a room is detected, wait a split second for the off-screen view to render, then snapshot it
  useEffect(() => {
    if (detectedRoomName && viewShotRef.current) {
      setTimeout(() => {
        viewShotRef.current
          .capture()
          .then((uri: string) => {
            setCardImageUri(uri); // push the generated image to the AR scene
          })
          .catch((err: any) => console.error("Snapshot failed", err));
      }, 300); // 300ms delay to ensure proper rendering
    } else if (!detectedRoomName) {
      setCardImageUri(null);
    }
  }, [detectedRoomName]);

  const handleScan = async () => {
    if (!viroRef.current || isScanning) return;

    try {
      setIsScanning(true);

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

      // EXIF normalizer - force the engine to redraw the pixels upright to bypass the Android EXIF bug
      // somehow necessary as without it the image cropping is completely inaccurate from the bounding box preview
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

      // find the center of the physical image
      const imgCenterX = imgW / 2;
      const imgCenterY = imgH / 2;

      // calculate the size of the crop box in physical pixels
      const cropW = SCANNER_WIDTH * scale;
      const cropH = SCANNER_HEIGHT * scale;

      // center the crop box on the physical image center
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

      // [DEBUG ONLY] show cropped image in debug modal
      // setDebugImage(finalCroppedPhoto.uri);

      // 5. pass to Google ML Kit
      const result = await TextRecognition.recognize(finalCroppedPhoto.uri);

      // 6. hardcoded logic check (to be replaced by database query in the future)
      if (result.text && result.text.trim().length > 0) {
        // normalize text to catch weird spacing or capitalizations from OCR
        const normalizedText = result.text
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim();

        if (
          normalizedText.includes("computer laboratory 1") ||
          normalizedText.includes("comp lab 1")
        ) {
          // push data into the state, triggering the useEffect above to snapshot the card
          setDetectedRoomName("Computer Laboratory 1");
        } else {
          Alert.alert(
            "Room Not Found",
            `Scanned: "${result.text}". This is not in our database.`,
          );
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
      {/* ViroARSceneNavigator */}
      <ViroARSceneNavigator
        ref={viroRef}
        autofocus={true}
        initialScene={{ scene: ARScannerScene as any }}
        viroAppProps={{ cardImageUri }} // pass the snapshot URI to the AR world
        style={styles.camera}
      />

      {/* visual dark overlay - hidden when a room card is displayed */}
      {!detectedRoomName && (
        <View style={styles.overlay} pointerEvents="none">
          <View
            style={{
              height: (viewDims.height - SCANNER_HEIGHT) / 2,
              backgroundColor: overlayColor,
            }}
          />

          <View style={{ flexDirection: "row", height: SCANNER_HEIGHT }}>
            <View
              style={{
                width: (viewDims.width - SCANNER_WIDTH) / 2,
                backgroundColor: overlayColor,
              }}
            />

            <View style={styles.focusedBox}>
              <View style={styles.cornerTopLeft} />
              <View style={styles.cornerTopRight} />
              <View style={styles.cornerBottomLeft} />
              <View style={styles.cornerBottomRight} />
            </View>

            <View
              style={{
                width: (viewDims.width - SCANNER_WIDTH) / 2,
                backgroundColor: overlayColor,
              }}
            />
          </View>

          <View style={{ flex: 1, backgroundColor: overlayColor }} />
        </View>
      )}

      {/* mounted off-screen so the user never sees it, but ViewShot captures it */}
      {detectedRoomName && (
        <View style={styles.hiddenOffScreen}>
          <ViewShot ref={viewShotRef} options={{ format: "png", quality: 1.0 }}>
            <RoomCard roomName={detectedRoomName} />
          </ViewShot>
        </View>
      )}

      {/* controls */}
      <View style={styles.controlsContainer}>
        {detectedRoomName ? (
          // if a room is detected, show a button to clear it to scan again
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setDetectedRoomName(null)}
          >
            <Text style={styles.scanButtonText}>CLOSE INFO</Text>
          </TouchableOpacity>
        ) : (
          // otherwise show the normal scan button
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
        )}
      </View>

      {/* [START] DEBUGGING ONLY (showing the modal) - COMMENTED OUT */}
      {/* <Modal visible={!!debugImage} transparent={true} animationType="fade">
        <View style={styles.debugModalContainer}>
          <Text style={styles.debugText}>Cropped Image:</Text>
          {debugImage && (
            <RNImage source={{ uri: debugImage }} style={styles.debugImage} />
          )}
          <TouchableOpacity
            style={styles.debugButton}
            onPress={() => setDebugImage(null)}
          >
            <Text style={styles.buttonText}>Close Preview</Text>
          </TouchableOpacity>
        </View>
      </Modal>
      */}
      {/* [END] DEBUGGING ONLY */}
    </View>
  );
}

const overlayColor = "rgba(20, 20, 20, 0.6)";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "black" },
  camera: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject },

  // hidden renderer style
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
    borderColor: "#ff0000",
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
    borderColor: "#ff0000",
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
    borderColor: "#ff0000",
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
    borderColor: "#ff0000",
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
  buttonText: { color: "white", fontWeight: "bold" },

  // [DEBUG ONLY] debug styles
  debugModalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  debugImage: {
    width: SCANNER_WIDTH,
    height: SCANNER_HEIGHT,
    resizeMode: "contain",
    borderWidth: 2,
    borderColor: "#00FF00",
    marginVertical: 20,
  },
  debugText: { color: "white", fontSize: 18, fontWeight: "bold" },
  debugButton: {
    backgroundColor: "#FF3B30",
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
  },
});