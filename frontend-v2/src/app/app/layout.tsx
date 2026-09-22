"use client";

import * as React from "react";
import "@/styles/app-theme.css";
import { AppShell } from "@/components/app/AppShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
