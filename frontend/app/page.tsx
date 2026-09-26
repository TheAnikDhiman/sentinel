"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Bot,
  ChevronRight,
  CircleDollarSign,
  Gauge,
  History,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  PanelLeftClose,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Timer,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Page = "chat" | "dashboard" | "history" | "settings";
type Provider = "auto" | "gemini" | "openrouter";

type ChatResult = {
  id: number;
  response: string;
  provider: string;
  model: string;
  tier: string;
  complexity: number;
  task_type: string;
  routing_reason: string[];
  input_tokens: number;
  output_tokens: number;
  reference_cost: number;
  baseline_cost: number;
  estimated_savings: number;
  latency_ms: number;
  used_fallback: boolean;
  created_at: string;
};

type HistoryItem = {
  id: number;
  prompt: string;
  response: string;
  provider: string;
  model: string;
  tier: string;
  complexity: number;
  task_type: string;
  routing_reason: string[];
  input_tokens: number;
  output_tokens: number;
  reference_cost: number;
  baseline_cost: number;
  savings: number;
  latency_ms: number;
  used_fallback: boolean;
  created_at: string;
};

type Analytics = {
  total_requests: number;
  reference_spend: number;
  baseline_spend: number;
  estimated_savings: number;
  average_complexity: number;
  provider_usage: Record<string, number>;
  tier_usage: Record<string, number>;
  fallback_count: number;
  timeline: {
    date: string;
    reference_cost: number;
    baseline_cost: number;
    savings: number;
    requests: number;
  }[];
};

type ProviderHealth = {
  name: string;
  id: string;
  configured: boolean;
  models: string[];
};

type RoutingSettings = {
  medium_threshold: number;
  high_threshold: number;
  gemini_low_model: string;
  gemini_medium_model: string;
  openrouter_high_model: string;
};

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const nav = [
  { id: "chat" as Page, label: "AI Router", icon: MessageSquareText },
  { id: "dashboard" as Page, label: "Dashboard", icon: LayoutDashboard },
  { id: "history" as Page, label: "Request History", icon: History },
  { id: "settings" as Page, label: "Settings", icon: Settings },
];

function money(value: number) {
  if (!value) return "$0.0000";
  return `$${value.toFixed(value < 0.01 ? 6 : 4)}`;
}

function providerLabel(provider: string) {
  return provider === "openrouter" ? "OpenRouter" : provider === "gemini" ? "Gemini" : provider;
}

