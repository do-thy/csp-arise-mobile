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
  View
} from "react-native"; // modal and image for debugging only

export default function RoomScanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);
  const [isScanning, setIsScanning] = useState(false);
  // for debugging only
  // const [debugImage, setDebugImage] = useState<string | null>(null);

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
        skipProcessing: true,
      });

      // 2. calculate the bounding box size
      const cropSize = photo.width * 0.7;
      const originX = (photo.width - cropSize) / 2;
      const originY = photo.height * 0.2;

      // 3. cut the image (Using the NEW Expo 51+ Syntax)
      const imageRef = await ImageManipulator.manipulate(photo.uri)
        .crop({ originX, originY, width: cropSize, height: cropSize })
        .renderAsync();

      const finalCroppedPhoto = await imageRef.saveAsync({
        compress: 1,
        format: SaveFormat.JPEG,
      });

      // DEBUGGING ONLY: shows the cropped image in a modal
      // setDebugImage(finalCroppedPhoto.uri);

      // 4. pass the cropped photo's local URI directly to ML Kit
      const result = await TextRecognition.recognize(finalCroppedPhoto.uri);

      // 5. data processing goes here later

      // 6. extract the text and show the dialog box (temporary, replace with AR box later)
      if (result.text && result.text.trim().length > 0) {
        Alert.alert("", result.text); // for some reason, removing the empty string breaks the alert
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
      {/* <Modal visible={!!debugImage} transparent={true} animationType="fade">
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
      </Modal> */}
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
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  cornerTopRight: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 50,
    height: 50,
    borderColor: "#ff0000",
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  cornerBottomLeft: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: 50,
    height: 50,
    borderColor: "#ff0000",
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  cornerBottomRight: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 50,
    height: 50,
    borderColor: "#ff0000",
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },

  controlsContainer: {
    position: "absolute",
    bottom: 50,
    width: "100%",
    alignItems: "center",
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
  scanButtonText: { color: "white", fontSize: 18, fontWeight: "bold" },

  // [START] DEBUGGING ONLY (modal styles)
  /* , debugModalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  debugImage: { width: SCANNER_SIZE, height: SCANNER_SIZE, resizeMode: 'contain', borderWidth: 2, borderColor: '#00FF00', marginVertical: 20 },
  debugText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  debugButton: { backgroundColor: '#FF3B30', padding: 15, borderRadius: 8, marginTop: 10 } */
  // [END] DEBUGGING ONLY
});
