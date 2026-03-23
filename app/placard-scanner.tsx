import TextRecognition from "@react-native-ml-kit/text-recognition";
import { CameraView, useCameraPermissions } from "expo-camera";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
  Image
} from "react-native"; // modal and image for debugging only

export default function RoomScanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);
  const [isScanning, setIsScanning] = useState(false);
  // for debugging only
  const [debugImage, setDebugImage] = useState<string | null>(null);

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>
          Your permission is needed to use the scanner.
        </Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

// triggers when the user taps the scan button
  const handleScan = async () => {
    if (!cameraRef.current || isScanning) return;

    try {
      setIsScanning(true);

      // 1. take photo
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5,
      });

      let actualWidth = photo.width;
      let actualHeight = photo.height;
      let manipulator = ImageManipulator.manipulate(photo.uri);

      // 2. fix the android "ghost rotation" bug
      // if the photo is landscape but the phone is portrait, physically rotate it upright first
      if (actualWidth > actualHeight) {
        manipulator = manipulator.rotate(90);
        actualWidth = photo.height;
        actualHeight = photo.width;
      }

      // 3. calculate the bounding box size (using foolproof reverse-scaling)
      const { width: screenW, height: screenH } = Dimensions.get("window");
      
      // find exactly how the camera feed is scaled to cover the screen
      const scale = Math.max(screenW / actualWidth, screenH / actualHeight);
      
      // calculate how many pixels of the photo are hidden off-screen
      const displayedW = actualWidth * scale;
      const displayedH = actualHeight * scale;
      const bleedX = (displayedW - screenW) / 2;
      const bleedY = (displayedH - screenH) / 2;
      
      // find where the green box is on the screen
      const uiBoxX = (screenW - SCANNER_SIZE) / 2;
      const uiBoxY = (screenH - SCANNER_SIZE) / 3;
      
      // map the green box location perfectly back onto the raw photo
      const originX = (uiBoxX + bleedX) / scale;
      const originY = (uiBoxY + bleedY) / scale;
      const cropSize = SCANNER_SIZE / scale;

      // 4. cut the image
      const imageRef = await manipulator
        .crop({ originX, originY, width: cropSize, height: cropSize })
        .renderAsync();

      const finalCroppedPhoto = await imageRef.saveAsync({
        compress: 1,
        format: SaveFormat.JPEG,
      });
      // NOTE: the cropped image is ever so slightly smaller than the bounding box (may be due to the way the scaling and cropping math works out), therefore, to compensate, users are instructed to fit the placard fully within the bounding box and not let it touch the edges, this way the placards' paddings will compensate for this minor discrepancy and ensure all the placard text is captured in the cropped photo

      // [START] DEBUGGING ONLY (showing the modal)
      setDebugImage(finalCroppedPhoto.uri);
      // [END] DEBUGGING ONLY

      // 5. pass the cropped photo's local URI directly to ML Kit
      const result = await TextRecognition.recognize(finalCroppedPhoto.uri);

      // 6. data processing goes here later

      // 7. extract the text and show the dialog box (temporary, replace with AR box later)
      if (result.text && result.text.trim().length > 0) {
        Alert.alert("", result.text); 
      } else {
        Alert.alert("No Text Found");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to process the image.");
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing="back" ref={cameraRef} />
      {/* visual dark overlay with a transparent square cutout */}
      <View style={styles.overlay}>
        <View style={styles.unfocusedTop}></View>
        <View style={styles.middleContainer}>
          <View style={styles.unfocusedSide}></View>

          {/* bounding box */}
          <View style={styles.focusedBox}>
            <View style={styles.cornerTopLeft} />
            <View style={styles.cornerTopRight} />
            <View style={styles.cornerBottomLeft} />
            <View style={styles.cornerBottomRight} />
          </View>

          <View style={styles.unfocusedSide}></View>
        </View>
        <View style={styles.unfocusedBottom}></View>
      </View>
      {/* scan button */}
      <View style={styles.controlsContainer}>
        <Text style={styles.instructionText}>
          Ensure the entire placard is seen in the bounding box.
        </Text>
        <TouchableOpacity
          style={[styles.scanButton, isScanning && styles.scanButtonDisabled]}
          onPress={handleScan}
          disabled={isScanning}
        >
          {isScanning ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.scanButtonText}>SCAN PLACARD</Text>
          )}
        </TouchableOpacity>
      </View>
      {/* [START] DEBUGGING ONLY (showing the modal) */}
      <Modal visible={!!debugImage} transparent={true} animationType="fade">
        <View style={styles.debugModalContainer}>
          <Text>Cropped Image:</Text>
          
          {debugImage && <Image source={{ uri: debugImage }} style={styles.debugImage} />}
          
          <TouchableOpacity 
            style={styles.debugButton} 
            onPress={() => setDebugImage(null)}
          >
            <Text style={styles.buttonText}>Close Preview</Text>
          </TouchableOpacity>
        </View>
      </Modal>
      {/* [END] DEBUGGING ONLY */}
    </View>
  );
}

const overlayColor = "rgba(20, 20, 20, 0.6)"; // dark area outside bounding box
const { width } = Dimensions.get("window"); // grabs the screen width of the device
const SCANNER_SIZE = width * 0.7; // sets the size of the bounding box to be 70% of the screen width

const styles = StyleSheet.create({
  container: { flex: 1 },
  text: { textAlign: "center", marginBottom: 10 },
  button: {
    backgroundColor: "#D53E0F",
    padding: 15,
    borderRadius: 8,
    alignSelf: "center",
  },
  buttonText: { color: "white", fontWeight: "bold" },
  camera: { flex: 1 },

  overlay: { ...StyleSheet.absoluteFillObject },
  unfocusedTop: { flex: 1, backgroundColor: overlayColor },
  unfocusedSide: { flex: 1, backgroundColor: overlayColor },
  unfocusedBottom: { flex: 2, backgroundColor: overlayColor }, // make the bottom part larger to push the bounding box upwards
  middleContainer: {
    flexDirection: "row",
    height: SCANNER_SIZE,
  },
  focusedBox: {
    width: SCANNER_SIZE,
    height: SCANNER_SIZE,
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
    backgroundColor: "rgba(0, 0, 0, 0.5)", // dark background so it is readable over the camera feed
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
  scanButtonDisabled: { backgroundColor: "gray" },
  scanButtonText: { color: "white", fontSize: 18, fontWeight: "bold" }

  // [START] DEBUGGING ONLY (modal styles)
  , debugModalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  debugImage: { width: SCANNER_SIZE, height: SCANNER_SIZE, resizeMode: 'contain', borderWidth: 2, borderColor: '#00FF00', marginVertical: 20 },
  debugText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  debugButton: { backgroundColor: '#FF3B30', padding: 15, borderRadius: 8, marginTop: 10 }
  // [END] DEBUGGING ONLY
});
