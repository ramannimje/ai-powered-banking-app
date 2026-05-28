"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Calculator, TrendingUp, Target, PieChart, Plus, Loader2, CheckCircle, AlertTriangle, X, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuthStore } from "@/lib/stores/auth";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, AreaChart, Area } from "recharts";

const BUDGET_CATEGORIES = [
  { key: "food", label: "Food & Dining", emoji: "🍔", color: "#F59E0B", budget: 8000 },
  { key: "travel", label: "Travel & Transport", emoji: "✈️", color: "#3B82F6", budget: 5000 },
  { key: "shopping", label: "Shopping", emoji: "🛍️", color: "#EC4899", budget: 10000 },
  { key: "entertainment", label: "Entertainment", emoji: "🎬", color: "#8B5CF6", budget: 3000 },
  { key: "utilities", label: "Bills & Utilities", emoji: "⚡", color: "#10B981", budget: 5000 },
  { key: "health", label: "Health & Fitness", emoji: "💊", color: "#EF4444", budget: 3000 },
  { key: "education", label: "Education", emoji: "📚", color: "#6366F1", budget: 2000 },
];

export default function BudgetPlannerPage() {
  const { accessToken } = useAuthStore();
  const [spending, setSpending] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Affordability form
  const [item, setItem] = useState("");
  const [amount, setAmount] = useState("");
  const [months, setMonths] = useState("6");
  const [result, setResult] = useState<any>(null);
  const [simLoading, setSimLoading] = useState(false);

  // Custom budget form
  const [customBudgets, setCustomBudgets] = useState<Record<string, number>>({});
  const [budgetResult, setBudgetResult] = useState<any>(null);

  useEffect(() => {
    if (!accessToken) return;
    loadSpending();
  }, [accessToken]);

  const loadSpending = async () => {
    setLoading(true);
    try {
      const data = await api.getSpendingAnalytics(30, accessToken!) as any;
      setSpending(data);
      // Init custom budgets from defaults
      const init: Record<string, number> = {};
      BUDGET_CATEGORIES.forEach((c) => { init[c.key] = c.budget; });
      // Override with actual spent
      if (data?.categories) {
        data.categories.forEach((cat: any) => {
          if (init[cat.category] !== undefined) init[cat.category] = Math.max(init[cat.category], cat.total);
        });
      }
      setCustomBudgets(init);
    } catch (err) {
      toast.error("Failed to load spending data");
    } finally {
      setLoading(false);
    }
  };

  const simulate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimLoading(true);
    try {
      const data = await api.budgetSimulate(
        { item, amount: Number(amount), months: Number(months) },
        accessToken!
      ) as any;
      setResult(data);
    } catch (err) {
      toast.error("Simulation failed");
    } finally {
      setSimLoading(false);
    }
  };

  const calculateBudget = () => {
    if (!spending?.categories) return;
    const total = spending.categories.reduce((sum: number, c: any) => sum + c.total, 0);
    const categories = BUDGET_CATEGORIES.map((cat) => {
      const spent = (spending.categories.find((c: any) => c.category === cat.key)?.total || 0);
      const budget = customBudgets[cat.key] || cat.budget;
      const remaining = budget - spent;
      const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
      return { ...cat, spent, budget, remaining, pct, over: spent > budget };
    });

    setBudgetResult({ total, categories, monthlyIncome: spending.total_income });
  };

  useEffect(() => {
    if (spending?.categories) calculateBudget();
  }, [spending]);

  if (loading) return <div className="h-96 bg-muted rounded-xl animate-pulse" />;

  // Budget vs actual chart data
  const chartData = budgetResult?.categories?.map((c: any) => ({
    name: c.label.split(" ")[0],
    budget: c.budget,
    spent: c.spent,
    color: c.over ? "#EF4444" : c.color,
  })) || [];

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calculator className="w-6 h-6" /> Budget Planner
        </h1>
        <p className="text-muted-foreground text-sm">Plan, simulate, and track your monthly budgets with AI insights</p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">📊 Budget Overview</TabsTrigger>
          <TabsTrigger value="simulate">🧮 Affordability Sim</TabsTrigger>
          <TabsTrigger value="categories">📋 Category Budgets</TabsTrigger>
        </TabsList>

        {/* Budget Overview */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Budget vs Actual */}
            <Card className="border-0 shadow-md">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Budget vs Actual</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData} layout="vertical" barSize={20}>
                    <XAxis type="number" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <YAxis dataKey="name" type="category" width={60} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: any, name: string) => [formatCurrency(value), name === "budget" ? "Budget" : "Spent"]} />
                    <Bar dataKey="budget" fill="#E5E7EB" radius={[0, 4, 4, 0]} name="budget" />
                    <Bar dataKey="spent" radius={[0, 4, 4, 0]} name="spent">
                      {chartData.map((entry: any, index: number) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Summary */}
            <Card className="border-0 shadow-md">
              <CardHeader><CardTitle className="text-base">Monthly Summary</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "Total Income", value: spending?.total_income || 0, color: "text-green-600" },
                  { label: "Total Spent", value: spending?.total_spending || 0, color: "text-foreground" },
                  { label: "Savings Rate", value: `${budgetResult ? (((spending?.total_income || 0) - (spending?.total_spending || 0)) / (spending?.total_income || 1) * 100).toFixed(1) : 0}%`, color: "text-indigo-600" },
                  { label: "Categories Over Budget", value: budgetResult?.categories?.filter((c: any) => c.over).length || 0, color: "text-red-600" },
                ].map((stat) => (
                  <div key={stat.label} className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                    <span className="text-sm text-muted-foreground">{stat.label}</span>
                    <span className={`text-xl font-bold ${stat.color}`}>{stat.value}</span>
                  </div>
                ))}

                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-indigo-600" />
                    <span className="text-sm font-medium text-indigo-800">AI Recommendation</span>
                  </div>
                  {budgetResult && (budgetResult.categories.filter((c: any) => c.over).length > 0) ? (
                    <p className="text-xs text-indigo-700">
                      {budgetResult.categories.filter((c: any) => c.over).map((c: any) => c.label).join(", ")} are over budget. Consider reducing discretionary spending.
                    </p>
                  ) : (
                    <p className="text-xs text-indigo-700">Your spending is within budget! Great job managing your finances.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Category breakdown */}
            <Card className="border-0 shadow-md lg:col-span-2">
              <CardHeader><CardTitle className="text-base">Category Status</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {budgetResult?.categories?.map((cat: any) => (
                  <div key={cat.key} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{cat.emoji}</span>
                        <span className="text-sm font-medium">{cat.label}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-muted-foreground">{formatCurrency(cat.spent)} / {formatCurrency(cat.budget)}</span>
                        <Badge variant={cat.over ? "destructive" : cat.pct > 80 ? "warning" : "success"} className="text-xs">
                          {cat.over ? "Over" : `${cat.pct.toFixed(0)}%`}
                        </Badge>
                      </div>
                    </div>
                    <Progress value={cat.pct} className={`h-2 ${cat.over ? "[&>div]:bg-red-500" : ""}`} />
                    <p className="text-xs text-muted-foreground">
                      {cat.remaining >= 0
                        ? `${formatCurrency(cat.remaining)} remaining this month`
                        : `${formatCurrency(Math.abs(cat.remaining))} over budget`
                      }
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Affordability Simulation */}
        <TabsContent value="simulate">
          <div className="max-w-xl space-y-6">
            <Card className="border-0 shadow-md">
              <CardHeader><CardTitle className="text-base">Can I Afford It?</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={simulate} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>What are you buying?</Label>
                      <Input placeholder="e.g. MacBook Pro, Vacation" value={item} onChange={(e) => setItem(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label>Total Cost (₹)</Label>
                      <Input type="number" placeholder="150000" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1" />
                    </div>
                  </div>
                  <div>
                    <Label>Payment Duration (months)</Label>
                    <div className="flex gap-2 mt-1">
                      {["3", "6", "12", "24"].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setMonths(m)}
                          className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${months === m ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-muted"}`}
                        >
                          {m} months
                        </button>
                      ))}
                    </div>
                  </div>
                  <Button type="submit" className="w-full gap-2" disabled={simLoading}>
                    {simLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                    Analyze Affordability
                  </Button>
                </form>
              </CardContent>
            </Card>

            {result && (
              <Card className="border-0 shadow-md">
                <CardContent className="p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">{result.item}</h3>
                    <Badge variant={result.can_afford ? "success" : "destructive"} className="text-sm px-3 py-1 gap-1">
                      {result.can_afford ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                      {result.can_afford ? "Affordable" : "Not Recommended"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: "Total Cost", value: formatCurrency(result.amount) },
                      { label: "Monthly EMI", value: formatCurrency(result.monthly_payment) },
                      { label: "Your Income", value: formatCurrency(result.monthly_income) },
                      { label: "Your Expenses", value: formatCurrency(result.monthly_expenses) },
                    ].map((s) => (
                      <div key={s.label} className="bg-muted rounded-xl p-4 text-center">
                        <p className="text-xs text-muted-foreground">{s.label}</p>
                        <p className="text-lg font-bold mt-1">{s.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Risk Score</span>
                      <span className={`font-medium ${result.risk_score < 50 ? "text-green-600" : result.risk_score < 80 ? "text-amber-600" : "text-red-600"}`}>
                        {result.risk_score}/100
                      </span>
                    </div>
                    <Progress value={result.risk_score} className="h-3" />
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">Savings rate: {result.savings_rate}%</p>
                      <p className={`text-sm font-medium ${result.can_afford ? "text-green-600" : "text-red-600"}`}>{result.recommendation}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Category Budgets */}
        <TabsContent value="categories">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Set Category Budgets</CardTitle>
                <Button size="sm" onClick={calculateBudget} className="gap-2">
                  <Calculator className="w-3 h-3" /> Recalculate
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {BUDGET_CATEGORIES.map((cat) => {
                const current = customBudgets[cat.key] || cat.budget;
                return (
                  <div key={cat.key} className="flex items-center gap-4 p-4 border rounded-xl hover:bg-muted/30 transition-colors">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: cat.color + "20" }}>
                      {cat.emoji}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{cat.label}</p>
                      <p className="text-xs text-muted-foreground">
                        Current spend: {formatCurrency(spending?.categories?.find((c: any) => c.category === cat.key)?.total || 0)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">₹</span>
                      <input
                        type="number"
                        value={current}
                        onChange={(e) => setCustomBudgets({ ...customBudgets, [cat.key]: Number(e.target.value) })}
                        className="w-32 h-9 px-3 rounded-lg border bg-background text-sm font-medium text-right"
                      />
                    </div>
                  </div>
                );
              })}

              {/* Total Budget */}
              <div className="flex items-center justify-between p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                <div>
                  <p className="font-medium">Total Monthly Budget</p>
                  <p className="text-xs text-muted-foreground">Sum of all category budgets</p>
                </div>
                <p className="text-2xl font-bold text-indigo-600">
                  {formatCurrency(Object.values(customBudgets).reduce((a, b) => a + b, 0))}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}