"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Snowflake, Unlink, CreditCard } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/stores/auth";
import { api } from "@/lib/api";

export default function CardsPage() {
  const { accessToken } = useAuthStore();
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadCards(); }, []);

  const loadCards = async () => {
    try {
      const data = await api.getCards(accessToken!) as any[];
      setCards(data || []);
    } catch (err) {
      toast.error("Failed to load cards");
    } finally {
      setLoading(false);
    }
  };

  const createCard = async () => {
    try {
      const card = await api.createVirtualCard(accessToken!) as any;
      setCards([...cards, card]);
      toast.success("Virtual card created!");
    } catch (err) {
      toast.error("Failed to create card");
    }
  };

  const toggleFreeze = async (cardId: string, currentStatus: string) => {
    try {
      const result = await api.freezeCard(cardId, currentStatus !== "frozen", accessToken!) as any;
      setCards(cards.map((c) => c.id === cardId ? { ...c, status: result.status } : c));
      toast.success(result.status === "frozen" ? "Card frozen" : "Card unfrozen");
    } catch (err) {
      toast.error("Failed to update card");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cards</h1>
          <p className="text-muted-foreground">Manage your virtual and physical cards</p>
        </div>
        <Button onClick={createCard} className="gap-2"><Plus className="w-4 h-4" /> Create Virtual Card</Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-48 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <div className="text-center py-16">
          <CreditCard className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No cards yet</p>
          <Button variant="outline" className="mt-4" onClick={createCard}>Create your first virtual card</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cards.map((card) => (
            <Card key={card.id} className="border-0 shadow-md overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold">{card.card_network}</p>
                      <p className="text-xs text-muted-foreground">{card.is_virtual ? "Virtual" : "Physical"}</p>
                    </div>
                  </div>
                  <Badge variant={card.status === "active" ? "success" : card.status === "frozen" ? "warning" : "destructive"}>
                    {card.status}
                  </Badge>
                </div>
                <p className="text-2xl font-mono tracking-widest mb-4">
                  •••• •••• •••• {card.card_number_last4}
                </p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Card Holder</p>
                    <p className="text-sm font-medium">{card.card_holder_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Expires</p>
                    <p className="text-sm font-medium">{String(card.expiry_month).padStart(2, "0")}/{card.expiry_year}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-xs text-muted-foreground">Daily limit: ₹{Number(card.daily_limit).toLocaleString()}</p>
                  <div className="flex gap-2">
                    <Button
                      variant={card.status === "frozen" ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleFreeze(card.id, card.status)}
                    >
                      <Snowflake className="w-3 h-3 mr-1" />
                      {card.status === "frozen" ? "Unfreeze" : "Freeze"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}