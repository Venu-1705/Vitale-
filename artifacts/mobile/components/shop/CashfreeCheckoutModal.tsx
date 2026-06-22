// =============================================================================
// Cashfree hosted checkout (WebView) — renders a payment_session_id via the
// Cashfree v3 JS SDK inside an in-app WebView. The server creates the order and
// sets a return_url sentinel; when the WebView navigates to that sentinel after
// the payment attempt, we treat checkout as complete and let the caller confirm
// the authoritative status from the backend (the gateway webhook is the source of
// truth — this modal only drives the payment UI).
// =============================================================================
import React from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { WebView, type WebViewNavigation } from "react-native-webview";

/** Sandbox vs production for the JS SDK. Defaults to sandbox unless explicitly set. */
const CASHFREE_MODE =
  process.env.EXPO_PUBLIC_CASHFREE_MODE === "production" ? "production" : "sandbox";

/** Sentinel the hosted checkout returns to so the WebView can detect completion. */
export const CASHFREE_RETURN_URL = "https://vitale.app/cashfree-return";

function buildHtml(paymentSessionId: string): string {
  // Loads the official Cashfree v3 web SDK and immediately opens checkout in-page.
  // redirectTarget "_self" keeps the flow inside this WebView; on completion Cashfree
  // redirects to the order's return_url (CASHFREE_RETURN_URL), which we intercept.
  const safeSession = paymentSessionId.replace(/"/g, "");
  return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
    <script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
  </head>
  <body style="margin:0;padding:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#334155;">
    <div id="status">Loading secure checkout…</div>
    <script>
      function startCheckout() {
        try {
          var cashfree = Cashfree({ mode: "${CASHFREE_MODE}" });
          cashfree.checkout({ paymentSessionId: "${safeSession}", redirectTarget: "_self" });
        } catch (e) {
          document.getElementById('status').innerText = 'Unable to start checkout. Please try again.';
        }
      }
      if (window.Cashfree) startCheckout();
      else window.addEventListener('load', startCheckout);
    </script>
  </body>
</html>`;
}

interface Props {
  visible: boolean;
  paymentSessionId: string;
  /** Fired once the payment attempt finishes (success OR cancel at the gateway). */
  onComplete: () => void;
  /** Fired when the user dismisses the sheet without finishing. */
  onClose: () => void;
}

export function CashfreeCheckoutModal({ visible, paymentSessionId, onComplete, onClose }: Props) {
  const insets = useSafeAreaInsets();

  // Intercept the return sentinel before it actually loads (the URL is not real).
  const handleShouldStart = (req: { url: string }): boolean => {
    if (req.url.startsWith(CASHFREE_RETURN_URL)) {
      onComplete();
      return false;
    }
    return true;
  };

  const handleNavChange = (nav: WebViewNavigation): void => {
    if (nav.url && nav.url.startsWith(CASHFREE_RETURN_URL)) {
      onComplete();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 12 : insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
            <Feather name="x" size={22} color="#0f172a" />
          </Pressable>
          <Text style={styles.title}>Secure Payment</Text>
          <View style={{ width: 28 }} />
        </View>
        {visible && paymentSessionId ? (
          <WebView
            originWhitelist={["*"]}
            source={{ html: buildHtml(paymentSessionId) }}
            onShouldStartLoadWithRequest={handleShouldStart}
            onNavigationStateChange={handleNavChange}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loading}>
                <ActivityIndicator size="large" color="#16A34A" />
              </View>
            )}
            style={styles.web}
          />
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#16A34A" />
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  closeBtn: { padding: 2 },
  title: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  web: { flex: 1 },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
});