export default function Home() {
  const [page, setPage] = useState<Page>("chat");
  const [collapsed, setCollapsed] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState<Provider>("auto");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ChatResult | null>(null);
  const [error, setError] = useState("");
  const [apiConnected, setApiConnected] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [providers, setProviders] = useState<ProviderHealth[]>([]);
  const [routingSettings, setRoutingSettings] = useState<RoutingSettings>({
    medium_threshold: 40,
    high_threshold: 70,
    gemini_low_model: "gemini-3.5-flash-lite",
    gemini_medium_model: "gemini-3.8-flash",
    openrouter_high_model: "nvidia/nemotron-3-ultra-550b-a55b:free",
  });
  const [savingSettings, setSavingSettings] = useState(false);

  const refreshData = useCallback(async () => {
    try {
      const [healthResponse, analyticsResponse, historyResponse, providersResponse, settingsResponse] = await Promise.all([
        fetch(`${API}/api/health`),
        fetch(`${API}/api/analytics`),
        fetch(`${API}/api/history?limit=50`),
        fetch(`${API}/api/providers`),
        fetch(`${API}/api/settings`),
      ]);

      if (![healthResponse, analyticsResponse, historyResponse, providersResponse, settingsResponse].every((r) => r.ok)) {
        throw new Error("Backend returned an error");
      }

      const [, analyticsData, historyData, providersData, settingsData] = await Promise.all([
        healthResponse.json(),
        analyticsResponse.json(),
        historyResponse.json(),
        providersResponse.json(),
        settingsResponse.json(),
      ]);

      setApiConnected(true);
      setAnalytics(analyticsData);
      setHistory(historyData);
      setProviders(providersData);
      setRoutingSettings(settingsData);
    } catch {
      setApiConnected(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

async function submit() {
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(`${API}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt.trim(), provider }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Request failed");
      setResult(data);
      await refreshData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to reach Sentinel backend");
    } finally {
      setLoading(false);
    }
  }

  async function saveRoutingSettings() {
    setSavingSettings(true);
    setError("");
    try {
      const response = await fetch(`${API}/api/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medium_threshold: routingSettings.medium_threshold,
          high_threshold: routingSettings.high_threshold,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Unable to save settings");
      setRoutingSettings(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save settings");
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <main className="app-shell">
      <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
        <div className="brand-row">
          <div className="brand-mark"><ShieldCheck size={20} /></div>
          {!collapsed && <div><strong>Sentinel</strong><span>AI orchestration</span></div>}
          <button className="icon-btn collapse" onClick={() => setCollapsed(!collapsed)} aria-label="Toggle sidebar">
            <PanelLeftClose size={17} />
          </button>
        </div>

        <div className="mode-card">
          <div className={`mode-dot ${apiConnected ? "online" : ""}`} />
          {!collapsed && <div><strong>{apiConnected ? "Router online" : "Backend offline"}</strong><span>Complexity-aware mode</span></div>}
        </div>

        <nav>
          {!collapsed && <p className="eyebrow nav-label">Workspace</p>}
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={`nav-item ${page === item.id ? "active" : ""}`} onClick={() => setPage(item.id)}>
                <Icon size={18} />
                {!collapsed && <span>{item.label}</span>}
                {!collapsed && page === item.id && <ChevronRight size={15} className="nav-chevron" />}
              </button>
            );
          })}
        </nav>

        {!collapsed && (
          <div className="sidebar-bottom">
            <p className="eyebrow">Providers</p>
            {providers.map((p) => (
              <div className="provider-mini" key={p.id}>
                <span className={`health-dot ${p.configured ? "ok" : "off"}`} />
                <span>{p.name}</span>
                <small>{p.configured ? "Ready" : "Key missing"}</small>
              </div>
            ))}
            <div className="mini-stat"><span>Estimated savings</span><strong>{money(analytics?.estimated_savings || 0)}</strong></div>
            <div className="mini-stat"><span>Total routed</span><strong>{analytics?.total_requests || 0}</strong></div>
          </div>
        )}
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Sentinel Control Plane</p>
            <h1>{page === "chat" ? "Intelligent AI Router" : page === "dashboard" ? "Routing Analytics" : page === "history" ? "Request History" : "Routing Settings"}</h1>
          </div>
          <div className="top-actions">
            <div className={`status-pill ${apiConnected ? "" : "offline"}`}><span className="live-dot" /> {apiConnected ? "API Connected" : "API Offline"}</div>
            <button className="icon-btn" aria-label="Menu"><Menu size={18} /></button>
          </div>
        </header>

        {error && <div className="global-error">{error}</div>}

        {page === "chat" && (
          <div className="page-grid chat-layout">
            <section className="panel hero-panel">
              <div className="hero-glow" />
              <div className="hero-heading">
                <div>
                  <span className="badge"><Sparkles size={13} /> Explainable model routing</span>
                  <h2>One prompt. The right model.</h2>
                  <p>Sentinel scores each request and chooses a model tier based on complexity, capability, and reference cost.</p>
                </div>
                <div className="score-orb">
                  <span>{result?.complexity ?? "--"}</span>
                  <small>complexity</small>
                </div>
              </div>

              <div className="routing-lane">
                <div><span>LOW</span><strong>Gemini Flash-Lite</strong><small>&lt; {routingSettings.medium_threshold}</small></div>
                <i />
                <div><span>MEDIUM</span><strong>Gemini 3.8 Flash</strong><small>{routingSettings.medium_threshold}–{routingSettings.high_threshold - 1}</small></div>
                <i />
                <div><span>HIGH</span><strong>Nemotron via OpenRouter</strong><small>≥ {routingSettings.high_threshold}</small></div>
              </div>

              <div className="composer">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit();
                  }}
                  placeholder="Ask Sentinel anything — coding, analysis, architecture, writing..."
                />
                <div className="composer-footer">
                  <div className="segmented">
                    {(["auto", "gemini", "openrouter"] as Provider[]).map((p) => (
                      <button key={p} className={provider === p ? "selected" : ""} onClick={() => setProvider(p)}>
                        {p === "auto" ? "Auto route" : p === "gemini" ? "Gemini" : "OpenRouter"}
                      </button>
                    ))}
                  </div>
                  <button className="send-btn" onClick={submit} disabled={loading || !prompt.trim()}>
                    {loading ? <Activity size={17} className="spin" /> : <Send size={17} />}
                    {loading ? "Routing..." : "Route request"}
                  </button>
                </div>
                <span className="shortcut">Ctrl/⌘ + Enter to send</span>
              </div>
            </section>

            <aside className="panel decision-panel">
              <div className="panel-title"><div><p className="eyebrow">Live decision</p><h3>Routing insight</h3></div><Gauge size={20} /></div>
              {result ? (
                <>
                  <div className="model-card">
                    <div className={`provider-icon ${result.provider}`}><Bot size={20} /></div>
                    <div><span>Selected provider</span><strong>{providerLabel(result.provider)}</strong><small>{result.model}</small></div>
                    <div className="complexity-chip">{result.complexity}/100</div>
                  </div>
                  <div className="tier-row"><span>Tier</span><strong>{result.tier}</strong>{result.used_fallback && <em>Fallback used</em>}</div>
                  <div className="reason-list">
                    {result.routing_reason.slice(0, 5).map((reason, index) => <div key={`${reason}-${index}`}><span>{index + 1}</span><p>{reason}</p></div>)}
                  </div>
                  <div className="meta-grid">
                    <div><Timer size={15} /><span>Latency</span><strong>{(result.latency_ms / 1000).toFixed(2)}s</strong></div>
                    <div><CircleDollarSign size={15} /><span>Reference cost</span><strong>{money(result.reference_cost)}</strong></div>
                    <div><Zap size={15} /><span>Vs baseline</span><strong>{money(result.estimated_savings)}</strong></div>
                    <div><BarChart3 size={15} /><span>Tokens</span><strong>{result.input_tokens + result.output_tokens}</strong></div>
                  </div>
                </>
              ) : (
                <div className="empty-state"><div className="empty-orb"><Bot size={24} /></div><h4>Waiting for a request</h4><p>Model selection, reasoning signals, latency, and cost metadata will appear here.</p></div>
              )}
            </aside>

            <section className="panel response-panel">
              <div className="panel-title"><div><p className="eyebrow">Model output</p><h3>Response</h3></div>{result && <span className="badge subtle">{result.task_type}</span>}</div>
              {result ? <div className="response-copy">{result.response}</div> : <div className="response-placeholder">Your routed AI response will appear here.</div>}
            </section>
          </div>
        )}

        {page === "dashboard" && <Dashboard analytics={analytics} providers={providers} history={history} />}
        {page === "history" && <HistoryTable history={history} />}
        {page === "settings" && (
          <SettingsPanel
            settings={routingSettings}
            setSettings={setRoutingSettings}
            saveSettings={saveRoutingSettings}
            saving={savingSettings}
            providers={providers}
          />
        )}
      </section>
    </main>
  );
}

