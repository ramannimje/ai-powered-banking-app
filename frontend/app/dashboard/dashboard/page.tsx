"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, Wallet, PiggyBank, ArrowRight, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/lib/stores/auth";
import { api } from "@/lib/api";
import { formatCurrency, formatRelativeTime, getCategoryColor } from "@/lib/utils";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, LineChart, Line } from "recharts";

export default function DashboardPage() {
  const { accessToken, user } = useAuthStore();
  const [summary, setSummary] = useState<any>(null);
  const [spending, setSpending] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    loadData();
  }, [accessToken]);

  const loadData = async () => {
    try {
      const [summaryData, spendingData] = await Promise.all([
        api.getSummary(accessToken!),
        api.getSpendingAnalytics(30, accessToken!),
      ]);
      setSummary(summaryData as any);
      setSpending(spendingData as any);
      if ((summaryData as any)?.recent_transactions) {
        setTransactions((summaryData as any).recent_transactions);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const pieData = (spending?.categories || []).slice(0, 6).map((c: any) => ({
    name: c.category || "Other",
    value: c.total,
    color: getCategoryColor(c.category),
  }));

  const COLORS = pieData.map((d: any) => d.color);

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold">
          Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, {user?.full_name?.split(" ")[0] || "there"} 👋
        </h1>
        <p className="text-muted-foreground">Here&apos;s your financial overview</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Balance</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(summary?.total_balance || 0)}</p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                <Wallet className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Savings</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(summary?.total_savings || 0)}</p>
              </div>
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                <PiggyBank className="w-5 h-5 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Monthly Spending</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(spending?.total_spending || 0)}</p>
                <p className={`text-xs mt-1 ${(spending?.month_over_month_change || 0) > 0 ? "text-red-500" : "text-green-500"}`}>
                  {(spending?.month_over_month_change || 0) > 0 ? "▲" : "▼"} {Math.abs(spending?.month_over_month_change || 0)}% vs last month
                </p>
              </div>
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Monthly Income</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(spending?.total_income || 0)}</p>
              </div>
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts + Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Spending Breakdown */}
        <Card className="border-0 shadow-md lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Spending Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="pie">
              <TabsList className="mb-4">
                <TabsTrigger value="pie">By Category</TabsTrigger>
                <TabsTrigger value="bar">Trend</TabsTrigger>
              </TabsList>
              <TabsContent value="pie">
                {pieData.length > 0 ? (
                  <div className="flex items-center gap-6">
                    <div className="w-48 h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <RePieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                            {pieData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: any) => formatCurrency(value)} />
                        </RePieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2 flex-1">
                      {pieData.map((d: any) => (
                        <div key={d.name} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                            <span className="capitalize">{d.name}</span>
                          </div>
                          <span className="font-medium">{formatCurrency(d.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No spending data yet</p>
                )}
              </TabsContent>
              <TabsContent value="bar">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={pieData}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: any) => formatCurrency(value)} />
                    <Bar dataKey="value" fill="#6366F1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card className="border-0 shadow-md">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Transactions</CardTitle>
            <Link href="/dashboard/transactions">
              <Button variant="ghost" size="sm" className="text-xs">
                View all <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {transactions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No transactions yet</p>
            ) : (
              transactions.slice(0, 5).map((t: any) => (
                <div key={t.id} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${
                      t.type?.includes("credit") ? "bg-green-100 text-green-600" : "bg-muted text-muted-foreground"
                    }`}>
                      {t.type?.includes("credit") ? "↑" : "↓"}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{t.merchant || t.category || "Transaction"}</p>
                      <p className="text-xs text-muted-foreground">{formatRelativeTime(t.created_at)}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-medium ${t.type?.includes("credit") ? "text-green-600" : ""}`}>
                    {t.type?.includes("credit") ? "+" : "-"}{formatCurrency(t.amount)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3 flex-wrap">
        <Link href="/dashboard/transfers">
          <Button className="gap-2"><ArrowRight className="w-4 h-4" /> Send Money</Button>
        </Link>
        <Link href="/dashboard/savings-vaults">
          <Button variant="outline" className="gap-2"><PiggyBank className="w-4 h-4" /> Create Savings Vault</Button>
        </Link>
        <Link href="/dashboard/ai-copilot">
          <Button variant="outline" className="gap-2"><Activity className="w-4 h-4" /> Ask AI Copilot</Button>
        </Link>
      </div>
    </div>
  );
}