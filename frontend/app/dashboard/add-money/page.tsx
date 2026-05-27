"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Wallet, Loader2, CheckCircle, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/stores/auth";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000, 20000];

export default function AddMoneyPage() {
  const { accessToken } = useAuthStore();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    loadAccounts();
  }, [accessToken]);

  const loadAccounts = async () => {
    try {
      const data = await api.getAccounts(accessToken!) as any[];
      setAccounts(data || []);
      if (data?.length > 0) setSelectedAccount(data[0].id);
    } catch (err) {
      toast.error("Failed to load accounts");
    }
  };

  const handleAddMoney = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setLoading(true);
    try {
      // In production, this would integrate with a payment gateway (Razorpay, Stripe, etc.)
      // For now, we simulate a deposit by creating a credit transaction
      await api.createTransaction(
        {
          account_id: selectedAccount,
          type: "credit",
          amount: Number(amount),
          category: "deposit",
          merchant: "Bank Deposit",
          description: "Money added to account",
        },
        accessToken!
      );

      setSuccess(true);
      setAmount("");
      toast.success(`${formatCurrency(Number(amount))} added to your account!`);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      toast.error(err.message || "Failed to add money");
    } finally {
      setLoading(false);
    }
  };

  const account = accounts.find((a) => a.id === selectedAccount);

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Plus className="w-6 h-6" /> Add Money
        </h1>
        <p className="text-muted-foreground">Instantly add money to your account</p>
      </div>

      {/* Note */}
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="p-4">
          <p className="text-sm text-amber-800">
            💡 <strong>Demo mode:</strong> In production, this would connect to Razorpay/UPI/Net Banking.
            For now, clicking "Add Money" simulates a deposit of ₹X to your account instantly.
          </p>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Wallet className="w-4 h-4" /> Add to Account</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleAddMoney} className="space-y-5">
            {/* Account selector */}
            <div>
              <Label>Select Account</Label>
              <select
                className="mt-1 flex h-11 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.account_name} ({acc.currency}) — Balance: {formatCurrency(acc.balance)}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount input */}
            <div>
              <Label>Amount (₹)</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">₹</span>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-8 text-2xl h-14 font-semibold"
                  min="1"
                />
              </div>
            </div>

            {/* Quick amounts */}
            <div className="flex flex-wrap gap-2">
              {QUICK_AMOUNTS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setAmount(String(q))}
                  className={`px-4 py-2 rounded-full border text-sm font-medium transition-colors ${
                    amount === String(q)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-input hover:bg-muted"
                  }`}
                >
                  ₹{q.toLocaleString()}
                </button>
              ))}
            </div>

            {/* Summary */}
            {amount && Number(amount) > 0 && (
              <div className="bg-muted/50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-medium">{formatCurrency(Number(amount))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Processing fee</span>
                  <span className="text-emerald-600">₹0 (Free)</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(Number(amount))}</span>
                </div>
              </div>
            )}

            {/* Success */}
            {success && (
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                <p className="text-sm font-medium">Money added successfully! Check your balance.</p>
              </div>
            )}

            <Button type="submit" size="lg" className="w-full gap-2" disabled={loading || !amount}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add {amount ? formatCurrency(Number(amount)) : ""}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Payment methods (visual only) */}
      <Card className="border-0 shadow-md">
        <CardHeader><CardTitle className="text-base">Payment Methods</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "UPI", sub: "Instant" },
              { label: "Net Banking", sub: "All banks" },
              { label: "Card", sub: "Debit/Credit" },
            ].map((method) => (
              <div key={method.label} className="border rounded-xl p-4 text-center hover:bg-muted/30 transition-colors cursor-pointer">
                <p className="font-medium text-sm">{method.label}</p>
                <p className="text-xs text-muted-foreground">{method.sub}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center mt-3">100% secure · 256-bit encryption</p>
        </CardContent>
      </Card>
    </div>
  );
}