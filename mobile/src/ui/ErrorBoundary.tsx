import { Component, Fragment, type ErrorInfo, type ReactNode } from "react";

import { Button } from "./Button";
import { Screen } from "./Screen";
import { EmptyState } from "./States";

type State = { hasError: boolean; attempt: number };

/**
 * L6: an unhandled render error shows "Something went wrong" with a Restart
 * button instead of a white screen. The auth session lives in secure storage,
 * so it survives. Restart remounts the whole app tree from a clean state.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, attempt: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // No crash reporter yet; console is the log until one is added.
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  restart = () => this.setState((s) => ({ hasError: false, attempt: s.attempt + 1 }));

  render() {
    if (this.state.hasError) {
      return (
        <Screen scroll={false}>
          <EmptyState
            icon="warning-outline"
            title="Something went wrong"
            message="BuyWise hit an unexpected problem. Your data is safe."
          />
          <Button title="Restart" onPress={this.restart} />
        </Screen>
      );
    }
    // Changing the key remounts every child, discarding whatever state crashed.
    return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>;
  }
}
