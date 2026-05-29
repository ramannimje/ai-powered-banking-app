"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Sparkles, Plus, Zap, CheckCircle, Activity, Trash2,
  Play, Pause, ChevronDown, Target, TrendingUp, Clock,
  ArrowRight, Loader2, History, Settings
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useAuthStore } from "@/lib/stores/auth";
import { api } from "@/lib/api";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";

// Preset rule templates
const PRESETS = [
  {
    name: "Save when food spending is low",
    description: "Save ₹500 when weekly food spending falls below 80% of your average",
    trigger: { type: "spending_below_average", category: "food", threshold: 0.8 },
    action: { type: "save_amount", amount: 500 },
    icon: "🍔",
    color: "#F59E0B",
  },
  {
    name: "Buffer savings on low spending day",
    description: "Save ₹200 when daily spending is below ₹1,500",
    trigger: { type: "daily_savings", min_spending: 1500, save_amount: 200 },
    action: { type: "save_amount", amount: 200 },
    icon: "🌙",
    color: "#6366F1",
  },
  {
    name: "Save excess entertainment spend",
    description: "Save ₹300 when entertainment is 50%+ above your weekly average",
    trigger: { type: "spending_above_average", category: "entertainment", threshold: 1.5 },
    action: { type: "save_amount", amount: 300 },
    icon: "🎬",
    color: "#8B5CF6",
  },
  {
    name: "Surge savings on high balance",
    description: "Save ₹1,000 automatically when your primary balance exceeds ₹50,000",
    trigger: { type: "balance_threshold", min_balance: 50000, save_amount: 1000 },
    action: { type: "save_amount", amount: 1000 },
    icon: "💰",
    color: "#10B981",
  },
  {
    name: "No-spend day bonus",
    description: "Save ₹100 for every day you spend less than ₹500",
    trigger: { type: "daily_savings", min_spending: 500, save_amount: 100 },
    action: { type: "save_amount", amount: 100 },
    icon: "🎯",
    color: "#EC4899",
  },
];

const TRIGGER_TYPES = [
  { value: "spending_below_average", label: "Spending Below Average", desc: "When a category spending is below X% of your weekly average" },
  { value: "spending_above_average", label: "Spending Above Average", desc: "When a category spending exceeds X% of your weekly average" },
  { value: "daily_savings", label: "Daily Savings Goal", desc: "When your total daily spending is below a threshold" },
  { value: "balance_threshold", label: "Balance Threshold", desc: "When your primary account balance exceeds a threshold" },
];

