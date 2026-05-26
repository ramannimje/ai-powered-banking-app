"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PiggyBank, Plus, TrendingUp, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useAuthStore } from "@/lib/stores/auth";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

const VAULT_COLORS = ["#6366F1", "#8B5CF6", "#EC4899", "#10B981", "#F59E0B", "#3B82F6"];

export default function SavingsVaultsPage() {
  const { accessToken } = useAuthStore();
  const [vaults, setVaults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", goal_amount: "", description: "", color: "#6366F1" });
  const [depositVault, setDepositVault] = useState<any>(null);
  const [depositAmount, setDepositAmount] = useState("");

  useEffect(() => { loadVaults(); }, []);

  const loadVaults = async () => {
    try {
      const data = await api.getVaults(accessToken!) as any[];
      setVaults(data || []);
    } catch (err) {
      toast.error("Failed to load vaults");
    } finally {
      setLoading(false);
    }
  };

  const createVault = async () => {
    try {
      const data = await api.createVault(
        { name: form.name, goal_amount: form.goal_amount ? Number(form.goal_amount) : undefined, description: form.description, color: form.color },
        accessToken!
      ) as any;
      setVaults([...vaults, data]);
      setShowCreate(false);
      setForm({ name: "", goal_amount: "", description: "", color: "#6366F1" });
      toast.success("Vault created!");
    } catch (err) {
      toast.error("Failed to create vault");
    }
  };

  const deposit = async () => {
    if (!depositVault || !depositAmount) return;
    try {
      const result = await api.depositToVault({ vault_id: depositVault.id, amount: Number(depositAmount) }, accessToken!) as any;
      setVaults(vaults.map((v) => v.id === depositVault.id ? { ...v, current_amount: result.new_balance, progress_percent: result.goal_progress } : v));
      setDepositVault(null);
      setDepositAmount("");
      toast.success(`₹${depositAmount} deposited to ${depositVault.name}!`);
    } catch (err) {
      toast.error("Failed to deposit");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Savings Vaults</h1>
          <p className="text-muted-foreground">Set goals and watch your money grow at 4.5% APY</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)} className="gap-2"><Plus className="w-4 h-4" /> New Vault</Button>
      </div>

      {/* Create Vault Form */}
      {showCreate && (
        <Card className="border-0 shadow-md">
          <CardHeader><CardTitle className="text-base">Create New Vault</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Vault Name</Label>
                <Input placeholder="e.g. MacBook Fund" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Goal Amount (₹)</Label>
                <Input type="number" placeholder="150000" value={form.goal_amount} onChange={(e) => setForm({ ...form, goal_amount: e.target.value })} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input placeholder="For my new MacBook Pro" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1" />
            </div>
            <div className="flex gap-3">
              {VAULT_COLORS.map((color) => (
                <button key={color} onClick={() => setForm({ ...form, color })} className={`w-8 h-8 rounded-full border-2 ${form.color === color ? "border-foreground" : "border-transparent"}`} style={{ backgroundColor: color }} />
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={createVault}>Create Vault</Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deposit Modal */}
      {depositVault && (
        <Card className="border-0 shadow-md border-2 border-primary">
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold">Deposit to {depositVault.name}</h3>
            <div className="flex gap-2">
              <Input type="number" placeholder="Amount in ₹" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} autoFocus />
              <Button onClick={deposit}>Deposit</Button>
              <Button variant="outline" onClick={() => { setDepositVault(null); setDepositAmount(""); }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vaults Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-48 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : vaults.length === 0 ? (
        <div className="text-center py-16">
          <PiggyBank className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No vaults yet. Create one to start saving!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {vaults.map((vault) => (
            <Card key={vault.id} className="border-0 shadow-md">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: vault.color + "20" }}>
                      <PiggyBank className="w-5 h-5" style={{ color: vault.color }} />
                    </div>
                    <div>
                      <p className="font-semibold">{vault.name}</p>
                      <p className="text-xs text-muted-foreground">4.5% APY</p>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(vault.current_amount)}</p>
                  {vault.goal_amount && (
                    <p className="text-xs text-muted-foreground mt-1">Goal: {formatCurrency(vault.goal_amount)}</p>
                  )}
                </div>
                {vault.goal_amount && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{vault.progress_percent.toFixed(0)}% saved</span>
                      <span>{formatCurrency(vault.goal_amount - vault.current_amount)} to go</span>
                    </div>
                    <Progress value={vault.progress_percent} className="h-2" />
                  </div>
                )}
                <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => setDepositVault(vault)}>
                  <ArrowUpRight className="w-3 h-3" /> Deposit
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}