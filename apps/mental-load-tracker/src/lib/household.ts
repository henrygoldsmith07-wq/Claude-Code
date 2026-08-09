"use client";

import { useEffect, useState } from "react";
import { generateHouseholdCode } from "./code";
import { supabase } from "./supabase";

export type HouseholdStatus = "idle" | "loading" | "ready" | "not-found" | "error";

export function useHouseholdRecord(code: string | null) {
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [status, setStatus] = useState<HouseholdStatus>("idle");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!supabase || !code) {
        setStatus("idle");
        return;
      }
      setStatus("loading");
      const { data, error } = await supabase
        .from("households")
        .select("id")
        .eq("code", code)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        setStatus("error");
        return;
      }
      if (!data) {
        setStatus("not-found");
        return;
      }
      setHouseholdId(data.id as string);
      setStatus("ready");
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [code]);

  return { householdId, status };
}

/** Creates a new household with a fresh code, retrying on rare code collisions. */
export async function createHousehold(): Promise<string | null> {
  if (!supabase) return null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateHouseholdCode();
    const { error } = await supabase.from("households").insert({ code });
    if (!error) return code;
  }
  return null;
}
