import { Component, type ReactNode } from "react";
import { Icon } from "./icons";

interface State { error: Error | null; details: string | null; }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, details: null };
  static getDerivedStateFromError(error: Error): State {
    return { error, details: error.message };
  }
  componentDidCatch(error: Error) {
    console.error("[JARVIS UI] error:", error);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full items-center justify-center p-6">
          <div className="glass corner relative max-w-md rounded-xl p-6 text-center">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full border border-red-400/30 bg-red-400/10 text-red-300">
              <Icon name="alert" size={22} />
            </div>
            <h2 className="tech-text text-sm tracking-[0.25em] text-white">SYSTEM FAULT</h2>
            <p className="mt-2 text-sm text-mut">JARVIS could not complete this operation. The interface has been contained and is safe to reset.</p>
            {this.state.details && (
              <pre className="mt-3 overflow-x-auto rounded-md bg-black/40 p-2 text-left text-[10px] text-red-200/70">{this.state.details}</pre>
            )}
            <button className="btn-primary mt-4 w-full" onClick={() => { this.setState({ error: null, details: null }); window.location.reload(); }}>
              <Icon name="retry" size={14} /> RESTART INTERFACE
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
