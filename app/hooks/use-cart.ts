"use client"

import { useMemo } from "react"
import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface CartItemModifier {
  optionId: string
  optionName: string
  priceAdjustment: number
}

export interface CartItem {
  id: string
  menuItemId: string
  name: string
  basePrice: number
  quantity: number
  modifiers: CartItemModifier[]
}

interface CartState {
  items: CartItem[]
  customerName: string
  setCustomerName: (name: string) => void
  addItem: (item: Omit<CartItem, "id">) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
  getTotal: () => number
  getItemTotal: (item: CartItem) => number
}

// Store instances by org slug
const storeCache = new Map<string, ReturnType<typeof createCartStore>>()

function createCartStore(orgSlug: string) {
  return create<CartState>()(
    persist(
      (set, get) => ({
        items: [],
        customerName: "",

        setCustomerName: (name) => set({ customerName: name }),

        addItem: (item) =>
          set((state) => ({
            items: [
              ...state.items,
              { ...item, id: crypto.randomUUID() },
            ],
          })),

        removeItem: (id) =>
          set((state) => ({
            items: state.items.filter((item) => item.id !== id),
          })),

        updateQuantity: (id, quantity) =>
          set((state) => ({
            items: state.items.map((item) =>
              item.id === id ? { ...item, quantity: Math.max(1, quantity) } : item
            ),
          })),

        clearCart: () => set({ items: [], customerName: "" }),

        getItemTotal: (item) => {
          const modifiersTotal = item.modifiers.reduce(
            (sum, mod) => sum + mod.priceAdjustment,
            0
          )
          return (item.basePrice + modifiersTotal) * item.quantity
        },

        getTotal: () => {
          const state = get()
          return state.items.reduce(
            (sum, item) => sum + state.getItemTotal(item),
            0
          )
        },
      }),
      {
        name: `cafe-cart-${orgSlug}`,
      }
    )
  )
}

function getCartStore(orgSlug: string) {
  if (!storeCache.has(orgSlug)) {
    storeCache.set(orgSlug, createCartStore(orgSlug))
  }
  return storeCache.get(orgSlug)!
}

export function useCart(orgSlug: string): CartState {
  const store = useMemo(() => getCartStore(orgSlug), [orgSlug])
  return store()
}
