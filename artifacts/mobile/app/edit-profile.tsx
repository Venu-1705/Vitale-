import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

type FieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address" | "phone-pad" | "numeric";
  multiline?: boolean;
  isLast?: boolean;
};

function Field({ label, value, onChange, placeholder, keyboardType, multiline, isLast }: FieldProps) {
  const colors = useColors();
  return (
    <View style={[styles.field, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, { color: colors.foreground }, multiline && styles.fieldMultiline]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? `Enter ${label.toLowerCase()}`}
        placeholderTextColor={colors.mutedForeground}
        keyboardType={keyboardType ?? "default"}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        textAlignVertical={multiline ? "top" : "center"}
      />
    </View>
  );
}

export default function EditProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState("Alex");
  const [bio, setBio] = useState("On a journey to better health through nutrition and mindful living.");
  const [email, setEmail] = useState("alex@example.com");
  const [phone, setPhone] = useState("+91 98765 43210");

  function handleSave() {
    Alert.alert(
      "Profile Updated",
      "Your profile has been saved successfully.",
      [{ text: "OK", onPress: () => router.back() }]
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[styles.header, {
          backgroundColor: colors.card,
          borderBottomColor: colors.border,
          paddingTop: Platform.OS === "web" ? 67 : insets.top,
        }]}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={[styles.saveBtn, { color: colors.primary }]}>Save</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>

          <View style={styles.avatarSection}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>A</Text>
            </View>
            <TouchableOpacity
              style={[styles.avatarEditBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() =>
                Alert.alert(
                  "Change Photo",
                  "Choose an option",
                  [
                    { text: "Upload from Gallery", onPress: () => Alert.alert("Coming Soon", "Photo upload will be available in the full app.") },
                    { text: "Take Photo", onPress: () => Alert.alert("Coming Soon", "Camera access will be available in the full app.") },
                    { text: "Cancel", style: "cancel" },
                  ]
                )
              }
            >
              <Feather name="camera" size={16} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.avatarHint, { color: colors.mutedForeground }]}>Tap to change photo</Text>
          </View>

          <View style={{ marginHorizontal: 16, marginTop: 8, gap: 16 }}>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.mutedForeground }]}>PERSONAL INFO</Text>
              <Field label="Display Name" value={name} onChange={setName} placeholder="Your name" />
              <Field label="Bio" value={bio} onChange={setBio} placeholder="A short bio..." multiline isLast />
            </View>

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.mutedForeground }]}>CONTACT</Text>
              <Field label="Email" value={email} onChange={setEmail} keyboardType="email-address" />
              <Field label="Phone" value={phone} onChange={setPhone} keyboardType="phone-pad" isLast />
            </View>

            <TouchableOpacity
              style={[styles.saveFullBtn, { backgroundColor: colors.primary }]}
              onPress={handleSave}
            >
              <Feather name="check" size={18} color="#fff" />
              <Text style={styles.saveFullBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 38 },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  saveBtn: { fontSize: 16, fontWeight: "700" },
  avatarSection: { alignItems: "center", paddingVertical: 24, gap: 8, position: "relative" },
  avatar: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 34, fontWeight: "900", color: "#fff" },
  avatarEditBtn: {
    position: "absolute",
    bottom: 32,
    right: "50%",
    marginRight: -54,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarHint: { fontSize: 13 },
  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  cardTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  field: { paddingHorizontal: 16, paddingVertical: 12, gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: "600" },
  fieldInput: { fontSize: 16, paddingVertical: 2 },
  fieldMultiline: { minHeight: 70, paddingTop: 4 },
  saveFullBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
  },
  saveFullBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
