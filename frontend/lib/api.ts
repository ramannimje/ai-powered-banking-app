const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  token?: string;
}

class ApiClient {
  private getHeaders(token?: string): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = "GET", body, token } = options;

    const config: RequestInit = {
      method,
      headers: this.getHeaders(token),
    };

    if (body) {
      config.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE}${endpoint}`, config);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Request failed" }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async get<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    return this.request(endpoint, { ...options, method: "GET" });
  }

  // Auth
  async register(data: { email: string; password: string; full_name: string; phone?: string }) {
    return this.request("/auth/register", { method: "POST", body: data });
  }

  async login(email: string, password: string) {
    return this.request("/auth/login", { method: "POST", body: { email, password } });
  }

  async refresh(token: string) {
    return this.request("/auth/refresh", { method: "POST", body: { refresh_token: token } });
  }

  async getMe(token: string) {
    return this.request("/auth/me", { token });
  }

  // Accounts
  async getAccounts(token: string) {
    return this.request("/accounts", { token });
  }

  async createAccount(data: { currency: string; account_name: string }, token: string) {
    return this.request("/accounts", { method: "POST", body: data, token });
  }

  async getPrimaryAccount(token: string) {
    return this.request("/accounts/primary", { token });
  }

  // Transactions
  async getTransactions(params: Record<string, string>, token: string) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/transactions?${query}`, { token });
  }

  async createTransaction(data: {
    account_id: string;
    type: string;
    amount: number;
    category?: string;
    merchant?: string;
    description?: string;
  }, token: string) {
    return this.request("/transactions", { method: "POST", body: data, token });
  }

  async transfer(data: {
    from_account_id: string;
    to_account_id: string;
    amount: number;
    description?: string;
  }, token: string) {
    return this.request("/transactions/transfer", { method: "POST", body: data, token });
  }

  // Vaults
  async getVaults(token: string) {
    return this.request("/vaults", { token });
  }

  async createVault(data: { name: string; goal_amount?: number; description?: string; color?: string }, token: string) {
    return this.request("/vaults", { method: "POST", body: data, token });
  }

  async depositToVault(data: { vault_id: string; amount: number }, token: string) {
    return this.request("/vaults/deposit", { method: "POST", body: data, token });
  }

  // Cards
  async getCards(token: string) {
    return this.request("/cards", { token });
  }

  async createVirtualCard(token: string) {
    return this.request("/cards", { method: "POST", token });
  }

  async freezeCard(cardId: string, freeze: boolean, token: string) {
    return this.request("/cards/freeze", { method: "POST", body: { card_id: cardId, freeze }, token });
  }

  // Analytics
  async getSpendingAnalytics(days: number, token: string) {
    return this.request(`/analytics/spending?days=${days}`, { token });
  }

  async getSummary(token: string) {
    return this.request("/analytics/summary", { token });
  }

  // AI
  async chat(message: string, token: string) {
    return this.request("/ai/chat", { method: "POST", body: { message }, token });
  }

  async budgetSimulate(data: { item: string; amount: number; months: number }, token: string) {
    return this.request("/ai/budget-simulate", { method: "POST", body: data, token });
  }

  // Notifications
  async getNotifications(params: Record<string, string>, token: string) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/notifications?${query}`, { token });
  }

  async markNotificationRead(id: string, token: string) {
    return this.request(`/notifications/${id}/read`, { method: "POST", token });
  }

  // Fraud
  async getFraudAlerts(token: string) {
    return this.request("/fraud/alerts", { token });
  }
}

export const api = new ApiClient();