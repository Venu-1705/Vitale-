import { Link } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/lib/supabase";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) setError(error.message);
    // On success the _layout auth listener redirects into the app.
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 40 }]}
    >
      <View style={styles.inner}>
        <Text style={[styles.title, { color: colors.foreground }]}>Welcome back</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Sign in to continue your journey</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={colors.mutedForeground}
          secureTextEntry
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
        />

        <TouchableOpacity
          onPress={signIn}
          disabled={loading}
          style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
          activeOpacity={0.85}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Sign In</Text>}
        </TouchableOpacity>

        <View style={styles.footerRow}>
          <Text style={{ color: colors.mutedForeground }}>New here? </Text>
          <Link href="/(auth)/signup" style={{ color: colors.primary, fontWeight: "700" }}>
            Create an account
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  inner: { gap: 14 },
  title: { fontSize: 28, fontWeight: "900" },
  subtitle: { fontSize: 15, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15 },
  primaryBtn: { borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 4 },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  footerRow: { flexDirection: "row", justifyContent: "center", marginTop: 12 },
  error: { color: "#EF4444", fontSize: 13 },
});
