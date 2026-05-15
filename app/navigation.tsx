import React, { useEffect, useMemo, useState } from "react";
import { Alert, ActivityIndicator, StatusBar, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MapPin, Search, School, Cpu } from "lucide-react-native";
import { ViroARSceneNavigator } from "@reactvision/react-viro";
import { ref, onValue } from "firebase/database";
import { collection, getDocs } from "firebase/firestore";
import { db, rtdb } from "../lib/firebase";
import { findPath } from "../services/PathFinder";
import { styles, COLORS } from "../styles/navigationTheme";
import { NavigationScene } from "../components/NavigationScene";

export default function NavigationScreen() {
  const [page, setPage] = useState<2 | 3>(2);
  const [loading, setLoading] = useState(true);
  const [selectedCampus, setSelectedCampus] = useState("Nodes_Main");
  const [selectedBuilding, setSelectedBuilding] = useState("ALL");
  const [nodeMap, setNodeMap] = useState<Record<string, any>>({});
  const [lookupMap, setLookupMap] = useState<Record<string, string>>({});
  const [roomOptions, setRoomOptions] = useState<Array<{ roomName: string; normalized: string; nodeId: string }>>([]);
  const [startID, setStartID] = useState("");
  const [endID, setEndID] = useState("");
  const [path, setPath] = useState<any[]>([]);
  const [liveSettings, setLiveSettings] = useState({
    lineColor: COLORS.primary,
    yOffset: -1.2,
  });

  const addRoomOption = (room: any, docId: string, nameMap: Record<string, string>, roomList: Array<{ roomName: string; normalized: string; nodeId: string }>) => {
    const normalized = room.roomName.toLowerCase().trim();
    nameMap[normalized] = docId;
    roomList.push({ roomName: room.roomName, normalized, nodeId: docId });
  };

  const addRoomOptions = (
    rooms: any,
    docId: string,
    nameMap: Record<string, string>,
    roomList: Array<{ roomName: string; normalized: string; nodeId: string }>
  ) => {
    if (!rooms || !Array.isArray(rooms)) return;

    rooms.forEach((room: any) => {
      if (room.roomName) {
        addRoomOption(room, docId, nameMap, roomList);
      }
    });
  };

  useEffect(() => {
    const settingsRef = ref(rtdb, "settings");
    const unsubscribe = onValue(settingsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setLiveSettings({
          lineColor: data.lineColor || COLORS.primary,
          yOffset: Number.parseFloat(data.yOffset) ?? -1.2,
        });
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const loadNodes = async () => {
      setLoading(true);
      try {
        const nodesCol = collection(db, selectedCampus);
        const querySnapshot = await getDocs(nodesCol);
        const rawMap: Record<string, any> = {};
        const nameMap: Record<string, string> = {};
        const roomList: Array<{ roomName: string; normalized: string; nodeId: string }> = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const docId = doc.id;
          rawMap[docId] = data;

          const isMain = selectedCampus === "Nodes_Main";
          const matchesBuilding =
            !isMain ||
            selectedBuilding === "ALL" ||
            docId.startsWith(selectedBuilding);

          if (matchesBuilding) {
            addRoomOptions(data.rooms, docId, nameMap, roomList);
          }
        });

        setNodeMap(rawMap);
        setLookupMap(nameMap);
        setRoomOptions(roomList);
        setLoading(false);
      } catch (err) {
        console.error("Data Load Error:", err);
        setLoading(false);
      }
    };

    loadNodes();
  }, [selectedCampus, selectedBuilding]);

  const getSuggestions = (query: string) => {
    const normalizedQuery = query.toLowerCase().trim();
    if (!normalizedQuery) return [];

    return roomOptions
      .map((option) => {
        let score = 2;
        if (option.normalized.startsWith(normalizedQuery)) {
          score = 0;
        } else if (option.normalized.includes(normalizedQuery)) {
          score = 1;
        }

        return { score, option };
      })
      .filter((item) => item.score < 2)
      .sort((a, b) => a.score - b.score || a.option.normalized.localeCompare(b.option.normalized))
      .slice(0, 5)
      .map((item) => item.option.roomName);
  };

  const startSuggestions = useMemo(() => getSuggestions(startID), [startID, roomOptions]);
  const endSuggestions = useMemo(() => getSuggestions(endID), [endID, roomOptions]);

  const handleCalculate = () => {
    const sInput = startID.toLowerCase().trim();
    const eInput = endID.toLowerCase().trim();
    const actualStartID = lookupMap[sInput] || startID.trim();
    const actualEndID = lookupMap[eInput] || endID.trim();

    if (!nodeMap[actualStartID] || !nodeMap[actualEndID]) {
      Alert.alert(
        "Location Not Found",
        `We couldn't find those locations in ${selectedCampus === "Nodes_Main" ? "Main" : "Digital"} Campus.`
      );
      return;
    }

    const result = findPath(actualStartID, actualEndID, nodeMap);
    if (result && result.length > 0) {
      setPath(result);
      setPage(3);
    } else {
      Alert.alert("Path Blocked", "No connection found between these points.");
    }
  };

  const instructionText = (() => {
    if (path.length <= 1) return "Destination Reached";
    if (path[1]?.nodeID?.includes("Portal")) return "Bridge to Next Building";
    return `Head to ${path.at(-1)?.nodeID.split("_").pop()}`;
  })();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {page === 2 && (
        <View style={[styles.content, { flex: 1, justifyContent: "center" }]}> 
          <View style={[styles.toggleContainer, { marginBottom: 10 }]}> 
            <TouchableOpacity
              style={[styles.toggleTab, { backgroundColor: selectedCampus === "Nodes_Main" ? COLORS.primary : "transparent" }]}
              onPress={() => { setSelectedCampus("Nodes_Main"); setSelectedBuilding("ALL"); }}
            >
              <School size={16} color={selectedCampus === "Nodes_Main" ? "white" : COLORS.grey} />
              <Text style={{ marginLeft: 8, fontSize: 12, fontWeight: "bold", color: selectedCampus === "Nodes_Main" ? "white" : COLORS.grey }}>MAIN</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toggleTab, { backgroundColor: selectedCampus === "Nodes_Digital" ? COLORS.primary : "transparent" }]}
              onPress={() => { setSelectedCampus("Nodes_Digital"); setSelectedBuilding("ALL"); }}
            >
              <Cpu size={16} color={selectedCampus === "Nodes_Digital" ? "white" : COLORS.grey} />
              <Text style={{ marginLeft: 8, fontSize: 12, fontWeight: "bold", color: selectedCampus === "Nodes_Digital" ? "white" : COLORS.grey }}>DIGITAL</Text>
            </TouchableOpacity>
          </View>

          {selectedCampus === "Nodes_Main" && (
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 20 }}>
              {['ALL', 'Gd_1', 'Gd_2', 'Gd_3'].map((bldg) => (
                <TouchableOpacity
                  key={bldg}
                  onPress={() => setSelectedBuilding(bldg)}
                  style={{
                    flex: 1,
                    marginHorizontal: 2,
                    paddingVertical: 8,
                    borderRadius: 10,
                    backgroundColor: selectedBuilding === bldg ? COLORS.primary : COLORS.surface,
                    borderWidth: 1,
                    borderColor: selectedBuilding === bldg ? COLORS.primary : '#EAE8E3',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: 'bold', color: selectedBuilding === bldg ? 'white' : COLORS.text }}>
                    {bldg === 'ALL' ? 'ALL' : bldg.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {loading ? (
            <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: 30 }} />
          ) : (
            <View style={styles.searchCard}>
              <Text style={styles.label}>Origin</Text>
              <View style={styles.inputWrapper}>
                <MapPin color={COLORS.primary} size={18} />
                <TextInput
                  style={styles.input}
                  value={startID}
                  onChangeText={setStartID}
                  placeholder="Scan or type room name..."
                  placeholderTextColor="#999"
                />
              </View>
              {startSuggestions.length > 0 && (
                <View style={styles.suggestionContainer}>
                  {startSuggestions.map((item) => (
                    <TouchableOpacity
                      key={`start-${item}`}
                      style={styles.suggestionItem}
                      onPress={() => setStartID(item)}
                    >
                      <Text style={styles.suggestionText}>{item}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <View style={styles.divider} />
              <Text style={styles.label}>Destination</Text>
              <View style={styles.inputWrapper}>
                <Search color={COLORS.primary} size={18} />
                <TextInput
                  style={styles.input}
                  value={endID}
                  onChangeText={setEndID}
                  placeholder="Search destination..."
                  placeholderTextColor="#999"
                />
              </View>
              {endSuggestions.length > 0 && (
                <View style={styles.suggestionContainer}>
                  {endSuggestions.map((item) => (
                    <TouchableOpacity
                      key={`end-${item}`}
                      style={styles.suggestionItem}
                      onPress={() => setEndID(item)}
                    >
                      <Text style={styles.suggestionText}>{item}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          <TouchableOpacity style={styles.mainButton} onPress={handleCalculate}>
            <Text style={styles.buttonText}>CALCULATE ROUTE</Text>
          </TouchableOpacity>
        </View>
      )}

      {page === 3 && (
        <View style={{ flex: 1 }}>
          <ViroARSceneNavigator
            autofocus
            initialScene={{ scene: NavigationScene as any }}
            viroAppProps={{
              path,
              lineColor: liveSettings.lineColor,
              yOffset: liveSettings.yOffset,
              startNode: path[0],
            }}
            style={{ flex: 1 }}
          />

          <View style={[styles.navHUD, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }]}> 
            <View style={styles.instructionCard}>
              <Text style={styles.instructionText}>{instructionText}</Text>
            </View>

            <TouchableOpacity
              style={[styles.mainButton, { backgroundColor: 'rgba(161, 33, 36, 0.9)' }]}
              onPress={() => { setPath([]); setPage(2); }}
            >
              <Text style={styles.buttonText}>END SESSION</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
