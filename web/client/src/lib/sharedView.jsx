import { createContext, useContext } from "react";

// A result opened through a share link (/s/<token>): read only, for someone without an account.
export const SharedView = createContext(false);

/** What only the owner can use (save, schedule, restyle, reply): hidden on a shared result. */
export function OwnerOnly({ children }) {
  return useContext(SharedView) ? null : children;
}
