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
  View,
} from "react-native";
import ViewShot from "react-native-view-shot";

// room-card import
import RoomCard, { RoomData } from "./room-card";

// !!! HARD-CODED IP ADDRESS OF PC SERVER (cannot do localhost because phone thinks that itself is the server)
const API_BASE_URL = "http://192.168.120.236:3000";

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

  // state to hold the fetched database object instead of just a string
  const [detectedRoom, setDetectedRoom] = useState<RoomData | null>(null);

  // state to hold the final rendered image of the card
  const [cardImageUri, setCardImageUri] = useState<string | null>(null);

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

      // 5. pass to Google ML Kit (Attempt 1: Standard Orientation)
      let result = await TextRecognition.recognize(finalCroppedPhoto.uri);
      let validTextFound = result.text && result.text.trim().length > 0;

      // 6. Landscape Fallback (Attempt 2: Rotated 90 Degrees)
      if (!validTextFound) {
        console.log("No text found. Attempting 90-degree landscape rotation fallback...");
        
        const rotateManipulator = ImageManipulator.manipulate(finalCroppedPhoto.uri);
        const rotatedRef = await rotateManipulator.rotate(90).renderAsync();
        const rotatedPhoto = await rotatedRef.saveAsync({
          compress: 1,
          format: SaveFormat.JPEG,
        });

        // re-run OCR on the rotated image
        result = await TextRecognition.recognize(rotatedPhoto.uri);
        validTextFound = result.text && result.text.trim().length > 0;
      }

      // 7. Process Text & Query the Next.js database API
      if (validTextFound) {
        // Strict text sanitization
        const sanitizedText = result.text
          .toLowerCase() // convert to lowercase
          .replace(/\s+/g, "") // strip all spaces and newlines
          .replace(/[^a-z0-9\-'&\/]/g, ""); // keep ONLY letters, numbers, dashes, and apostrophes

        if (sanitizedText.length > 0) {
          // securely encode the text so weird characters don't break the url
          const encodedText = encodeURIComponent(sanitizedText);

          try {
            const response = await fetch(
              `${API_BASE_URL}/api/room?scannedText=${encodedText}`,
            );
            const jsonResponse = await response.json();

            if (response.ok && jsonResponse.data) {
              // room found! push the database object into state
              setDetectedRoom(jsonResponse.data);
            } else {
              // room not found in database
              Alert.alert(
                "Room Not Found",
                `Scanned & Cleaned: "${sanitizedText}". This is not in our database.`,
              );
            }
          } catch (fetchError) {
            console.error("Network Error:", fetchError);
            Alert.alert(
              "Network Error",
              "Could not connect to the database server. Check your computer's IP address.",
            );
          }
        } else {
          Alert.alert("Invalid Text", "Text was detected, but no valid alphanumeric characters were found after cleaning.");
        }
      } else {
        Alert.alert("No Text Found", "Could not read text inside the bounds, even after rotation.");
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
      {!detectedRoom && (
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
      {detectedRoom && (
        <View style={styles.hiddenOffScreen}>
          <ViewShot ref={viewShotRef} options={{ format: "png", quality: 1.0 }}>
            {/* pass the entire fetched object down to the card */}
            <RoomCard roomData={detectedRoom} />
          </ViewShot>
        </View>
      )}

      {/* controls */}
      <View style={styles.controlsContainer}>
        {detectedRoom ? (
          // if a room is detected, show a button to clear it to scan again
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setDetectedRoom(null)}
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
});