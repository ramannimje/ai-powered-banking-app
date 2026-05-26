"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Plus, Zap, CheckCircle, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const PRESET_RULES = [
  {
    name: "Save when food spending is low",
    description: "Save ₹500 when weekly food spending is below your average",
    trigger: { type: "spending_below_average", category: "food", threshold: 0.8 },
    action: { type: "save_amount", amount: 500 },
    icon: "🍔",
  },
  {
    name: "Round-up savings",
    description: "Save the round-up on every transaction (up to ₹50)",
    trigger: { type: "every_transaction", threshold: 50 },
    action: { type: "round_up" },
    icon: "🔄",
  },
  {
    name: "50% of entertainment savings",
    description: "Move 50% of any entertainment refund to savings",
    trigger: { type: "refund_category", category: "entertainment" },
    action: { type: "save_percent", percent: 50 },
    icon: "🎬",
  },
];

export default function AutonomousAgentPage() {
  const [activeRules, setActiveRules] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", category: "food", amount: "500", threshold: "0.8" });

  const createRule = (preset?: typeof PRESET_RULES[0]) => {
    const rule = {
      id: `rule_${Date.now()}`,
      name: preset?.name || form.name,
      description: preset?.description || form.description,
      is_active: true,
      trigger_condition: preset?.trigger || { type: "spending_below_average", category: form.category, threshold: parseFloat(form.threshold) },
      action: preset?.action || { type: "save_amount", amount: parseInt(form.amount) },
      last_triggered_at: null,
      trigger_count: 0,
      created_at: new Date().toISOString(),
    };
    setActiveRules([...activeRules, rule]);
    setShowCreate(false);
    toast.success("Rule created! AI will monitor your spending automatically.");
  };

  const toggleRule = (id: string) => {
    setActiveRules(activeRules.map((r) => (r.id === id ? { ...r, is_active: !r.is_active } : r)));
  };

  const deleteRule = (id: string) => {
    setActiveRules(activeRules.filter((r) => r.id !== id));
    toast.success("Rule deleted");
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="w-6 h-6" /> Autonomous Finance Agent
        </h1>
        <p className="text-muted-foreground">Set rules — AI automatically saves and invests for you</p>
      </div>

      {/* Status Banner */}
      <Card className="border-0 shadow-md bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
        <CardContent className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="font-semibold">Agent Status: Active</p>
              <p className="text-sm text-white/70">{activeRules.length} rules monitoring · {activeRules.filter((r) => r.is_active).length} active</p>
            </div>
          </div>
          <Button variant="secondary" onClick={() => setShowCreate(!showCreate)} className="gap-2 bg-white/20 text-white border-white/30 hover:bg-white/30">
            <Plus className="w-4 h-4" /> New Rule
          </Button>
        </CardContent>
      </Card>

      {/* Create Rule Form */}
      {showCreate && (
        <Card className="border-0 shadow-md">
          <CardHeader><CardTitle className="text-base">Create Autonomous Rule</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Rule Name</Label>
              <Input placeholder="e.g. Save when under budget" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <select className="mt-1 flex h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="food">Food & Dining</option>
                  <option value="shopping">Shopping</option>
                  <option value="travel">Travel</option>
                  <option value="entertainment">Entertainment</option>
                  <option value="utilities">Utilities</option>
                </select>
              </div>
              <div>
                <Label>Save Amount (₹)</Label>
                <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="mt-1" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Rule: When {form.category} spending is below {parseFloat(form.threshold) * 100}% of average, save ₹{form.amount} automatically</p>
            <div className="flex gap-2">
              <Button onClick={() => createRule()}>Create Rule</Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preset Rules */}
      <Card className="border-0 shadow-md">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Zap className="w-4 h-4" /> Quick Start Templates</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {PRESET_RULES.map((preset, i) => (
            <div key={i} className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-4">
                <span className="text-2xl">{preset.icon}</span>
                <div>
                  <p className="font-medium text-sm">{preset.name}</p>
                  <p className="text-xs text-muted-foreground">{preset.description}</p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => createRule(preset)} className="gap-1">
                <Plus className="w-3 h-3" /> Add
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Active Rules */}
      <Card className="border-0 shadow-md">
        <CardHeader><CardTitle className="text-base">Active Rules</CardTitle></CardHeader>
        <CardContent>
          {activeRules.length === 0 ? (
            <div className="text-center py-8">
              <Sparkles className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">No rules yet. Create one above!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeRules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between p-4 border rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${rule.is_active ? "bg-green-100" : "bg-muted"}`}>
                      {rule.is_active ? <CheckCircle className="w-5 h-5 text-green-600" /> : <Sparkles className="w-5 h-5 text-muted-foreground" />}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{rule.name}</p>
                      <p className="text-xs text-muted-foreground">Triggered {rule.trigger_count} times · Last: {rule.last_triggered_at ? new Date(rule.last_triggered_at).toLocaleDateString() : "Never"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={rule.is_active ? "success" : "secondary"}>{rule.is_active ? "Active" : "Paused"}</Badge>
                    <Button variant="ghost" size="sm" onClick={() => toggleRule(rule.id)}>Toggle</Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteRule(rule.id)}>Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}