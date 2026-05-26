"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuthStore } from "@/lib/stores/auth";
import { api } from "@/lib/api";
import { formatCurrency, getCategoryColor } from "@/lib/utils";

export default function AnalyticsPage() {
  const { accessToken } = useAuthStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => { loadData(); }, [days]);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await api.getSpendingAnalytics(days, accessToken!) as any;
      setData(result);
    } catch (err) {
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="h-96 bg-muted rounded-xl animate-pulse" />;
  }

  const categories = (data?.categories || []).map((c: any) => ({
    ...c,
    color: getCategoryColor(c.category),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Spending Analytics</h1>
          <p className="text-muted-foreground">Deep dive into your financial habits</p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <Button key={d} variant={days === d ? "default" : "outline"} size="sm" onClick={() => setDays(d)}>
              {d}D
            </Button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-5 text-center">
            <p className="text-sm text-muted-foreground">Total Spent ({days}D)</p>
            <p className="text-3xl font-bold mt-1">{formatCurrency(data?.total_spending || 0)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="p-5 text-center">
            <p className="text-sm text-muted-foreground">Total Income ({days}D)</p>
            <p className="text-3xl font-bold mt-1 text-green-600">{formatCurrency(data?.total_income || 0)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="p-5 text-center">
            <p className="text-sm text-muted-foreground">Month-over-Month</p>
            <p className={`text-3xl font-bold mt-1 ${(data?.month_over_month_change || 0) > 0 ? "text-red-500" : "text-green-600"}`}>
              {(data?.month_over_month_change || 0) > 0 ? "▲" : "▼"} {Math.abs(data?.month_over_month_change || 0)}%
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-md">
        <CardHeader><CardTitle className="text-base">Spending by Category</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={categories} layout="vertical">
              <XAxis type="number" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <YAxis dataKey="category" type="category" width={80} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: any) => formatCurrency(value)} />
              <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                {categories.map((c: any, i: number) => (
                  <rect key={i} fill={c.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md">
        <CardHeader><CardTitle className="text-base">Top Merchants</CardTitle></CardHeader>
        <CardContent>
          {data?.top_merchants?.length > 0 ? (
            <div className="space-y-3">
              {data.top_merchants.map((m: any, i: number) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm">{m.merchant}</span>
                  <span className="font-semibold">{formatCurrency(m.total)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No merchant data yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}