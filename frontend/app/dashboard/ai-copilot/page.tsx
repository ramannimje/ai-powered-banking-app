"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Send, Bot, Loader2, Lightbulb, TrendingDown, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/stores/auth";
import { api } from "@/lib/api";

interface Message {
  role: "user" | "ai";
  content: string;
}

const SUGGESTIONS = [
  "Why did I spend more this month?",
  "Show my top spending categories",
  "Any unusual transactions?",
  "Can I afford a ₹50,000 purchase?",
];

export default function AICopilotPage() {
  const { accessToken } = useAuthStore();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "ai",
      content: "👋 Hi! I'm your AI Financial Copilot. Ask me anything about your spending, savings, or financial health. Try one of the suggestions below or type your own question!",
    },
  ]);
  const [loading, setLoading] = useState(false);

  const send = async (text?: string) => {
    const textToSend = text || input.trim();
    if (!textToSend) return;

    setMessages((prev) => [...prev, { role: "user", content: textToSend }]);
    setInput("");
    setLoading(true);

    try {
      const data = await api.chat(textToSend, accessToken!) as any;
      setMessages((prev) => [...prev, { role: "ai", content: data.reply }]);
    } catch (err) {
      toast.error("AI is taking a break. Try again.");
      setMessages((prev) => prev.slice(-1));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bot className="w-6 h-6" /> AI Financial Copilot
        </h1>
        <p className="text-muted-foreground">Powered by GPT-4o — analyze your finances in plain English</p>
      </div>

      <Card className="border-0 shadow-md">
        <CardContent className="p-0">
          {/* Chat messages */}
          <div className="h-[450px] overflow-y-auto p-6 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.role === "ai" ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}>
                  {msg.role === "ai" ? "🤖" : "👤"}
                </div>
                <div className={`rounded-2xl px-4 py-3 max-w-[75%] text-sm ${
                  msg.role === "ai" ? "bg-muted" : "bg-primary text-primary-foreground"
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground">🤖</div>
                <div className="bg-muted rounded-2xl px-4 py-3">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>

          {/* Suggestions */}
          {messages.length === 1 && (
            <div className="px-6 pb-3 flex gap-2 flex-wrap">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs bg-muted hover:bg-muted/80 rounded-full px-3 py-1.5 transition-colors flex items-center gap-1"
                >
                  <Lightbulb className="w-3 h-3" /> {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="border-t p-4 flex gap-2">
            <Input
              placeholder="Ask about your finances..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              className="flex-1"
            />
            <Button onClick={() => send()} disabled={loading || !input.trim()}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}