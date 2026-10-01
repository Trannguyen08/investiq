"use client";

import { useEffect, useSyncExternalStore } from "react";

import { authSnapshot, loadAuth, logoutAuth, serverAuthSnapshot, subscribeAuth } from "@/store/auth-store";

export function useAuth() {
  const state = useSyncExternalStore(subscribeAuth, authSnapshot, serverAuthSnapshot);
  useEffect(() => { void loadAuth(); }, []);
  return { ...state, logout: logoutAuth, refresh: () => loadAuth(true) };
}
