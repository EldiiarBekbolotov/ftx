"use client"

import { DevModeProvider } from "./DevMode"

export function DevModeWrapper({ children }: { children: React.ReactNode }) {
  return <DevModeProvider>{children}</DevModeProvider>
}
