"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, Check, CheckCheck, Filter, AlertTriangle, Bot, Sparkles, CreditCard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuthStore } from "@/lib/stores/auth";
import { api } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";

const TYPE_ICONS: Record<string, any> = {
  fraud_alert: AlertTriangle,
  savings: Sparkles,
  budget: CreditCard,
  transfer: CreditCard,
  ai_copilot: Bot,
};

const TYPE_COLORS: Record<string, string> = {
  fraud_alert: "text-red-600 bg-red-100",
  savings: "text-emerald-600 bg-emerald-100",
  budget: "text-amber-600 bg-amber-100",
  transfer: "text-blue-600 bg-blue-100",
  ai_copilot: "text-indigo-600 bg-indigo-100",
};

export default function NotificationsPage() {
  const { accessToken } = useAuthStore();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    if (!accessToken) return;
    loadNotifications();
  }, [accessToken]);

  const loadNotifications = async () => {
    try {
      const params: Record<string, string> = { page: "1", page_size: "50" };
      if (filter === "unread") params.unread_only = "true";
      const data = await api.getNotifications(params, accessToken!) as any[];
      setNotifications(data || []);
    } catch (err) {
      toast.error("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (id: string) => {
    try {
      await api.markNotificationRead(id, accessToken!);
      setNotifications(notifications.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch (err) {
      toast.error("Failed to mark as read");
    }
  };

  const markAllRead = async () => {
    const unread = notifications.filter((n) => !n.is_read);
    for (const n of unread) {
      await api.markNotificationRead(n.id, accessToken!);
    }
    setNotifications(notifications.map((n) => ({ ...n, is_read: true })));
    toast.success("All notifications marked as read");
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="w-5 h-5" /> Notifications
          </h1>
          <p className="text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}` : "All caught up!"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" className="gap-2" onClick={markAllRead}>
            <CheckCheck className="w-4 h-4" /> Mark all read
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      <Tabs defaultValue="all" onValueChange={(v) => { setFilter(v as any); loadNotifications(); }}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread</TabsTrigger>
          <TabsTrigger value="fraud">Fraud Alerts</TabsTrigger>
          <TabsTrigger value="savings">Savings</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="border-0 shadow-md">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-16">
              <Bell className="w-12 h-12 mx-auto text-muted-foreground/20 mb-4" />
              <p className="text-muted-foreground">No notifications yet</p>
              <p className="text-sm text-muted-foreground mt-1">You&apos;ll see fraud alerts, savings updates, and more here</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notif) => {
                const Icon = TYPE_ICONS[notif.type] || Bell;
                const colorClass = TYPE_COLORS[notif.type] || "text-gray-600 bg-gray-100";
                return (
                  <div
                    key={notif.id}
                    className={`flex items-start gap-4 p-5 hover:bg-muted/30 transition-colors ${!notif.is_read ? "bg-primary/5" : ""}`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-sm">{notif.title}</p>
                          <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{notif.body}</p>
                          <p className="text-xs text-muted-foreground mt-2">{formatRelativeTime(notif.created_at)}</p>
                        </div>
                        {!notif.is_read && (
                          <div className="flex-shrink-0 flex items-center gap-2">
                            <span className="w-2 h-2 bg-primary rounded-full" />
                            <button
                              onClick={() => markRead(notif.id)}
                              className="text-xs text-primary hover:underline"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}