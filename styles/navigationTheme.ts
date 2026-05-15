import { StyleSheet } from "react-native";

export const COLORS = {
  primary: "#A12124",
  secondary: "#FAF9F6",
  surface: "#FFFFFF",
  text: "#11181C",
  white: "#FFFFFF",
  overlay: "rgba(255, 255, 255, 0.95)",
  success: "#2E7D32",
  grey: "#687076",
};

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.secondary,
  },

  content: {
    flex: 1,
    padding: 20,
    justifyContent: "flex-start",
  },

  searchCard: {
    backgroundColor: COLORS.surface,
    padding: 20,
    borderRadius: 15,
    elevation: 5,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.grey,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#EAE8E3",
  },
  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: COLORS.text,
  },
  divider: {
    height: 20,
  },

  mainButton: {
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    height: 60,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
    marginLeft: 10,
  },

  navHUD: {
    flex: 1,
    justifyContent: "space-between",
    padding: 20,
    paddingBottom: 40,
  },
  instructionCard: {
    backgroundColor: COLORS.overlay,
    padding: 20,
    borderRadius: 15,
    borderLeftWidth: 8,
    borderLeftColor: COLORS.primary,
    elevation: 10,
  },
  instructionText: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.text,
  },

  loadingOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  
  toggleContainer: {
    flexDirection: "row",
    backgroundColor: "#F4F3F1",
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  
  toggleTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
  },
  suggestionContainer: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: "#EAE8E3",
    overflow: "hidden",
  },
  suggestionItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F4F3F1",
  },
  suggestionText: {
    color: COLORS.text,
    fontSize: 15,
  },
});
