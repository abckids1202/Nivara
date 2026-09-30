"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type CartItem = {
  id: string;
  quantity: number;
  variantId: string;
  variant: {
    name: string;
    sku: string;
    pricePaise: number;
    stockOnHand: number;
    stockReserved: number;
    product: { name: string; slug: string };
  };
};

type CartContextValue = {
  items: CartItem[];
  count: number;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  addItem: (variantId: string, quantity?: number) => Promise<void>;
  updateItem: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

async function readResponse(response: Response) {
  const payload = await response.json().catch(() => ({})) as { data?: CartItem[]; error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Your bag could not be updated");
  return payload;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/cart", { cache: "no-store" });
      const payload = await readResponse(response);
      setItems(payload.data ?? []);
      setError("");
    } catch (reason: unknown) {
      setItems([]);
      setError(reason instanceof Error ? reason.message : "Your bag could not be loaded");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { queueMicrotask(() => { void refresh(); }); }, [refresh]);

  const addItem = useCallback(async (variantId: string, quantity = 1) => {
    const response = await fetch("/api/cart", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ variantId, quantity }) });
    await readResponse(response);
    await refresh();
  }, [refresh]);

  const updateItem = useCallback(async (itemId: string, quantity: number) => {
    const response = await fetch("/api/cart", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId, quantity }) });
    await readResponse(response);
    await refresh();
  }, [refresh]);

  const removeItem = useCallback(async (itemId: string) => {
    const response = await fetch(`/api/cart?itemId=${encodeURIComponent(itemId)}`, { method: "DELETE" });
    await readResponse(response);
    await refresh();
  }, [refresh]);

  const value = useMemo(() => ({ items, count: items.reduce((sum, item) => sum + item.quantity, 0), loading, error, refresh, addItem, updateItem, removeItem }), [addItem, error, items, loading, refresh, removeItem, updateItem]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
