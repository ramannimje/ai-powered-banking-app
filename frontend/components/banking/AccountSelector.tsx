"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Wallet, ChevronDown, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/stores/auth";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

export default function AccountSelector() {
  const { accessToken } = useAuthStore();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    loadAccounts();
  }, [accessToken]);

  const loadAccounts = async () => {
    try {
      const data = await api.getAccounts(accessToken!) as any[];
      setAccounts(data || []);
      if (data?.length > 0 && !selectedId) {
        setSelectedId(data[0].id);
      }
    } catch (err) {
      // silent
    }
  };

  const selected = accounts.find((a) => a.id === selectedId);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 bg-white border rounded-xl hover:bg-muted/50 transition-colors text-sm font-medium"
      >
        <div className="w-7 h-7 bg-green-100 rounded-lg flex items-center justify-center">
          <Wallet className="w-4 h-4 text-green-600" />
        </div>
        <div className="text-left">
          <p className="text-xs text-muted-foreground">{selected?.account_name || "Select Account"}</p>
          <p className="font-semibold text-sm">{formatCurrency(selected?.balance || 0)}</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-2 left-0 z-50 w-64 bg-white border rounded-xl shadow-lg overflow-hidden">
            <div className="p-3 border-b bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground">Your Accounts</p>
            </div>
            {accounts.map((acc) => (
              <button
                key={acc.id}
                onClick={() => { setSelectedId(acc.id); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left ${selectedId === acc.id ? "bg-primary/5" : ""}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                  acc.currency === "USD" ? "bg-blue-100 text-blue-600" :
                  acc.currency === "EUR" ? "bg-yellow-100 text-yellow-600" :
                  acc.currency === "GBP" ? "bg-red-100 text-red-600" :
                  "bg-green-100 text-green-600"
                }`}>
                  {acc.currency}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{acc.account_name}</p>
                  <p className="text-xs text-muted-foreground">{acc.currency} · {acc.account_number.slice(-4)}</p>
                </div>
                <p className="text-sm font-semibold">{formatCurrency(acc.balance)}</p>
              </button>
            ))}
            <div className="p-2 border-t">
              <Link href="/dashboard" onClick={() => setOpen(false)}>
                <Button variant="ghost" size="sm" className="w-full gap-2 text-xs">
                  <Plus className="w-3 h-3" /> Add New Account
                </Button>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}