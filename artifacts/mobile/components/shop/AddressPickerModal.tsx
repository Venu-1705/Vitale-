/**
 * Address picker + editor used at checkout.
 *
 * Talks to the D12 `/addresses` endpoints via the shared commerce hooks, so the
 * checkout screen never touches the network directly. Two modes:
 *   - "list": choose an existing delivery address, or jump to add a new one /
 *     edit an existing one.
 *   - "form": create or update an address (server-validated; errors surfaced).
 */
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { ApiError } from "@/lib/api";
import {
  useCreateAddress,
  useUpdateAddress,
  type Address,
  type AddressInput,
} from "@/lib/commerce";

interface Props {
  visible: boolean;
  addresses: Address[];
  selectedId: string | null;
  onSelect: (address: Address) => void;
  onClose: () => void;
}

type Mode = { kind: "list" } | { kind: "form"; editing: Address | null };

const EMPTY_FORM: AddressInput = {
  label: "Home",
  name: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  pincode: "",
  isDefault: false,
};

function apiMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const data = err.data as { error?: { message?: string } } | null;
    return data?.error?.message ?? fallback;
  }
  return fallback;
}

export function AddressPickerModal({
  visible,
  addresses,
  selectedId,
  onSelect,
  onClose,
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>({ kind: "list" });

  const close = () => {
    setMode({ kind: "list" });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={styles.overlay}>
        <Pressable style={{ flex: 1 }} onPress={close} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 },
          ]}
        >
          <View style={styles.handle} />
          {mode.kind === "list" ? (
            <AddressList
              colors={colors}
              addresses={addresses}
              selectedId={selectedId}
              onSelect={(a) => {
                onSelect(a);
                close();
              }}
              onAdd={() => setMode({ kind: "form", editing: null })}
              onEdit={(a) => setMode({ kind: "form", editing: a })}
            />
          ) : (
            <AddressForm
              colors={colors}
              editing={mode.editing}
              onCancel={() => setMode({ kind: "list" })}
              onSaved={(a) => {
                onSelect(a);
                close();
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

function AddressList({
  colors,
  addresses,
  selectedId,
  onSelect,
  onAdd,
  onEdit,
}: {
  colors: ReturnType<typeof useColors>;
  addresses: Address[];
  selectedId: string | null;
  onSelect: (a: Address) => void;
  onAdd: () => void;
  onEdit: (a: Address) => void;
}) {
  return (
    <>
      <Text style={[styles.title, { color: colors.foreground }]}>Delivery Address</Text>
      <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
        {addresses.length === 0 ? (
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>
            No saved addresses yet. Add one to continue.
          </Text>
        ) : (
          addresses.map((a) => {
            const active = a.id === selectedId;
            return (
              <Pressable
                key={a.id}
                style={[
                  styles.addrRow,
                  {
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active ? "#F0FDF4" : colors.background,
                  },
                ]}
                onPress={() => onSelect(a)}
              >
                <Feather
                  name={active ? "check-circle" : "circle"}
                  size={18}
                  color={active ? colors.primary : colors.mutedForeground}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.addrName, { color: colors.foreground }]}>
                    {a.name} · {a.label}
                    {a.isDefault ? "  (Default)" : ""}
                  </Text>
                  <Text style={[styles.addrLine, { color: colors.mutedForeground }]}>
                    {a.line1}
                    {a.line2 ? `, ${a.line2}` : ""}
                  </Text>
                  <Text style={[styles.addrLine, { color: colors.mutedForeground }]}>
                    {a.city}, {a.state} – {a.pincode}
                  </Text>
                  <Text style={[styles.addrLine, { color: colors.mutedForeground }]}>
                    {a.phone}
                  </Text>
                </View>
                <Pressable hitSlop={8} onPress={() => onEdit(a)}>
                  <Feather name="edit-2" size={16} color={colors.mutedForeground} />
                </Pressable>
              </Pressable>
            );
          })
        )}
      </ScrollView>
      <Pressable
        style={[styles.addBtn, { borderColor: colors.primary }]}
        onPress={onAdd}
      >
        <Feather name="plus" size={16} color={colors.primary} />
        <Text style={[styles.addBtnText, { color: colors.primary }]}>
          Add new address
        </Text>
      </Pressable>
    </>
  );
}

const FIELDS: {
  key: keyof AddressInput;
  label: string;
  keyboard?: "default" | "phone-pad" | "number-pad";
  optional?: boolean;
}[] = [
  { key: "name", label: "Full name" },
  { key: "phone", label: "Phone", keyboard: "phone-pad" },
  { key: "line1", label: "Address line 1" },
  { key: "line2", label: "Address line 2 (optional)", optional: true },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "pincode", label: "Pincode", keyboard: "number-pad" },
  { key: "label", label: "Label (Home / Work)" },
];

function AddressForm({
  colors,
  editing,
  onCancel,
  onSaved,
}: {
  colors: ReturnType<typeof useColors>;
  editing: Address | null;
  onCancel: () => void;
  onSaved: (a: Address) => void;
}) {
  const create = useCreateAddress();
  const update = useUpdateAddress();
  const [form, setForm] = useState<AddressInput>(
    editing
      ? {
          label: editing.label,
          name: editing.name,
          phone: editing.phone,
          line1: editing.line1,
          line2: editing.line2 ?? "",
          city: editing.city,
          state: editing.state,
          pincode: editing.pincode,
          isDefault: editing.isDefault,
        }
      : EMPTY_FORM,
  );
  const [error, setError] = useState("");
  const pending = create.isPending || update.isPending;

  const set = (key: keyof AddressInput, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    setError("");
    const required: (keyof AddressInput)[] = [
      "name",
      "phone",
      "line1",
      "city",
      "state",
      "pincode",
    ];
    for (const k of required) {
      if (!String(form[k] ?? "").trim()) {
        setError("Please fill in all required fields.");
        return;
      }
    }
    const body: AddressInput = {
      ...form,
      label: form.label?.trim() || "Home",
      line2: form.line2?.trim() ? form.line2.trim() : undefined,
    };
    try {
      const saved = editing
        ? await update.mutateAsync({ id: editing.id, body })
        : await create.mutateAsync(body);
      onSaved(saved);
    } catch (err) {
      setError(apiMessage(err, "Could not save address. Please try again."));
    }
  };

  return (
    <>
      <View style={styles.formHeader}>
        <Pressable onPress={onCancel} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground, marginBottom: 0 }]}>
          {editing ? "Edit Address" : "New Address"}
        </Text>
        <View style={{ width: 20 }} />
      </View>
      <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
        {FIELDS.map((f) => (
          <TextInput
            key={f.key}
            style={[
              styles.input,
              {
                borderColor: colors.border,
                color: colors.foreground,
                backgroundColor: colors.background,
              },
            ]}
            placeholder={f.label}
            placeholderTextColor={colors.mutedForeground}
            keyboardType={f.keyboard ?? "default"}
            value={String(form[f.key] ?? "")}
            onChangeText={(t) => set(f.key, t)}
          />
        ))}
        <Pressable
          style={styles.defaultRow}
          onPress={() => setForm((f) => ({ ...f, isDefault: !f.isDefault }))}
        >
          <Feather
            name={form.isDefault ? "check-square" : "square"}
            size={18}
            color={form.isDefault ? colors.primary : colors.mutedForeground}
          />
          <Text style={[styles.defaultText, { color: colors.foreground }]}>
            Set as default address
          </Text>
        </Pressable>
        {error.length > 0 && <Text style={styles.error}>{error}</Text>}
      </ScrollView>
      <Pressable
        style={[styles.saveBtn, { backgroundColor: colors.primary }, pending && { opacity: 0.7 }]}
        onPress={submit}
        disabled={pending}
      >
        {pending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveBtnText}>
            {editing ? "Save Changes" : "Save Address"}
          </Text>
        )}
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 12 },
  handle: { width: 40, height: 4, backgroundColor: "#D1D5DB", borderRadius: 2, alignSelf: "center" },
  title: { fontSize: 18, fontWeight: "800", marginBottom: 4 },
  empty: { fontSize: 14, paddingVertical: 24, textAlign: "center" },
  addrRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  addrName: { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  addrLine: { fontSize: 12, lineHeight: 17 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 13,
  },
  addBtnText: { fontSize: 14, fontWeight: "700" },
  formHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    marginBottom: 10,
  },
  defaultRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  defaultText: { fontSize: 14, fontWeight: "600" },
  error: { color: "#EF4444", fontSize: 13, marginTop: 4 },
  saveBtn: { paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
