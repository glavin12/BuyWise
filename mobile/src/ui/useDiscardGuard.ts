import { usePreventRemove } from "expo-router";
import { useRef, useState } from "react";

import { confirm } from "./confirm";

/**
 * While `dirty`, leaving the screen by any route (header back, Android back
 * button, iOS swipe) first asks "Discard changes?". Call `allowLeave()` right
 * before a deliberate exit such as the one after a successful save: state would
 * be too late, because the exit happens in the same tick.
 */
export function useDiscardGuard(dirty: boolean) {
  const [allowed, setAllowed] = useState(false);
  // A save can navigate before React applies the state change; avoid a stale discard prompt.
  const allowedRef = useRef(false);

  const disablePrevention = usePreventRemove(dirty && !allowed, ({ repeat }) => {
    if (allowedRef.current) return repeat();
    void confirm("Discard changes?", "Your changes haven't been saved.", "Discard", true).then((discard) => {
      if (!discard) return;
      allowedRef.current = true;
      setAllowed(true);
      repeat();
    });
  });

  return {
    allowLeave: () => {
      allowedRef.current = true;
      setAllowed(true);
      disablePrevention();
    },
  };
}
