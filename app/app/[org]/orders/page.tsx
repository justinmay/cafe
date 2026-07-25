"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatPrice } from "@/lib/format"
import { toast } from "sonner"
import { CircleCheckIcon, CircleIcon, Loader2Icon } from "lucide-react"

interface OrderItemModifier {
  id: string
  priceAdjustment: number
  modifierOption: {
    name: string
  }
}

interface OrderItem {
  id: string
  quantity: number
  unitPrice: number
  completed: boolean
  menuItem: {
    name: string
  }
  modifiers: OrderItemModifier[]
}

interface Order {
  id: string
  orderNumber: number
  customerName: string
  status: "RECEIVED" | "PREPARING" | "READY"
  total: number
  createdAt: string
  items: OrderItem[]
}

const STATUS_LABELS = {
  RECEIVED: "Received",
  PREPARING: "Preparing",
  READY: "Ready",
}

const STATUS_COLORS = {
  RECEIVED: "bg-yellow-500",
  PREPARING: "bg-blue-500",
  READY: "bg-green-500",
}

export default function OrdersPage() {
  const params = useParams()
  const org = params.org as string
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>("active")
  const [updating, setUpdating] = useState<string | null>(null)
  const [updatingItem, setUpdatingItem] = useState<string | null>(null)
  const [pollStatus, setPollStatus] = useState<"ok" | "error">("ok")

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(`/api/${org}/orders`)
      if (!res.ok) throw new Error("Failed to fetch orders")
      const data = await res.json()
      setOrders(Array.isArray(data) ? data : [])
      setPollStatus("ok")
    } catch {
      setPollStatus("error")
    } finally {
      setLoading(false)
    }
  }, [org])

  useEffect(() => {
    fetchOrders()
    const interval = setInterval(fetchOrders, 5000)
    return () => clearInterval(interval)
  }, [fetchOrders])

  async function updateStatus(
    orderId: string,
    status: "RECEIVED" | "PREPARING" | "READY"
  ) {
    setUpdating(orderId)
    try {
      const res = await fetch(`/api/${org}/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })

      if (!res.ok) throw new Error("Failed to update status")

      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId
            ? {
                ...order,
                status,
                items:
                  status === "READY"
                    ? order.items.map((item) => ({
                        ...item,
                        completed: true,
                      }))
                    : status === "RECEIVED"
                      ? order.items.map((item) => ({
                          ...item,
                          completed: false,
                        }))
                      : order.items,
              }
            : order
        )
      )
      toast.success(`Order marked as ${STATUS_LABELS[status]}`)
    } catch {
      toast.error("Failed to update order status")
    } finally {
      setUpdating(null)
    }
  }

  async function toggleItemCompletion(orderId: string, item: OrderItem) {
    const completed = !item.completed
    setUpdatingItem(item.id)

    try {
      const res = await fetch(
        `/api/${org}/orders/${orderId}/items/${item.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed }),
        }
      )

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || "Failed to update item")
      }

      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId
            ? {
                ...order,
                items: order.items.map((orderItem) =>
                  orderItem.id === item.id
                    ? { ...orderItem, completed }
                    : orderItem
                ),
              }
            : order
        )
      )
      toast.success(
        completed
          ? `${item.menuItem.name} crossed off`
          : `${item.menuItem.name} reopened`
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update item"
      )
    } finally {
      setUpdatingItem(null)
    }
  }

  const filteredOrders = orders.filter((order) => {
    if (filter === "active") return order.status !== "READY"
    if (filter === "finished") return order.status === "READY"
    return true
  })

  if (loading) {
    return (
      <div className="min-h-screen p-4">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-3xl font-bold mb-6">Orders</h1>
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Orders</h1>
            <span className="relative flex h-3 w-3" title={pollStatus === "ok" ? "Connected" : "Connection error"}>
              {pollStatus === "ok" && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              )}
              <span className={`relative inline-flex rounded-full h-3 w-3 ${
                pollStatus === "ok" ? "bg-green-500" : "bg-red-500"
              }`} />
            </span>
          </div>
          <Link href={`/${org}/admin`}>
            <Button variant="outline">Admin</Button>
          </Link>
        </div>

        <Tabs value={filter} onValueChange={setFilter} className="mb-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="finished">Finished</TabsTrigger>
          </TabsList>
        </Tabs>

        {filteredOrders.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No orders to display
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredOrders.map((order) => (
              <Card key={order.id}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-2xl">
                        #{order.orderNumber}
                      </CardTitle>
                      <p className="text-lg font-medium">
                        {order.customerName}
                      </p>
                    </div>
                    <Badge className={STATUS_COLORS[order.status]}>
                      {STATUS_LABELS[order.status]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-start gap-2 rounded-lg border p-2.5 transition-colors ${
                          item.completed
                            ? "border-green-200 bg-green-50/80 dark:border-green-900 dark:bg-green-950/30"
                            : "bg-background"
                        }`}
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className={`-ml-1 -mt-0.5 ${
                            item.completed
                              ? "text-green-600 hover:text-green-700"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                          onClick={() =>
                            toggleItemCompletion(order.id, item)
                          }
                          disabled={
                            order.status !== "PREPARING" ||
                            updatingItem === item.id
                          }
                          aria-label={
                            item.completed
                              ? `Reopen ${item.menuItem.name}`
                              : `Cross off ${item.menuItem.name}`
                          }
                          aria-pressed={item.completed}
                        >
                          {updatingItem === item.id ? (
                            <Loader2Icon className="size-5 animate-spin" />
                          ) : item.completed ? (
                            <CircleCheckIcon className="size-5" />
                          ) : (
                            <CircleIcon className="size-5" />
                          )}
                        </Button>
                        <div className="min-w-0 flex-1">
                          <p
                            className={
                              item.completed
                                ? "text-muted-foreground line-through"
                                : "font-medium"
                            }
                          >
                            {item.quantity}x {item.menuItem.name}
                          </p>
                          {item.modifiers.length > 0 && (
                            <p
                              className={`text-muted-foreground ${
                                item.completed ? "line-through" : ""
                              }`}
                            >
                              {item.modifiers
                                .map((m) => m.modifierOption.name)
                                .join(", ")}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                    {order.status === "RECEIVED" && (
                      <p className="pt-1 text-xs text-muted-foreground">
                        Start preparing this order to check off individual
                        items.
                      </p>
                    )}
                  </div>

                  <div className="flex justify-between font-medium">
                    <span>Total</span>
                    <span>{formatPrice(order.total)}</span>
                  </div>

                  <div className="flex gap-2">
                    {order.status === "RECEIVED" && (
                      <Button
                        className="flex-1"
                        onClick={() => updateStatus(order.id, "PREPARING")}
                        disabled={updating === order.id}
                      >
                        Start Preparing
                      </Button>
                    )}
                    {order.status === "PREPARING" && (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => updateStatus(order.id, "RECEIVED")}
                          disabled={updating === order.id}
                        >
                          Back
                        </Button>
                        <Button
                          className="flex-1"
                          onClick={() => updateStatus(order.id, "READY")}
                          disabled={updating === order.id}
                        >
                          Mark Ready
                        </Button>
                      </>
                    )}
                    {order.status === "READY" && (
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => updateStatus(order.id, "PREPARING")}
                        disabled={updating === order.id}
                      >
                        Back to Preparing
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
