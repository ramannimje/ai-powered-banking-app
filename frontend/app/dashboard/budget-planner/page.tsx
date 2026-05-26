"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Calculator, TrendingUp, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/stores/auth";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

export default function BudgetPlannerPage() {
  const { accessToken } = useAuthStore();
  const [item, setItem] = useState("");
  const [amount, setAmount] = useState("");
  const [months, setMonths] = useState("6");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const simulate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await api.budgetSimulate(
        { item, amount: Number(amount), months: Number(months) },
        accessToken!
      ) as any;
      setResult(data);
    } catch (err) {
      toast.error("Simulation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calculator className="w-6 h-6" /> Budget Planner
        </h1>
        <p className="text-muted-foreground">"Can I afford it?" — get an AI-powered answer</p>
      </div>

      <Card className="border-0 shadow-md">
        <CardHeader><CardTitle className="text-base">Affordability Check</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={simulate} className="space-y-4">
            <div>
              <Label>What are you planning to buy?</Label>
              <Input
                placeholder="e.g. MacBook Pro, Vacation, Car"
                value={item}
                onChange={(e) => setItem(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Total Cost (₹)</Label>
                <Input type="number" placeholder="150000" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Payment Duration (months)</Label>
                <Input type="number" placeholder="6" value={months} onChange={(e) => setMonths(e.target.value)} className="mt-1" />
              </div>
            </div>
            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
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
              <Badge variant={result.can_afford ? "success" : "destructive"} className="text-sm px-3 py-1">
                {result.can_afford ? <CheckCircle className="w-4 h-4 mr-1" /> : <AlertTriangle className="w-4 h-4 mr-1" />}
                {result.can_afford ? "Affordable" : "Not Recommended"}
              </Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-muted rounded-xl p-4">
                <p className="text-xs text-muted-foreground">Total Cost</p>
                <p className="text-lg font-bold">{formatCurrency(result.amount)}</p>
              </div>
              <div className="bg-muted rounded-xl p-4">
                <p className="text-xs text-muted-foreground">Monthly Payment</p>
                <p className="text-lg font-bold">{formatCurrency(result.monthly_payment)}</p>
              </div>
              <div className="bg-muted rounded-xl p-4">
                <p className="text-xs text-muted-foreground">Your Monthly Income</p>
                <p className="text-lg font-bold">{formatCurrency(result.monthly_income)}</p>
              </div>
              <div className="bg-muted rounded-xl p-4">
                <p className="text-xs text-muted-foreground">Your Monthly Expenses</p>
                <p className="text-lg font-bold">{formatCurrency(result.monthly_expenses)}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Risk Score</span>
                <span className="font-medium">{result.risk_score}/100</span>
              </div>
              <Progress value={result.risk_score} className="h-3" />
              <p className="text-xs text-muted-foreground text-center">
                Savings rate: {result.savings_rate}% | {result.recommendation}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}