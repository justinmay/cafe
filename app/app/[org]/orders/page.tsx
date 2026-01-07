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
          order.id === orderId ? { ...order, status } : order
        )
      )
      toast.success(`Order marked as ${STATUS_LABELS[status]}`)
    } catch {
      toast.error("Failed to update order status")
    } finally {
      setUpdating(null)
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
                  <div className="space-y-1 text-sm">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex justify-between">
                        <span>
                          {item.quantity}x {item.menuItem.name}
                          {item.modifiers.length > 0 && (
                            <span className="text-muted-foreground ml-1">
                              ({item.modifiers
                                .map((m) => m.modifierOption.name)
                                .join(", ")}
                              )
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
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