function Dashboard({ analytics, providers, history }: { analytics: Analytics | null; providers: ProviderHealth[]; history: HistoryItem[] }) {
  const pieData = useMemo(
    () => Object.entries(analytics?.provider_usage || {}).map(([name, value]) => ({ name, value })),
    [analytics],
  );

  const cards = [
    { label: "Total requests", value: analytics?.total_requests ?? 0, icon: Activity, note: "Stored in local request history" },
    { label: "Reference spend", value: money(analytics?.reference_spend || 0), icon: CircleDollarSign, note: "Paid-equivalent estimate" },
    { label: "Estimated savings", value: money(analytics?.estimated_savings || 0), icon: Zap, note: "Versus configured baseline" },
    { label: "Avg. complexity", value: `${analytics?.average_complexity || 0}/100`, icon: Gauge, note: `${analytics?.fallback_count || 0} fallback request(s)` },
  ];

  return (
    <div className="dashboard-stack">
      <div className="metric-grid">
        {cards.map(({ label, value, icon: Icon, note }) => (
          <div className="metric-card panel" key={label}><div className="metric-icon"><Icon size={18} /></div><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
        ))}
      </div>

      <div className="dashboard-grid">
        <section className="panel chart-panel wide">
          <div className="panel-title"><div><p className="eyebrow">Efficiency trend</p><h3>Reference cost vs baseline</h3></div><span className="badge subtle">Last 14 active days</span></div>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics?.timeline || []}>
                <defs><linearGradient id="savingFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#a58cff" stopOpacity={0.35}/><stop offset="95%" stopColor="#a58cff" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid stroke="#242435" vertical={false}/>
                <XAxis dataKey="date" stroke="#6f7083" tickLine={false} axisLine={false}/>
                <YAxis stroke="#6f7083" tickLine={false} axisLine={false}/>
                <Tooltip contentStyle={{background:"#11111a", border:"1px solid #29293a", borderRadius:12}}/>
                <Area type="monotone" dataKey="baseline_cost" stroke="#56576b" fill="transparent" strokeWidth={2}/>
                <Area type="monotone" dataKey="reference_cost" stroke="#a58cff" fill="url(#savingFill)" strokeWidth={2}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel chart-panel">
          <div className="panel-title"><div><p className="eyebrow">Distribution</p><h3>Provider usage</h3></div></div>
          <div className="donut-wrap">
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={pieData.length ? pieData : [{name:"No data", value:1}]} dataKey="value" innerRadius={62} outerRadius={86} paddingAngle={4}>
                  {(pieData.length ? pieData : [{name:"No data", value:1}]).map((_, index) => <Cell key={index} fill={index === 0 ? "#a58cff" : "#4fd2a1"}/>)}</Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center"><strong>{analytics?.total_requests || 0}</strong><span>requests</span></div>
          </div>
          <div className="legend-row"><span><i className="dot purple"/>Gemini</span><span><i className="dot green"/>OpenRouter</span></div>
        </section>
      </div>

      <div className="dashboard-grid bottom-grid">
        <section className="panel recent-panel">
          <div className="panel-title"><div><p className="eyebrow">Recent routing</p><h3>Latest decisions</h3></div></div>
          {history.slice(0, 5).map((item) => (
            <div className="recent-row" key={item.id}>
              <div className={`provider-icon ${item.provider}`}><Bot size={16}/></div>
              <div className="recent-copy"><strong>{item.prompt.slice(0, 54)}{item.prompt.length > 54 ? "…" : ""}</strong><span>{providerLabel(item.provider)} · {item.tier} tier · complexity {item.complexity}</span></div>
              <strong>{money(item.reference_cost)}</strong>
            </div>
          ))}
          {!history.length && <div className="response-placeholder">No requests yet.</div>}
        </section>

        <section className="panel provider-panel">
          <div className="panel-title"><div><p className="eyebrow">Infrastructure</p><h3>Provider configuration</h3></div></div>
          {providers.map((p) => <div className="provider-row" key={p.id}><div><span className={`health-dot ${p.configured ? "ok" : "off"}`}/><strong>{p.name}</strong></div><span>{p.configured ? "Configured" : "Missing key"}</span></div>)}
        </section>
      </div>
    </div>
  );
}

