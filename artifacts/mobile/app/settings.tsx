import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useTheme, type ThemePreference } from "@/context/ThemeContext";

type SectionProps = { title: string; children: React.ReactNode };
function Section({ title, children }: SectionProps) {
  const colors = useColors();
  return (
    <View style={{ marginHorizontal: 16, marginBottom: 20 }}>
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{title}</Text>
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

type RowProps = {
  icon?: string;
  iconColor?: string;
  label: string;
  value?: string;
  isLast?: boolean;
  onPress?: () => void;
  danger?: boolean;
  right?: React.ReactNode;
};
function Row({ icon, iconColor, label, value, isLast, onPress, danger, right }: RowProps) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.row, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {icon && (
        <View style={[styles.rowIconWrap, { backgroundColor: (iconColor ?? colors.primary) + "20" }]}>
          <Feather name={icon as any} size={16} color={iconColor ?? colors.primary} />
        </View>
      )}
      <Text style={[styles.rowLabel, { color: danger ? "#EF4444" : colors.foreground }]}>{label}</Text>
      {value ? <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>{value}</Text> : null}
      {right ?? (onPress && !right ? <Feather name="chevron-right" size={16} color={colors.border} /> : null)}
    </TouchableOpacity>
  );
}

type ToggleRowProps = {
  icon?: string;
  iconColor?: string;
  label: string;
  sub?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  isLast?: boolean;
};
function ToggleRow({ icon, iconColor, label, sub, value, onChange, isLast }: ToggleRowProps) {
  const colors = useColors();
  return (
    <View style={[styles.row, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      {icon && (
        <View style={[styles.rowIconWrap, { backgroundColor: (iconColor ?? colors.primary) + "20" }]}>
          <Feather name={icon as any} size={16} color={iconColor ?? colors.primary} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: colors.foreground }]}>{label}</Text>
        {sub ? <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>{sub}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor="#fff"
        ios_backgroundColor={colors.border}
      />
    </View>
  );
}

type SegmentRowProps = {
  icon?: string;
  iconColor?: string;
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  isLast?: boolean;
};
function SegmentRow({ icon, iconColor, label, options, value, onChange, isLast }: SegmentRowProps) {
  const colors = useColors();
  return (
    <View style={[styles.segmentRow, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      {icon && (
        <View style={[styles.rowIconWrap, { backgroundColor: (iconColor ?? colors.primary) + "20" }]}>
          <Feather name={icon as any} size={16} color={iconColor ?? colors.primary} />
        </View>
      )}
      <Text style={[styles.rowLabel, { color: colors.foreground, flex: 1 }]}>{label}</Text>
      <View style={[styles.segmentControl, { backgroundColor: colors.muted }]}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[styles.segmentOption, value === opt && { backgroundColor: colors.card }]}
            onPress={() => onChange(opt)}
          >
            <Text style={[styles.segmentText, { color: value === opt ? colors.foreground : colors.mutedForeground }]}>
              {opt}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [notifMeals, setNotifMeals] = useState(true);
  const [notifStreak, setNotifStreak] = useState(true);
  const [notifSessions, setNotifSessions] = useState(true);
  const [notifCommunity, setNotifCommunity] = useState(true);
  const [notifCoach, setNotifCoach] = useState(true);
  const [notifWeekly, setNotifWeekly] = useState(true);
  const [notifLeaderboard, setNotifLeaderboard] = useState(false);
  const [quietHours, setQuietHours] = useState(false);

  const [leaderboardAnon, setLeaderboardAnon] = useState(false);
  const [profileVisibility, setProfileVisibility] = useState("Public");

  const { preference, setPreference } = useTheme();
  const [language, setLanguage] = useState("EN");
  const [units, setUnits] = useState("kg");

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[styles.header, {
          backgroundColor: colors.card,
          borderBottomColor: colors.border,
          paddingTop: Platform.OS === "web" ? 67 : insets.top,
        }]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Settings</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 20, paddingBottom: insets.bottom + 40 }}>

        <Section title="ACCOUNT">
          <Row icon="user" iconColor="#3B82F6" label="Edit Profile" onPress={() => router.push("/edit-profile")} />
          <Row icon="lock" iconColor="#8B5CF6" label="Change Password" onPress={() => Alert.alert("Change Password", "A reset link will be sent to your registered email address.")} />
          <Row icon="phone" iconColor="#10B981" label="Update Phone" onPress={() => Alert.alert("Update Phone", "OTP verification will be sent to your current number.")} isLast />
        </Section>

        <Section title="NOTIFICATIONS">
          <ToggleRow icon="coffee" iconColor="#F59E0B" label="Meal Reminders" sub="Breakfast, lunch & dinner alerts" value={notifMeals} onChange={setNotifMeals} />
          <ToggleRow icon="zap" iconColor="#F97316" label="Streak Alerts" sub="Daily nudges to keep your streak" value={notifStreak} onChange={setNotifStreak} />
          <ToggleRow icon="calendar" iconColor="#8B5CF6" label="Session Reminders" sub="15 min & 1 hour before sessions" value={notifSessions} onChange={setNotifSessions} />
          <ToggleRow icon="users" iconColor="#06B6D4" label="Community Activity" sub="Likes, comments and replies" value={notifCommunity} onChange={setNotifCommunity} />
          <ToggleRow icon="message-circle" iconColor="#22C55E" label="Coach Messages" sub="When your coach sends a message" value={notifCoach} onChange={setNotifCoach} />
          <ToggleRow icon="bar-chart-2" iconColor="#3B82F6" label="Weekly Summary" sub="Every Sunday evening" value={notifWeekly} onChange={setNotifWeekly} />
          <ToggleRow icon="trending-up" iconColor="#EC4899" label="Leaderboard Alerts" sub="When you move up or down" value={notifLeaderboard} onChange={setNotifLeaderboard} />
          <ToggleRow icon="moon" iconColor="#6366F1" label="Quiet Hours" sub="No alerts from 10 PM – 7 AM" value={quietHours} onChange={setQuietHours} isLast />
        </Section>

        <Section title="PRIVACY">
          <ToggleRow icon="eye-off" iconColor="#6B7280" label="Anonymous on Leaderboard" sub="Show as 'Anonymous User' in rankings" value={leaderboardAnon} onChange={setLeaderboardAnon} />
          <SegmentRow icon="globe" iconColor="#3B82F6" label="Profile Visibility" options={["Public", "Program", "Private"]} value={profileVisibility} onChange={setProfileVisibility} />
          <Row icon="share-2" iconColor="#F97316" label="Data Sharing" value="1 active grant" onPress={() => Alert.alert("Active Data Sharing", "Dr. Meera Shah — Beginner's Wellness\nShared: Meal logs, Symptoms, Weight\nAccess until: 22 Nov 2026\n\nTap Manage to change access.")} />
          <Row icon="download" iconColor="#10B981" label="Download My Data" onPress={() => Alert.alert("Download Data", "Preparing your health data export as PDF/CSV. This feature will be available at launch.")} />
          <Row icon="trash-2" iconColor="#EF4444" label="Delete My Health Data" danger onPress={() => Alert.alert("Delete Health Data", "This will permanently delete all your health records from the platform. Your account will remain active. This cannot be undone.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => {} }])} />
          <Row icon="user-x" iconColor="#EF4444" label="Delete Account" danger isLast onPress={() => Alert.alert("Delete Account", "This will permanently delete your account after a 30-day grace period. All data will be removed. You can cancel during the grace period by logging back in.", [{ text: "Cancel", style: "cancel" }, { text: "Start Deletion", style: "destructive", onPress: () => {} }])} />
        </Section>

        <Section title="PREFERENCES">
          <SegmentRow icon="globe" iconColor="#3B82F6" label="Language" options={["EN", "हि"]} value={language} onChange={setLanguage} />
          <SegmentRow icon="sliders" iconColor="#8B5CF6" label="Weight Units" options={["kg", "lbs"]} value={units} onChange={setUnits} />
          <SegmentRow
            icon="sun"
            iconColor="#F59E0B"
            label="Theme"
            options={["Light", "Dark", "System"]}
            value={preference.charAt(0).toUpperCase() + preference.slice(1)}
            onChange={(v) => setPreference(v.toLowerCase() as ThemePreference)}
          />
          <Row icon="grid" iconColor="#10B981" label="Dashboard Nutrients" value="Cal, Protein, Carbs, Fat" isLast onPress={() => Alert.alert("Customize Nutrients", "Choose which 4 nutrients appear on your daily dashboard.\n\nThis feature is coming soon with condition-specific presets for PCOS, Diabetes & more.")} />
        </Section>

        <Section title="ABOUT">
          <Row icon="info" iconColor="#6B7280" label="App Version" value="1.0.0 (Beta)" />
          <Row icon="file-text" iconColor="#6B7280" label="Terms of Service" onPress={() => Alert.alert("Terms of Service", "Full terms available at vitale.app/terms")} />
          <Row icon="shield" iconColor="#6B7280" label="Privacy Policy" onPress={() => Alert.alert("Privacy Policy", "Full policy at vitale.app/privacy")} />
          <Row icon="mail" iconColor="#6B7280" label="DPDP Grievance Officer" onPress={() => Alert.alert("Grievance Officer", "Name: Ms. Anita Sharma\nEmail: grievance@vitale.app\nResponse within 30 days as required under DPDP Act 2023.")} />
          <Row icon="star" iconColor="#F59E0B" label="Rate Vitalé" isLast onPress={() => Alert.alert("Thank you!", "Rating feature will be available on the App Store and Play Store at launch.")} />
        </Section>

        <TouchableOpacity
          style={[styles.onboardingBtn, { borderColor: colors.border, backgroundColor: colors.muted }]}
          onPress={() => router.push("/onboarding")}
        >
          <Feather name="play-circle" size={16} color={colors.mutedForeground} />
          <Text style={[styles.onboardingBtnText, { color: colors.mutedForeground }]}>Preview Onboarding Flow</Text>
        </TouchableOpacity>

      </ScrollView>
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
  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginBottom: 6, marginLeft: 4 },
  sectionCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 13, gap: 10 },
  rowIconWrap: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: "500" },
  rowSub: { fontSize: 12, marginTop: 1 },
  rowValue: { fontSize: 13 },
  segmentRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  segmentControl: { flexDirection: "row", borderRadius: 8, padding: 2, gap: 2 },
  segmentOption: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  segmentText: { fontSize: 12, fontWeight: "600" },
  onboardingBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginHorizontal: 16, marginTop: 4, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  onboardingBtnText: { fontSize: 13 },
});
