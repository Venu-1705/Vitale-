import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

const STATUS_ORDER = [
  "placed",
  "confirmed",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
];

const CANCELLED_STATUSES = ["cancelled", "returned", "refunded"];

interface TimelineEvent {
  status: string;
  note?: string | null;
  createdAt: string | Date;
}

interface Props {
  currentStatus: string;
  events?: TimelineEvent[];
}

function formatTime(d: string | Date) {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function labelFor(s: string) {
  const map: Record<string, string> = {
    placed: "Order Placed",
    confirmed: "Order Confirmed",
    packed: "Packed & Ready",
    shipped: "Shipped",
    out_for_delivery: "Out for Delivery",
    delivered: "Delivered",
    cancelled: "Cancelled",
    returned: "Returned",
    refunded: "Refunded",
  };
  return map[s] ?? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function OrderTimeline({ currentStatus, events = [] }: Props) {
  const colors = useColors();
  const isCancelled = CANCELLED_STATUSES.includes(currentStatus);
  const steps = isCancelled
    ? ["placed", currentStatus]
    : STATUS_ORDER;

  const currentIdx = isCancelled ? 1 : STATUS_ORDER.indexOf(currentStatus);

  const eventMap = new Map<string, TimelineEvent>();
  for (const e of events) eventMap.set(e.status, e);

  return (
    <View style={styles.container}>
      {steps.map((step, idx) => {
        const isDone = idx < currentIdx || currentStatus === step;
        const isCurrent = step === currentStatus;
        const isLast = idx === steps.length - 1;
        const event = eventMap.get(step);

        const dotColor = isDone
          ? isCancelled && isCurrent
            ? "#DC2626"
            : "#22C55E"
          : colors.border;

        return (
          <View key={step} style={styles.stepRow}>
            <View style={styles.leftCol}>
              <View
                style={[
                  styles.dot,
                  { borderColor: dotColor, backgroundColor: isDone ? dotColor : colors.background },
                ]}
              >
                {isDone && (
                  <Feather
                    name={isCancelled && isCurrent ? "x" : "check"}
                    size={10}
                    color="#fff"
                  />
                )}
                {isCurrent && !isDone && (
                  <View style={[styles.pulse, { backgroundColor: "#22C55E" }]} />
                )}
              </View>
              {!isLast && (
                <View
                  style={[
                    styles.line,
                    { backgroundColor: idx < currentIdx ? "#22C55E" : colors.border },
                  ]}
                />
              )}
            </View>
            <View style={[styles.content, !isLast && styles.contentPad]}>
              <Text
                style={[
                  styles.label,
                  {
                    color: isDone ? colors.foreground : colors.mutedForeground,
                    fontWeight: isCurrent ? "700" : "500",
                  },
                ]}
              >
                {labelFor(step)}
              </Text>
              {event?.note && (
                <Text style={[styles.note, { color: colors.mutedForeground }]}>{event.note}</Text>
              )}
              {event?.createdAt && (
                <Text style={[styles.time, { color: colors.mutedForeground }]}>
                  {formatTime(event.createdAt)}
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 4 },
  stepRow: { flexDirection: "row", gap: 12 },
  leftCol: { alignItems: "center", width: 24 },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  pulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  line: { width: 2, flex: 1, marginTop: 2 },
  content: { flex: 1, paddingBottom: 4 },
  contentPad: { paddingBottom: 20 },
  label: { fontSize: 14 },
  note: { fontSize: 12, marginTop: 2 },
  time: { fontSize: 11, marginTop: 2 },
});