export default function AutonomousAgentPage() {
  const { accessToken } = useAuthStore();
  const [status, setStatus] = useState<any>(null);
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);
  const [tab, setTab] = useState("active");

  // Create form
  const [form, setForm] = useState({
    name: "",
    description: "",
    trigger_type: "spending_below_average",
    category: "food",
    threshold: "0.8",
    amount: "500",
    min_spending: "1500",
    min_balance: "50000",
  });

  useEffect(() => {
    if (!accessToken) return;
    loadAll();
  }, [accessToken]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [statusData, rulesData] = await Promise.all([
        api.getAutonomousStatus(accessToken!),
        api.getAutonomousRules(accessToken!),
      ]);
      setStatus(statusData as any);
      setRules((rulesData as any)?.items || []);
    } catch (err) {
      toast.error("Failed to load agent data");
    } finally {
      setLoading(false);
    }
  };

  const createRule = async (preset?: typeof PRESETS[0]) => {
    let trigger: any, action: any;

    if (preset) {
      trigger = preset.trigger;
      action = preset.action;
    } else {
      const t = form.trigger_type;
      if (t === "spending_below_average" || t === "spending_above_average") {
        trigger = { type: t, category: form.category, threshold: parseFloat(form.threshold) };
      } else if (t === "daily_savings") {
        trigger = { type: t, min_spending: parseFloat(form.min_spending), save_amount: parseFloat(form.amount) };
      } else if (t === "balance_threshold") {
        trigger = { type: t, min_balance: parseFloat(form.min_balance), save_amount: parseFloat(form.amount) };
      } else {
        trigger = { type: t };
      }
      action = { type: "save_amount", amount: parseFloat(form.amount) };
    }

    try {
      const data = await api.createAutonomousRule(
        {
          name: preset?.name || form.name,
          description: preset?.description || form.description,
          trigger_condition: trigger,
          action,
        },
        accessToken!
      ) as any;

      setRules([data, ...rules]);
      setShowCreate(false);
      if (preset) {
        toast.success(`"${preset.name}" created!`);
      } else {
        toast.success("Rule created!");
        setForm({ name: "", description: "", trigger_type: "spending_below_average", category: "food", threshold: "0.8", amount: "500", min_spending: "1500", min_balance: "50000" });
      }
      loadAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to create rule");
    }
  };

  const toggleRule = async (ruleId: string, isActive: boolean) => {
    try {
      await api.updateAutonomousRule(ruleId, { is_active: !isActive }, accessToken!);
      setRules(rules.map((r) => r.id === ruleId ? { ...r, is_active: !isActive } : r));
      loadAll();
    } catch (err) {
      toast.error("Failed to update rule");
    }
  };

  const executeRule = async (ruleId: string) => {
    setExecuting(ruleId);
    try {
      const result = await api.executeAutonomousRule(ruleId, accessToken!) as any;

      if (result.triggered) {
        toast.success(result.result?.message || "Rule executed! Savings transferred.");
      } else {
        toast.info("Rule conditions not met — nothing transferred.");
      }
      loadAll();
    } catch (err: any) {
      toast.error(err.message || "Execution failed");
    } finally {
      setExecuting(null);
    }
  };

  const deleteRule = async (ruleId: string) => {
    try {
      await api.deleteAutonomousRule(ruleId, accessToken!);
      setRules(rules.filter((r) => r.id !== ruleId));
      toast.success("Rule deleted");
      loadAll();
    } catch (err) {
      toast.error("Failed to delete rule");
    }
  };

  if (loading) {
    return <div className="space-y-4"><div className="h-32 bg-muted rounded-xl animate-pulse" /><div className="h-96 bg-muted rounded-xl animate-pulse" /></div>;
  }

  const activeRules = rules.filter((r) => r.is_active);
  const inactiveRules = rules.filter((r) => !r.is_active);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6" /> Autonomous Finance Agent
          </h1>
          <p className="text-muted-foreground text-sm">AI-powered automatic savings — set rules, relax</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)} className="gap-2">
          <Plus className="w-4 h-4" /> New Rule
        </Button>
      </div>

      {/* Agent Status Banner */}
      <Card className="border-0 shadow-md overflow-hidden">
        <CardContent className="p-0">
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 p-6 text-white">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                  <Activity className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-white/20 text-white border-0">{status?.status?.toUpperCase() || "IDLE"}</Badge>
                    <h3 className="font-semibold">Finance Agent</h3>
                  </div>
                  <p className="text-sm text-white/70">
                    {activeRules.length} active rules · {formatCurrency(status?.total_saved || 0)} total auto-saved
                  </p>
                </div>
              </div>

              {/* Stats */}
              <div className="flex gap-6 flex-wrap">
                {[
                  { label: "Active Rules", value: activeRules.length, icon: Zap },
                  { label: "Times Triggered", value: rules.reduce((s, r) => s + (r.trigger_count || 0), 0), icon: Play },
                  { label: "Total Saved", value: formatCurrency(status?.total_saved || 0), icon: Target },
                  { label: "Last Run", value: status?.last_execution ? formatRelativeTime(status.last_execution) : "Never", icon: Clock },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                      <s.icon className="w-4 h-4 text-white/60" />
                      <span className="text-xl font-bold">{s.value}</span>
                    </div>
                    <p className="text-xs text-white/60">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-white/60 mb-1">
                <span>Savings Goal Progress</span>
                <span>100% → Auto-Savings Vault</span>
              </div>
              <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white/40 rounded-full" style={{ width: "60%" }} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create Rule Form */}
      {showCreate && (
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="w-4 h-4" /> Create Custom Rule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <Label>Rule Name</Label>
              <Input
                placeholder="e.g. Save when under budget"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Trigger Type</Label>
                <select
                  className="mt-1 flex h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  value={form.trigger_type}
                  onChange={(e) => setForm({ ...form, trigger_type: e.target.value })}
                >
                  {TRIGGER_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  {TRIGGER_TYPES.find((t) => t.value === form.trigger_type)?.desc}
                </p>
              </div>

              <div>
                <Label>Amount to Save (₹)</Label>
                <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="mt-1" />
              </div>
            </div>

            {/* Dynamic fields based on trigger type */}
            {(form.trigger_type === "spending_below_average" || form.trigger_type === "spending_above_average") && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Category</Label>
                  <select className="mt-1 flex h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {["food", "travel", "shopping", "entertainment", "utilities", "health", "education"].map((c) => (
                      <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Threshold (e.g. 0.8 = 80%)</Label>
                  <Input type="number" step="0.1" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} className="mt-1" />
                </div>
              </div>
            )}

            {form.trigger_type === "daily_savings" && (
              <div>
                <Label>Daily Spending Threshold (₹)</Label>
                <Input type="number" value={form.min_spending} onChange={(e) => setForm({ ...form, min_spending: e.target.value })} className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">Save ₹{form.amount} when daily spending is below this amount</p>
              </div>
            )}

            {form.trigger_type === "balance_threshold" && (
              <div>
                <Label>Minimum Balance (₹)</Label>
                <Input type="number" value={form.min_balance} onChange={(e) => setForm({ ...form, min_balance: e.target.value })} className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">Save ₹{form.amount} when primary account balance exceeds this</p>
              </div>
            )}

            <div className="bg-muted/50 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Action</p>
                <p className="text-xs text-muted-foreground">Automatically transfer ₹{form.amount} to your Auto-Savings Vault</p>
              </div>
              <Button onClick={() => createRule()} className="gap-2" disabled={!form.name || !form.amount}>
                <Sparkles className="w-4 h-4" /> Create Rule
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="active">
            Active ({activeRules.length})
          </TabsTrigger>
          <TabsTrigger value="templates">
            Quick Templates
          </TabsTrigger>
          <TabsTrigger value="paused">
            Paused ({inactiveRules.length})
          </TabsTrigger>
        </TabsList>

        {/* Active Rules */}
        <TabsContent value="active">
          {activeRules.length === 0 ? (
            <Card className="border-0 shadow-md">
              <CardContent className="text-center py-16">
                <Sparkles className="w-12 h-12 mx-auto text-muted-foreground/20 mb-4" />
                <p className="text-muted-foreground font-medium">No active rules</p>
                <p className="text-sm text-muted-foreground mt-1">Create a rule or use a quick template to start auto-saving</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeRules.map((rule) => {
                const trigger = rule.trigger_condition || {};
                const action = rule.action || {};
                return (
                  <Card key={rule.id} className="border-0 shadow-md">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-indigo-100">
                          <Sparkles className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold">{rule.name}</h3>
                            <Badge variant="success" className="text-xs">Active</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                            Trigger: {format_trigger_desc(trigger)} → Save {formatCurrency(action.amount || 0)}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Play className="w-3 h-3" /> {rule.trigger_count || 0} executions</span>
                            {rule.last_triggered_at && (
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Last: {formatRelativeTime(rule.last_triggered_at)}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => executeRule(rule.id)}
                            disabled={executing === rule.id}
                          >
                            {executing === rule.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                            Test Run
                          </Button>
                          <Button size="sm" variant="ghost" className="gap-1" onClick={() => toggleRule(rule.id, rule.is_active)}>
                            <Pause className="w-3 h-3" /> Pause
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive gap-1" onClick={() => deleteRule(rule.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Quick Templates */}
        <TabsContent value="templates">
          <Card className="border-0 shadow-md">
            <CardContent className="p-6 space-y-3">
              <p className="text-sm text-muted-foreground mb-4">One-click setup for popular auto-savings strategies</p>
              {PRESETS.map((preset, i) => (
                <div key={i} className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: preset.color + "20" }}>
                      {preset.icon}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{preset.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{preset.description}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => createRule(preset)}>
                    <Plus className="w-3 h-3" /> Add
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Paused Rules */}
        <TabsContent value="paused">
          {inactiveRules.length === 0 ? (
            <Card className="border-0 shadow-md">
              <CardContent className="text-center py-16">
                <p className="text-muted-foreground">No paused rules</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {inactiveRules.map((rule) => {
                const trigger = rule.trigger_condition || {};
                const action = rule.action || {};
                return (
                  <Card key={rule.id} className="border-0 shadow-md opacity-70">
                    <CardContent className="p-5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                          <Pause className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{rule.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {format_trigger_desc(trigger)} → Save {formatCurrency(action.amount || 0)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => toggleRule(rule.id, false)}>
                          <Play className="w-3 h-3" /> Resume
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteRule(rule.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Auto-Savings Vault Summary */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                <Target className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <p className="font-semibold">Auto-Savings Vault</p>
                <p className="text-xs text-muted-foreground">Default destination for all autonomous savings</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-indigo-600">{formatCurrency(status?.total_saved || 0)}</p>
              <p className="text-xs text-muted-foreground">Total auto-saved</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function format_trigger_desc(trigger: any): string {
  const t = trigger?.type;
  if (t === "spending_below_average") return `When ${trigger.category} is below ${(trigger.threshold * 100).toFixed(0)}% of average`;
  if (t === "spending_above_average") return `When ${trigger.category} exceeds ${(trigger.threshold * 100).toFixed(0)}% of average`;
  if (t === "daily_savings") return `When daily spend < ₹${(trigger.min_spending || 0).toLocaleString("en-IN")}`;
  if (t === "balance_threshold") return `When balance > ₹${(trigger.min_balance || 0).toLocaleString("en-IN")}`;
  return t || "Custom trigger";
}