function HistoryTable({ history }: { history: HistoryItem[] }) {
  return (
    <section className="panel history-panel">
      <div className="panel-title"><div><p className="eyebrow">Observability</p><h3>All routed requests</h3></div><span className="badge subtle">{history.length} records</span></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Request</th><th>Provider</th><th>Tier</th><th>Complexity</th><th>Latency</th><th>Reference cost</th><th>Savings</th></tr></thead>
          <tbody>
            {history.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.prompt.slice(0, 68)}{item.prompt.length > 68 ? "…" : ""}</strong><span>{new Date(item.created_at).toLocaleString()}</span></td>
                <td><span className={`model-tag ${item.provider}`}>{providerLabel(item.provider)}</span></td>
                <td><span className="tier-tag">{item.tier}</span></td>
                <td><div className="complexity-bar"><i style={{width:`${item.complexity}%`}}/><span>{item.complexity}</span></div></td>
                <td>{(item.latency_ms / 1000).toFixed(2)}s</td>
                <td>{money(item.reference_cost)}</td>
                <td className="saving-text">{money(item.savings)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!history.length && <div className="empty-table">No request history yet. Route your first prompt from AI Router.</div>}
      </div>
    </section>
  );
}

function SettingsPanel({
  settings,
  setSettings,
  saveSettings,
  saving,
  providers,
}: {
  settings: RoutingSettings;
  setSettings: (value: RoutingSettings) => void;
  saveSettings: () => void;
  saving: boolean;
  providers: ProviderHealth[];
}) {
  const valid = settings.medium_threshold < settings.high_threshold;

  return (
    <div className="settings-grid">
      <section className="panel settings-card">
        <div className="panel-title"><div><p className="eyebrow">Routing policy</p><h3>Complexity thresholds</h3></div><Gauge size={19}/></div>
        <p className="settings-copy">Low requests use Gemini Flash-Lite, medium requests use Gemini 3.8 Flash, and high-complexity requests use Nemotron through OpenRouter.</p>

        <div className="slider-block">
          <div className="slider-heading"><span>Medium threshold</span><strong>{settings.medium_threshold}</strong></div>
          <input className="range" type="range" min="10" max="75" value={settings.medium_threshold} onChange={(e) => setSettings({...settings, medium_threshold: Number(e.target.value)})}/>
        </div>
        <div className="slider-block">
          <div className="slider-heading"><span>High threshold</span><strong>{settings.high_threshold}</strong></div>
          <input className="range" type="range" min="40" max="95" value={settings.high_threshold} onChange={(e) => setSettings({...settings, high_threshold: Number(e.target.value)})}/>
        </div>
        {!valid && <p className="validation-text">Medium threshold must stay below the high threshold.</p>}
        <button className="send-btn save-btn" onClick={saveSettings} disabled={!valid || saving}>{saving ? "Saving..." : "Save routing policy"}</button>
      </section>

      <section className="panel settings-card">
        <div className="panel-title"><div><p className="eyebrow">Providers</p><h3>Backend configuration</h3></div><Activity size={19}/></div>
        <p className="settings-copy">API keys live only in <code>backend/.env</code> and are never exposed to the browser.</p>
        {providers.map((provider) => (
          <div className="provider-setting" key={provider.id}>
            <div className={`provider-icon ${provider.id}`}><Bot size={17}/></div>
            <div><strong>{provider.name}</strong><span>{provider.models.join(" · ")}</span></div>
            <span className={`connection-label ${provider.configured ? "online" : "offline"}`}>{provider.configured ? "Configured" : "Add API key"}</span>
          </div>
        ))}
      </section>

      <section className="panel settings-card full">
        <div className="panel-title"><div><p className="eyebrow">Routing logic</p><h3>How Sentinel decides</h3></div><ShieldCheck size={19}/></div>
        <div className="logic-flow">
          <div><span>01</span><strong>Analyze</strong><p>Prompt length, task type, instruction density, code, and reasoning signals.</p></div><i/>
          <div><span>02</span><strong>Score</strong><p>Produce an explainable complexity score from 0 to 100.</p></div><i/>
          <div><span>03</span><strong>Route</strong><p>Select Gemini low/medium or OpenRouter high tier using configurable thresholds.</p></div><i/>
          <div><span>04</span><strong>Measure</strong><p>Record latency, tokens, paid-equivalent reference cost, and baseline savings.</p></div>
        </div>
      </section>

      <section className="panel settings-card full compact-card">
        <div className="panel-title"><div><p className="eyebrow">Cost semantics</p><h3>What the dashboard numbers mean</h3></div><CircleDollarSign size={19}/></div>
        <p className="settings-copy wide-copy">The project can run on provider free tiers, so Sentinel labels costs as <strong>reference estimates</strong>. They are calculated from configurable paid-tier rates and compared with an “always use Gemini 3.8 Flash” baseline. This avoids pretending free-tier development usage is an actual production bill.</p>
      </section>
    </div>
  );
}
