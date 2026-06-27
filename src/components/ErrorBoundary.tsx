import React from "react";
import { RefreshCw } from "lucide-react";

interface State { hasError: boolean; error?: Error }

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-screen flex items-center justify-center bg-teal-hero px-4">
          <div className="text-center max-w-md">
            <div className="text-5xl mb-4">😕</div>
            <h1 className="font-serif text-2xl text-primary mb-2">Une erreur est survenue</h1>
            <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
              Quelque chose s'est mal passé. Essayez de rafraîchir la page ou revenez plus tard.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium border-none cursor-pointer hover:bg-teal-mid transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Rafraîchir la page
            </button>
            {import.meta.env.DEV && this.state.error && (
              <pre className="mt-6 text-left text-xs bg-red-50 text-red-700 p-4 rounded-lg overflow-auto max-h-40">
                {this.state.error.message}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
