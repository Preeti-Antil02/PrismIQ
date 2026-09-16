"use client";

import * as React from "react";
import { AppShell } from "./AppShell";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
