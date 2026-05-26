"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Send, Loader2, AlertTriangle, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/stores/auth";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

export default function TransfersPage() {
  const { accessToken } = useAuthStore();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [form, setForm] = useState({ from_account_id: "", to_account_id: "", amount: "", description: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const data = await api.getAccounts(accessToken!) as any[];
      setAccounts(data || []);
      if (data?.length > 0) setForm((f) => ({ ...f, from_account_id: data[0].id }));
    } catch (err) {
      toast.error("Failed to load accounts");
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.from_account_id === form.to_account_id) {
      toast.error("Cannot transfer to the same account");
      return;
    }
    setLoading(true);
    try {
      await api.transfer(
        { from_account_id: form.from_account_id, to_account_id: form.to_account_id, amount: Number(form.amount), description: form.description },
        accessToken!
      );
      toast.success("Transfer successful!");
      setForm({ ...form, amount: "", description: "", to_account_id: "" });
    } catch (err: any) {
      toast.error(err.message || "Transfer failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Send Money</h1>
        <p className="text-muted-foreground">Transfer funds instantly between your accounts</p>
      </div>

      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="w-4 h-4" /> New Transfer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleTransfer} className="space-y-4">
            <div>
              <Label>From Account</Label>
              <select
                className="mt-1 flex h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                value={form.from_account_id}
                onChange={(e) => setForm({ ...form, from_account_id: e.target.value })}
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.account_name} ({acc.currency}) — {formatCurrency(acc.balance)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>To Account ID</Label>
              <Input
                placeholder="Enter destination account UUID"
                value={form.to_account_id}
                onChange={(e) => setForm({ ...form, to_account_id: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Amount (₹)</Label>
              <Input type="number" placeholder="1000" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input placeholder="Monthly rent" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1" />
            </div>
            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Transfer {form.amount ? formatCurrency(Number(form.amount)) : ""}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}