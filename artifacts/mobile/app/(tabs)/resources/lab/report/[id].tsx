import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { HealthParameterRow } from "@/components/lab/HealthParameterRow";
import { getAuthHeaders } from "@/lib/session";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

const DEMO_COACH_ID = "coach-1";
const DEMO_COACH_NAME = "Dr. Priya Nair";

async function fetchReport(id: string) {
  const res = await fetch(`${API_BASE}/labs/reports/${id}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Report not found");
  return res.json();
}

async function checkShareStatus(reportId: string) {
  const res = await fetch(`${API_BASE}/labs/reports`, { headers: getAuthHeaders() });
  const reports = await res.json();
  const grants = await fetch(`${API_BASE}/labs/reports/${reportId}`, { headers: getAuthHeaders() });
  return false; // simplified: check by POST to share
}

export default function ReportDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [shared, setShared] = useState(false);
  const [sharing, setSharing] = useState(false);

  const { data: report, isLoading } = useQuery({
    queryKey: ["lab-report", id],
    queryFn: () => fetchReport(id!),
    enabled: !!id,
  });

  async function toggleShare() {
    if (sharing) return;
    setSharing(true);
    try {
      if (shared) {
        await fetch(`${API_BASE}/labs/reports/${id}/share`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({ coachId: DEMO_COACH_ID }),
        });
        setShared(false);
        Alert.alert("Revoked", `${DEMO_COACH_NAME} can no longer access this report.`);
      } else {
        await fetch(`${API_BASE}/labs/reports/${id}/share`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({ coachId: DEMO_COACH_ID }),
        });
        setShared(true);
        Alert.alert("Shared!", `${DEMO_COACH_NAME} can now view your report.\nYour DPDP consent has been recorded.`);
      }
    } catch {
      Alert.alert("Error", "Could not update share settings.");
    } finally {
      setSharing(false);
    }
  }

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color="#22C55E" size="large" />
      </View>
    );
  }

  if (!report) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>Report not found</Text>
      </View>
    );
  }

  const sections = report.sections as Record<string, any[]> ?? {};
  const hasResults = report.results && report.results.length > 0;
  const sectionKeys = Object.keys(sections);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: insets.top + 10 },
        ]}
      >
        <Pressable onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
          {report.title ?? report.packageName ?? "Report"}
        </Text>
        <Pressable
          onPress={() => fetch(`${API_BASE}/labs/reports/${id}/pdf`)}
        >
          <Feather name="download" size={22} color={colors.foreground} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
        {/* Meta Card */}
        <View style={[styles.metaCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>Package</Text>
            <Text style={[styles.metaValue, { color: colors.foreground }]}>{report.packageName ?? report.title}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>Report Date</Text>
            <Text style={[styles.metaValue, { color: colors.foreground }]}>
              {new Date(report.reportDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>Status</Text>
            <View style={[styles.statusPill, { backgroundColor: "#DCFCE7" }]}>
              <Text style={[styles.statusText, { color: "#16A34A" }]}>Ready</Text>
            </View>
          </View>
          {(report.abnormalCount ?? 0) > 0 && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.metaRow}>
                <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>Abnormal</Text>
                <View style={[styles.statusPill, { backgroundColor: "#FEE2E2" }]}>
                  <Text style={[styles.statusText, { color: "#DC2626" }]}>
                    {report.abnormalCount} result{report.abnormalCount > 1 ? "s" : ""}
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Share with Coach Toggle */}
        <View style={[styles.shareCard, { backgroundColor: shared ? "#F0FDF4" : colors.card, borderColor: shared ? "#22C55E" : colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.shareTitle, { color: colors.foreground }]}>Share with Coach</Text>
            <Text style={[styles.shareDesc, { color: colors.mutedForeground }]}>
              {shared
                ? `${DEMO_COACH_NAME} can view this report`
                : `Allow ${DEMO_COACH_NAME} to see your results`}
            </Text>
          </View>
          <Pressable
            style={[styles.shareToggle, { backgroundColor: shared ? "#22C55E" : colors.muted }]}
            onPress={toggleShare}
            disabled={sharing}
          >
            {sharing ? (
              <ActivityIndicator size="small" color={shared ? "#fff" : "#6B7280"} />
            ) : (
              <Feather name={shared ? "check" : "share-2"} size={16} color={shared ? "#fff" : "#6B7280"} />
            )}
          </Pressable>
        </View>

        {/* Parameter Results */}
        {hasResults ? (
          sectionKeys.length > 0 ? (
            sectionKeys.map((sec) => (
              <View key={sec} style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{sec}</Text>
                  {sections[sec].some((r: any) => r.isAbnormal) && (
                    <View style={styles.abnBadge}>
                      <Text style={styles.abnBadgeText}>
                        {sections[sec].filter((r: any) => r.isAbnormal).length} abnormal
                      </Text>
                    </View>
                  )}
                </View>
                {sections[sec].map((param: any, i: number) => (
                  <HealthParameterRow
                    key={param.id ?? param.testName}
                    param={param}
                    isLast={i === sections[sec].length - 1}
                  />
                ))}
              </View>
            ))
          ) : (
            <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Results</Text>
              </View>
              {report.results.map((param: any, i: number) => (
                <HealthParameterRow
                  key={param.id ?? param.testName}
                  param={param}
                  isLast={i === report.results.length - 1}
                />
              ))}
            </View>
          )
        ) : (
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border, padding: 20, alignItems: "center" }]}>
            <Feather name="clock" size={32} color={colors.mutedForeground} />
            <Text style={[{ color: colors.mutedForeground, marginTop: 10 }]}>Results will appear once ready</Text>
          </View>
        )}

        {/* Download PDF */}
        <Pressable
          style={[styles.downloadBtn, { borderColor: colors.border }]}
          onPress={() => fetch(`${API_BASE}/labs/reports/${id}/pdf`)}
        >
          <Feather name="download" size={16} color={colors.foreground} />
          <Text style={[styles.downloadText, { color: colors.foreground }]}>Download PDF Report</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: "700", flex: 1, textAlign: "center" },
  metaCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12 },
  metaLabel: { fontSize: 13 },
  metaValue: { fontSize: 13, fontWeight: "600" },
  divider: { height: 1 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: "700" },
  shareCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  shareTitle: { fontSize: 14, fontWeight: "700" },
  shareDesc: { fontSize: 12, marginTop: 2 },
  shareToggle: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  sectionCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  sectionTitle: { fontSize: 14, fontWeight: "700" },
  abnBadge: { backgroundColor: "#FEE2E2", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  abnBadgeText: { fontSize: 11, fontWeight: "700", color: "#DC2626" },
  downloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 13,
  },
  downloadText: { fontSize: 14, fontWeight: "600" },
});
