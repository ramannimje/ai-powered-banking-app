"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, ArrowDownUp, Search, Filter, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/stores/auth";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, formatRelativeTime, getCategoryColor } from "@/lib/utils";

const CATEGORY_ICONS: Record<string, string> = {
  food: "🍔", travel: "✈️", shopping: "🛍️", entertainment: "🎬",
  utilities: "⚡", health: "💊", education: "📚", transfers: "🔄", salary: "💰",
};

export default function TransactionsPage() {
  const { accessToken } = useAuthStore();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadTransactions();
  }, [page, category]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), page_size: "20" };
      if (category) params.category = category;
      const data = await api.getTransactions(params, accessToken!) as any;
      setTransactions(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      toast.error("Failed to load transactions");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-muted-foreground">{total} total transactions</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search transactions..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select
          className="h-10 px-3 rounded-lg border bg-background text-sm"
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1); }}
        >
          <option value="">All categories</option>
          {Object.keys(CATEGORY_ICONS).map((c) => (
            <option key={c} value={c}>{CATEGORY_ICONS[c]} {c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>
        <Button variant="outline" size="sm" onClick={loadTransactions}>
          <Filter className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Transaction List */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : transactions.length === 0 ? (
            <div className="p-12 text-center">
              <ArrowDownUp className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">No transactions found</p>
              <p className="text-sm text-muted-foreground mt-1">Create a transaction to get started</p>
            </div>
          ) : (
            <div className="divide-y">
              {transactions.map((txn: any) => {
                const isCredit = txn.type?.includes("credit") || txn.type === "transfer_in";
                return (
                  <div key={txn.id} className="flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                        style={{ backgroundColor: getCategoryColor(txn.category) + "20" }}
                      >
                        {CATEGORY_ICONS[txn.category || ""] || "💳"}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{txn.merchant || txn.category || "Transaction"}</p>
                        <p className="text-xs text-muted-foreground">
                          {txn.description || txn.reference_id} • {formatRelativeTime(txn.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${isCredit ? "text-green-600" : "text-foreground"}`}>
                        {isCredit ? "+" : "-"}{formatCurrency(txn.amount, txn.currency)}
                      </p>
                      <Badge variant={txn.status === "completed" ? "success" : "warning"} className="text-xs mt-1">
                        {txn.status}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Showing {(page - 1) * 20 + 1} - {Math.min(page * 20, total)} of {total}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page * 20 >= total} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}