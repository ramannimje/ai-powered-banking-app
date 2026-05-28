"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Shield, AlertTriangle, CheckCircle, RefreshCw, TrendingUp, Eye, Clock, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuthStore } from "@/lib/stores/auth";
import { api } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";

const SEVERITY_COLORS: Record<string, string> = {
  low: "bg-yellow-100 text-yellow-800 border-yellow-200",
  medium: "bg-orange-100 text-orange-800 border-orange-200",
  high: "bg-red-100 text-red-800 border-red-200",
};

const SEVERITY_BADGE: Record<string, any> = {
  low: "warning",
  medium: "secondary",
  high: "destructive",
};

export default function FraudDashboardPage() {
  const { accessToken } = useAuthStore();
  const [security, setSecurity] = useState<any>(null);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [fraudAlerts, setFraudAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    loadData();
  }, [accessToken]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [secData, anomaliesData, alertsData] = await Promise.all([
        api.request("/fraud/security-dashboard", { token: accessToken! }),
        api.get("/ai/anomalies", { token: accessToken! }),
        api.request("/fraud/alerts", { token: accessToken! }),
      ]);

      setSecurity(secData as any);
      setAnomalies((anomaliesData as any)?.items || []);
      setFraudAlerts((alertsData as any)?.items || []);
    } catch (err) {
      toast.error("Failed to load fraud data");
    } finally {
      setLoading(false);
    }
  };

  const runScan = async () => {
    setScanning(true);
    try {
      const result = await api.request("/fraud/scan-anomalies", { method: "POST", token: accessToken! }) as any;
      if (result.anomalies_detected > 0) {
        toast.success(`Found ${result.anomalies_detected} new anomalies!`);
        loadData();
      } else {
        toast.success("No new anomalies detected. Your finances look normal.");
      }
    } catch (err) {
      toast.error("Scan failed");
    } finally {
      setScanning(false);
    }
  };

  const resolveAnomaly = async (id: string) => {
    try {
      await api.request(`/ai/anomalies/${id}/resolve`, { method: "POST", token: accessToken! });
      setAnomalies(anomalies.map((a) => a.id === id ? { ...a, is_resolved: true } : a));
      toast.success("Anomaly resolved");
    } catch (err) {
      toast.error("Failed to resolve");
    }
  };

  if (loading) {
    return <div className="space-y-4"><div className="h-48 bg-muted rounded-xl animate-pulse" /><div className="h-96 bg-muted rounded-xl animate-pulse" /></div>;
  }

  const score = security?.security_score || 0;
  const scoreColor = score >= 80 ? "text-green-600" : score >= 50 ? "text-amber-600" : "text-red-600";
  const scoreBg = score >= 80 ? "bg-green-100" : score >= 50 ? "bg-amber-100" : "bg-red-100";
  const unresolved = anomalies.filter((a) => !a.is_resolved);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6" /> Fraud & Security
          </h1>
          <p className="text-muted-foreground text-sm">AI-powered transaction monitoring and anomaly detection</p>
        </div>
        <Button onClick={runScan} disabled={scanning} className="gap-2">
          {scanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {scanning ? "Scanning..." : "Run Anomaly Scan"}
        </Button>
      </div>

      {/* Security Score */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-6">
          <div className="flex items-center gap-6">
            <div className={`w-20 h-20 rounded-2xl ${scoreBg} flex flex-col items-center justify-center`}>
              <span className={`text-3xl font-bold ${scoreColor}`}>{score}</span>
              <span className="text-xs text-muted-foreground">/ 100</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={score >= 80 ? "success" : score >= 50 ? "warning" : "destructive"}>
                  {score >= 80 ? "🛡️ Protected" : score >= 50 ? "⚠️ Attention Needed" : "🚨 Action Required"}
                </Badge>
                <h3 className="font-semibold">Security Score</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Based on {security?.transactions_this_week || 0} transactions this week,
                {security?.week_alerts || 0} fraud alerts, and {security?.active_anomalies || 0} active anomalies.
              </p>
              <Progress value={score} className="h-3" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Week Transactions", value: security?.transactions_this_week || 0, icon: Clock, color: "text-blue-600 bg-blue-100" },
          { label: "Fraud Alerts (7D)", value: security?.week_alerts || 0, icon: AlertTriangle, color: "text-red-600 bg-red-100" },
          { label: "Active Anomalies", value: unresolved.length, icon: Zap, color: unresolved.length > 0 ? "text-amber-600 bg-amber-100" : "text-green-600 bg-green-100" },
          { label: "Resolved", value: anomalies.filter((a) => a.is_resolved).length, icon: CheckCircle, color: "text-green-600 bg-green-100" },
        ].map((stat) => (
          <Card key={stat.label} className="border-0 shadow-md">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="anomalies">
        <TabsList>
          <TabsTrigger value="anomalies">
            Spending Anomalies
            {unresolved.length > 0 && <Badge variant="destructive" className="ml-2">{unresolved.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="alerts">Fraud Alerts ({fraudAlerts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="anomalies">
          <Card className="border-0 shadow-md">
            <CardContent className="p-0">
              {unresolved.length === 0 ? (
                <div className="text-center py-16">
                  <CheckCircle className="w-12 h-12 mx-auto text-green-400 mb-4" />
                  <p className="font-medium text-lg">All clear!</p>
                  <p className="text-muted-foreground text-sm mt-1">No active anomalies detected. Your spending patterns are normal.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {unresolved.map((anomaly) => (
                    <div key={anomaly.id} className="flex items-start gap-4 p-5 hover:bg-muted/30">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        anomaly.severity === "high" ? "bg-red-100" : anomaly.severity === "medium" ? "bg-orange-100" : "bg-yellow-100"
                      }`}>
                        <AlertTriangle className={`w-5 h-5 ${anomaly.severity === "high" ? "text-red-600" : anomaly.severity === "medium" ? "text-orange-600" : "text-yellow-600"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={SEVERITY_BADGE[anomaly.severity] || "secondary"} className="text-xs">
                            {anomaly.severity?.toUpperCase()}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{anomaly.anomaly_type?.replace("_", " ")}</span>
                        </div>
                        <p className="text-sm font-medium">{anomaly.description}</p>
                        {anomaly.detected_amount && anomaly.baseline_amount && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Detected: ₹{anomaly.detected_amount.toLocaleString("en-IN")} vs baseline: ₹{anomaly.baseline_amount.toLocaleString("en-IN")} · +{anomaly.threshold_pct}%
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">{formatRelativeTime(anomaly.created_at)}</p>
                      </div>
                      <Button size="sm" variant="outline" className="gap-1 flex-shrink-0" onClick={() => resolveAnomaly(anomaly.id)}>
                        <CheckCircle className="w-3.5 h-3.5" /> Acknowledge
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts">
          <Card className="border-0 shadow-md">
            <CardContent className="p-0">
              {fraudAlerts.length === 0 ? (
                <div className="text-center py-16">
                  <Shield className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">No fraud alerts in the last 30 days</p>
                </div>
              ) : (
                <div className="divide-y">
                  {fraudAlerts.map((alert) => (
                    <div key={alert.id} className="flex items-start gap-4 p-5 hover:bg-muted/30">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${alert.metadata?.blocked ? "bg-red-100" : "bg-amber-100"}`}>
                        <AlertTriangle className={`w-5 h-5 ${alert.metadata?.blocked ? "text-red-600" : "text-amber-600"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{alert.title}</span>
                          {alert.metadata?.blocked && <Badge variant="destructive" className="text-xs">BLOCKED</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">{alert.body}</p>
                        <p className="text-xs text-muted-foreground mt-1">{formatRelativeTime(alert.created_at)}</p>
                      </div>
                      {!alert.is_read && (
                        <Button size="sm" variant="ghost" className="gap-1">
                          <Eye className="w-3.5 h-3.5" /> Mark read
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}