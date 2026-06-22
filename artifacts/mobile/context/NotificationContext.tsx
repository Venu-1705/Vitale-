import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export type NotifType =
  | "meal_reminder"
  | "streak"
  | "leaderboard"
  | "badge"
  | "session"
  | "community"
  | "coach_message"
  | "program_update"
  | "weekly_summary";

export type AppNotification = {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
  route?: string;
};

const NOW = new Date("2026-05-22T12:00:00.000Z").getTime();
const H = 3600000;

const SEED: AppNotification[] = [
  {
    id: "n1", type: "coach_message",
    title: "Dr. Meera Shah sent you a message",
    body: "\"Bloating is common with PCOS. Try reducing chickpeas this week and see if it helps.\"",
    timestamp: NOW - 1 * H, read: false, route: "/messages",
  },
  {
    id: "n2", type: "meal_reminder",
    title: "Time for breakfast!",
    body: "Check your meal plan — Oats Porridge with Almonds is ready.",
    timestamp: NOW - 2 * H, read: true, route: "/",
  },
  {
    id: "n3", type: "streak",
    title: "Don't break your streak!",
    body: "You're on a 5-day streak. Log your lunch to keep it going.",
    timestamp: NOW - 5 * H, read: false, route: "/",
  },
  {
    id: "n4", type: "session",
    title: "Session starting soon",
    body: "PCOS Diet Q&A with Dr. Meera Shah starts in 15 minutes.",
    timestamp: NOW - 2 * 24 * H, read: true, route: "/my-sessions",
  },
  {
    id: "n5", type: "badge",
    title: "Badge earned!",
    body: "You earned the '7-Day Streak' badge. Keep it up!",
    timestamp: NOW - 3 * 24 * H, read: true, route: "/badges",
  },
  {
    id: "n6", type: "leaderboard",
    title: "You moved up the leaderboard!",
    body: "You climbed to #8 this week. Keep logging meals to rise higher.",
    timestamp: NOW - 4 * 24 * H, read: true, route: "/(tabs)/community",
  },
  {
    id: "n7", type: "community",
    title: "Riya liked your post",
    body: "\"This quinoa bowl recipe is amazing!\" — 14 others also liked it.",
    timestamp: NOW - 3 * 24 * H, read: true, route: "/(tabs)/community",
  },
  {
    id: "n8", type: "weekly_summary",
    title: "Your weekly report is ready",
    body: "You logged 18/21 meals this week. Great consistency! View full report.",
    timestamp: NOW - 8 * 24 * H, read: true, route: "/weekly-report",
  },
  {
    id: "n9", type: "program_update",
    title: "New diet chart assigned",
    body: "Dr. Meera Shah has assigned you a new diet chart for week 3.",
    timestamp: NOW - 12 * 24 * H, read: true, route: "/(tabs)/programs",
  },
];

type NotificationContextType = {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  dismiss: (id: string) => void;
  addNotification: (n: Omit<AppNotification, "id" | "read" | "timestamp">) => void;
};

const NotificationContext = createContext<NotificationContextType | null>(null);
const STORAGE_KEY = "vitale_notifications_v1";

function generateId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>(SEED);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try { setNotifications(JSON.parse(raw)); } catch {}
      }
    });
  }, []);

  const save = useCallback((ns: AppNotification[]) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ns)).catch(() => {});
  }, []);

  const addNotification = useCallback((n: Omit<AppNotification, "id" | "read" | "timestamp">) => {
    const newNotif: AppNotification = {
      ...n,
      id: generateId(),
      read: false,
      timestamp: Date.now(),
    };
    setNotifications((prev) => {
      const next = [newNotif, ...prev];
      save(next);
      return next;
    });
  }, [save]);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      save(next);
      return next;
    });
  }, [save]);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      save(next);
      return next;
    });
  }, [save]);

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => {
      const next = prev.filter((n) => n.id !== id);
      save(next);
      return next;
    });
  }, [save]);

  useEffect(() => {
    const now = new Date();
    const hour = now.getHours();

    const schedules: Array<{ delayMs: number; notif: Omit<AppNotification, "id" | "read" | "timestamp"> }> = [];

    if (hour >= 7 && hour < 9) {
      schedules.push({
        delayMs: (8 * 60 - (hour * 60 + now.getMinutes())) * 60000,
        notif: {
          type: "meal_reminder",
          title: "Breakfast time!",
          body: "Your meal plan has Oats Porridge with Almonds today.",
          route: "/",
        },
      });
    }
    if (hour >= 12 && hour < 14) {
      schedules.push({
        delayMs: (13 * 60 - (hour * 60 + now.getMinutes())) * 60000,
        notif: {
          type: "meal_reminder",
          title: "Time for lunch!",
          body: "Grilled Chicken & Brown Rice Bowl is on your plan today.",
          route: "/",
        },
      });
    }
    if (hour >= 7 && hour < 20) {
      const msUntil8pm = (20 * 60 - (hour * 60 + now.getMinutes())) * 60000;
      if (msUntil8pm > 0) {
        schedules.push({
          delayMs: msUntil8pm,
          notif: {
            type: "streak",
            title: "Don't break your 5-day streak!",
            body: "You haven't logged any meals today. Log now to keep your streak alive.",
            route: "/",
          },
        });
      }
    }

    const dayOfWeek = now.getDay();
    if (dayOfWeek === 1 && hour < 9) {
      const msUntil9am = (9 * 60 - (hour * 60 + now.getMinutes())) * 60000;
      schedules.push({
        delayMs: Math.max(msUntil9am, 1000),
        notif: {
          type: "weekly_summary",
          title: "Your weekly report is ready",
          body: "See how you did last week and plan for a great week ahead.",
          route: "/weekly-report",
        },
      });
    }

    for (const { delayMs, notif } of schedules) {
      if (delayMs > 0 && delayMs < 12 * H) {
        const t = setTimeout(() => addNotification(notif), delayMs);
        timersRef.current.push(t);
      }
    }

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [addNotification]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, dismiss, addNotification }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be inside NotificationProvider");
  return ctx;
}
