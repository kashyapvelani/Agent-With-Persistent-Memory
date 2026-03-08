"use client"

import { useState, useCallback } from "react"

export function useSidebar(defaultCollapsed = false) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  const toggle = useCallback(() => setCollapsed((prev) => !prev), [])

  return { collapsed, toggle }
}
