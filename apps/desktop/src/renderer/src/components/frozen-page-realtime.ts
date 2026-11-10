import type { WSContextValue } from "@multica/core/realtime";
import type { FrozenPageLifecycle } from "./frozen-page-lifecycle";

export function frozenRealtime(ws: WSContextValue, lifecycle: FrozenPageLifecycle): WSContextValue {
  return {
    subscribe: (event, handler) => lifecycle.track(() => ws.subscribe(event, handler)),
    onReconnect: (handler) => lifecycle.track(() => ws.onReconnect(handler)),
  };
}
