import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface QueryErrorProps {
  /** Friendly message; defaults to a generic connection line. */
  message?: string;
  /** Retry handler — typically a react-query `refetch`. */
  onRetry?: () => void;
  /** Whether a retry is currently in flight (shows a spinner). */
  retrying?: boolean;
  /** Tighten the vertical padding when embedded in a small area. */
  compact?: boolean;
}

/**
 * Standard inline error state for a failed data fetch. Reused across pages so a
 * backend hiccup shows a clear message + retry instead of a stuck spinner or a
 * blank area.
 */
export function QueryError({ message, onRetry, retrying, compact }: QueryErrorProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 text-center ${
        compact ? "py-8" : "py-16"
      }`}
    >
      <AlertCircle className="w-8 h-8 text-muted-foreground opacity-50" />
      <p className="text-sm text-muted-foreground max-w-xs">
        {message ?? "Couldn't load this. Please check your connection and try again."}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
          {retrying ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Try again
        </Button>
      )}
    </div>
  );
}
