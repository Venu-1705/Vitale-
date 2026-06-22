import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Alert } from "react-native";
import { fetchCoachThread, persistMessageToCoach } from "@/lib/messaging";
import { useMyGrants } from "@/lib/access";

export type Message = {
  id: string;
  text: string;
  sentBy: "user" | "coach";
  timestamp: number;
  read: boolean;
};

export type Chat = {
  coachId: string;
  coachName: string;
  coachInitials: string;
  coachColor: string;
  programId: string;
  programName: string;
  isActive: boolean;
  messages: Message[];
};

type MessagingContextType = {
  chats: Chat[];
  totalUnread: number;
  /** True once the initial real-thread fetch has completed (for empty-state gating). */
  loaded: boolean;
  sendMessage: (coachId: string, text: string) => void;
  markChatRead: (coachId: string) => void;
  getChat: (coachId: string) => Chat | undefined;
  /** Refetch the real coach thread (D13) — for pull-to-refresh / polling. */
  refresh: () => void;
};

/** Stable key for the client's real coach conversation injected into `chats`. */
export const REAL_COACH_ID = "my-coach";

const MessagingContext = createContext<MessagingContextType | null>(null);

/** Build the single "Your Coach" chat from the real D13 thread. */
function buildRealChat(messages: Message[]): Chat {
  return {
    coachId: REAL_COACH_ID,
    coachName: "Your Coach",
    coachInitials: "YC",
    coachColor: "#16A34A",
    programId: "",
    programName: "Coaching",
    isActive: true,
    messages,
  };
}

export function MessagingProvider({ children }: { children: React.ReactNode }) {
  // Starts EMPTY — no seeded/fake chats. The only chat is the real coach thread (if any).
  const [chats, setChats] = useState<Chat[]>([]);
  const [loaded, setLoaded] = useState(false);

  // A coaching org exists only once the client has an active access grant.
  const grants = useMyGrants();
  const hasCoachOrg = (grants.data ?? []).some((g) => g.status === "active");

  // Load the REAL coach thread (D13). A thread → the single chat; null (no org / no
  // conversation yet) → no chats (empty state). Server-sourced; never persisted.
  const refresh = useCallback(() => {
    fetchCoachThread()
      .then((thread) => {
        if (!thread) {
          setChats([]);
          return;
        }
        const realChat = buildRealChat(
          thread.messages.map((m) => ({
            id: m.id,
            text: m.text,
            sentBy: m.sentByUser ? "user" : "coach",
            timestamp: m.timestamp,
            read: true,
          })),
        );
        setChats([realChat]);
      })
      .catch(() => setChats([]))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const sendMessage = useCallback((_coachId: string, text: string) => {
    if (!hasCoachOrg) {
      Alert.alert(
        "No coach connected",
        "You haven't connected to a coach yet. Go to your profile and enter your organization ID.",
      );
      return;
    }
    // Persist to the real coach conversation (created on first send), then refresh.
    void persistMessageToCoach(text)
      .then(() => { setTimeout(refresh, 600); })
      .catch(() => {});
    // Optimistic append to the single real thread (create it locally if first message).
    setChats((prev) => {
      const newMsg: Message = {
        id: Date.now().toString() + Math.random().toString(36).slice(2, 8),
        sentBy: "user",
        text,
        timestamp: Date.now(),
        read: true,
      };
      const existing = prev.find((c) => c.coachId === REAL_COACH_ID);
      if (existing) {
        return prev.map((c) =>
          c.coachId === REAL_COACH_ID ? { ...c, messages: [...c.messages, newMsg] } : c,
        );
      }
      return [buildRealChat([newMsg])];
    });
  }, [hasCoachOrg, refresh]);

  const markChatRead = useCallback((coachId: string) => {
    setChats((prev) =>
      prev.map((c) =>
        c.coachId === coachId ? { ...c, messages: c.messages.map((m) => ({ ...m, read: true })) } : c,
      ),
    );
  }, []);

  const getChat = useCallback((coachId: string) => chats.find((c) => c.coachId === coachId), [chats]);

  const totalUnread = chats.reduce(
    (sum, c) => sum + c.messages.filter((m) => m.sentBy === "coach" && !m.read).length,
    0
  );

  return (
    <MessagingContext.Provider value={{ chats, totalUnread, loaded, sendMessage, markChatRead, getChat, refresh }}>
      {children}
    </MessagingContext.Provider>
  );
}

export function useMessaging() {
  const ctx = useContext(MessagingContext);
  if (!ctx) throw new Error("useMessaging must be inside MessagingProvider");
  return ctx;
}
