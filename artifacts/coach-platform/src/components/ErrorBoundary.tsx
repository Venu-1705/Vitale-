import {
  Component,
  type ComponentType,
  type ErrorInfo,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ErrorFallbackProps = {
  error: Error;
  resetError: () => void;
};

/** Full-page fallback shown when a render error escapes to the boundary. */
export function ErrorFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-red-600" />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred. You can try again, or reload the page.
          </p>
        </div>
        {import.meta.env.DEV && (
          <pre className="text-left text-xs bg-muted rounded-md p-3 overflow-auto max-h-40 text-muted-foreground">
            {error.message}
          </pre>
        )}
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" onClick={resetError}>
            Try again
          </Button>
          <Button onClick={() => window.location.reload()}>Reload page</Button>
        </div>
      </div>
    </div>
  );
}

export type ErrorBoundaryProps = PropsWithChildren<{
  FallbackComponent?: ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, info: ErrorInfo) => void;
}>;

type ErrorBoundaryState = { error: Error | null };

/**
 * Error boundaries must be class components — React only exposes the catch
 * lifecycle (getDerivedStateFromError / componentDidCatch) on classes.
 * Wraps the router so a render throw shows a recoverable fallback instead of a
 * blank white screen.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  resetError = (): void => this.setState({ error: null });

  render(): ReactNode {
    const Fallback = this.props.FallbackComponent ?? ErrorFallback;
    if (this.state.error) {
      return <Fallback error={this.state.error} resetError={this.resetError} />;
    }
    return this.props.children;
  }
}
