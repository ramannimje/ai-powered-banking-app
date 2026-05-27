"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Copy, Check, ExternalLink, Calendar, Tag, Building2, Hash } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/stores/auth";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function TransactionDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const [txn, setTxn] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id || !accessToken) return;
    loadTransaction();
  }, [id, accessToken]);

  const loadTransaction = async () => {
    try {
      const data = await api.get(`/transactions/${id}`, { token: accessToken! }) as any;
      setTxn(data);
    } catch (err) {
      toast.error("Transaction not found");
      router.push("/dashboard/transactions");
    } finally {
      setLoading(false);
    }
  };

  const copyRef = async () => {
    if (!txn?.reference_id) return;
    await navigator.clipboard.writeText(txn.reference_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Reference ID copied!");
  };

  if (loading) {
    return <div className="h-64 bg-muted rounded-xl animate-pulse" />;
  }

  if (!txn) return null;

  const isCredit = txn.type?.includes("credit") || txn.type === "transfer_in";

  const STATUS_COLOR: Record<string, string> = {
    completed: "success",
    pending: "warning",
    failed: "destructive",
    reversed: "secondary",
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Transaction Details</h1>
          <p className="text-muted-foreground text-sm">#{txn.reference_id}</p>
        </div>
      </div>

      {/* Amount Hero */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-8 text-center">
          <div className={`text-5xl font-bold mb-4 ${isCredit ? "text-green-600" : "text-foreground"}`}>
            {isCredit ? "+" : "-"}{formatCurrency(txn.amount, txn.currency)}
          </div>
          <Badge variant={STATUS_COLOR[txn.status] || "secondary"} className="text-sm px-3 py-1">
            {txn.status?.toUpperCase()}
          </Badge>
          <p className="text-muted-foreground mt-3 text-sm">{formatDate(txn.created_at)}</p>
        </CardContent>
      </Card>

      {/* Details */}
      <Card className="border-0 shadow-md">
        <CardHeader><CardTitle className="text-base">Transaction Info</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DetailRow icon={Hash} label="Reference ID" value={txn.reference_id} copyable onCopy={copyRef} copied={copied} />
            <DetailRow icon={Calendar} label="Date & Time" value={new Date(txn.created_at).toLocaleString("en-IN")} />
            {txn.category && <DetailRow icon={Tag} label="Category" value={txn.category?.charAt(0).toUpperCase() + txn.category?.slice(1)} />}
            {txn.merchant && <DetailRow icon={Building2} label="Merchant" value={txn.merchant} />}
            {txn.description && <DetailRow icon={Tag} label="Description" value={txn.description} />}
            {txn.balance_after != null && (
              <DetailRow icon={Tag} label="Balance After" value={formatCurrency(txn.balance_after)} />
            )}
            <DetailRow icon={Building2} label="Currency" value={txn.currency} />
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={copyRef}>
          {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
          {copied ? "Copied!" : "Copy Reference ID"}
        </Button>
      </div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value, copyable, onCopy, copied }: any) {
  return (
    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
      <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value || "—"}</p>
      </div>
      {copyable && (
        <button onClick={onCopy} className="text-xs text-primary hover:underline flex-shrink-0">
          {copied ? "✓" : "Copy"}
        </button>
      )}
    </div>
  );
}