"use client";

import { useCallback, useEffect, useState } from "react";
import type { Identity } from "./types";

const HOUSEHOLD_CODE_KEY = "noticed:household-code";
const IDENTITY_KEY = "noticed:identity";

export function useStoredIdentity() {
  const [code, setCodeState] = useState<string | null>(null);
  const [identity, setIdentityState] = useState<Identity | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCodeState(window.localStorage.getItem(HOUSEHOLD_CODE_KEY));
    const storedIdentity = window.localStorage.getItem(IDENTITY_KEY);
    if (storedIdentity) {
      try {
        setIdentityState(JSON.parse(storedIdentity) as Identity);
      } catch {
        // ignore corrupt storage
      }
    }
    setLoaded(true);
  }, []);

  const join = useCallback((householdCode: string, id: Identity) => {
    window.localStorage.setItem(HOUSEHOLD_CODE_KEY, householdCode);
    window.localStorage.setItem(IDENTITY_KEY, JSON.stringify(id));
    setCodeState(householdCode);
    setIdentityState(id);
  }, []);

  const leave = useCallback(() => {
    window.localStorage.removeItem(HOUSEHOLD_CODE_KEY);
    window.localStorage.removeItem(IDENTITY_KEY);
    setCodeState(null);
    setIdentityState(null);
  }, []);

  return { code, identity, loaded, join, leave };
}
