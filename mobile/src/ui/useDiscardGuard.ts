import { useNavigation } from "expo-router";
import { useEffect, useRef } from "react";

import { confirm } from "./confirm";

/**
 * While `dirty`, leaving the screen by any route (header back, Android back
 * button, iOS swipe) first asks "Discard changes?". Call `allowLeave()` right
 * before a deliberate exit such as the one after a successful save: state would
 * be too late, because the exit happens in the same tick.
 */
export function useDiscardGuard(dirty: boolean) {
  const navigation = useNavigation();
  const allowed = useRef(false);

  useEffect(() => {
    if (!dirty) return;
    return navigation.addListener("beforeRemove", (event) => {
      if (allowed.current) return;
      event.preventDefault();
      void confirm("Discard changes?", "Your changes haven't been saved.", "Discard", true).then((discard) => {
        if (!discard) return;
        allowed.current = true;
        navigation.dispatch(event.data.action);
      });
    });
  }, [dirty, navigation]);

  return {
    allowLeave: () => {
      allowed.current = true;
    },
  };
}
