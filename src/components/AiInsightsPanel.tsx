import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, RefreshCw, Copy, Check, Info, TrendingUp, Coins, ChevronRight, MessageSquare, AlertCircle } from 'lucide-react';
import { JcbEntry, JcbStats } from '../types';
import { formatCurrency } from '../utils';

interface Reminder {
  customerName: string;
  dueAmount: number;
  suggestedMessage: string;
}

interface InsightsData {
  summary: string;
  efficiencyAdvice: string;
  financialsAnalysis: string;
  customerReminders: Reminder[];
}

interface AiInsightsPanelProps {
  entries: JcbEntry[];
  stats: JcbStats;
}

export default function AiInsightsPanel({ entries, stats }: AiInsightsPanelProps) {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'efficiency' | 'reminders'>('summary');
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/gemini/insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ entries, stats }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate insights. Ensure server is running and GEMINI_API_KEY is configured.');
      }

      const data = await response.json();
      setInsights(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Something went wrong while generating insights.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div id="ai-insights-panel" className="bg-slate-50 rounded-xl border border-slate-200/80 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <div className="p-1 rounded-md bg-amber-500/10 text-amber-600">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">AI Fleet Business Co-Pilot</h4>
        </div>
        {insights && (
          <button
            onClick={fetchInsights}
            disabled={loading}
            className="p-1 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded transition-colors"
            title="Refresh Insights"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {!insights && !loading && (
          <motion.div
            key="generate-state"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-4 px-2"
          >
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed mb-3">
              Generate intelligent cashflow audits, machine productivity reviews, and custom payment reminder drafts.
            </p>
            <button
              onClick={fetchInsights}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs font-black rounded-lg shadow-sm hover:shadow flex items-center justify-center gap-1.5 mx-auto transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" /> Analyze Operations with AI
            </button>
          </motion.div>
        )}

        {loading && (
          <motion.div
            key="loading-state"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="py-6 text-center space-y-3"
          >
            <div className="flex justify-center">
              <RefreshCw className="w-6 h-6 text-amber-500 animate-spin" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-700">Analyzing fleet logs...</p>
              <p className="text-[10px] text-slate-400 font-semibold italic max-w-xs mx-auto animate-pulse">
                Auditing JCB billing, cash flow parameters, and preparing client communication drafts
              </p>
            </div>
          </motion.div>
        )}

        {error && (
          <motion.div
            key="error-state"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-xs text-rose-700 space-y-2 mt-1"
          >
            <div className="flex items-center gap-1.5 font-bold">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Co-Pilot Audit Interrupted</span>
            </div>
            <p className="text-[10px] text-rose-600 leading-relaxed font-semibold">
              {error}
            </p>
            <button
              onClick={fetchInsights}
              className="text-[10px] font-black underline text-rose-800 hover:text-rose-950 flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" /> Retry Audit
            </button>
          </motion.div>
        )}

        {insights && !loading && (
          <motion.div
            key="insights-state"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3 mt-1"
          >
            {/* Horizontal Tabs */}
            <div className="flex border-b border-slate-200 text-[10px] font-extrabold text-slate-400 bg-slate-100 p-0.5 rounded-lg">
              <button
                onClick={() => setActiveTab('summary')}
                className={`flex-1 py-1.5 rounded-md transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  activeTab === 'summary'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'hover:text-slate-700'
                }`}
              >
                <TrendingUp className="w-3 h-3" /> Summary
              </button>
              <button
                onClick={() => setActiveTab('efficiency')}
                className={`flex-1 py-1.5 rounded-md transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  activeTab === 'efficiency'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'hover:text-slate-700'
                }`}
              >
                <Info className="w-3 h-3" /> Machinery
              </button>
              <button
                onClick={() => setActiveTab('reminders')}
                className={`flex-1 py-1.5 rounded-md transition-all flex items-center justify-center gap-1 relative cursor-pointer ${
                  activeTab === 'reminders'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'hover:text-slate-700'
                }`}
              >
                <MessageSquare className="w-3 h-3" /> Reminders
                {insights.customerReminders?.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-bold text-[8px] px-1.5 py-0.2 rounded-full border border-white">
                    {insights.customerReminders.length}
                  </span>
                )}
              </button>
            </div>

            {/* Tab content panel */}
            <div className="bg-white border border-slate-150 p-3 rounded-lg text-xs leading-relaxed text-slate-600 font-semibold shadow-inner min-h-[140px] max-h-[220px] overflow-y-scroll custom-scrollbar">
              {activeTab === 'summary' && (
                <div className="space-y-2.5">
                  <div className="text-slate-800 font-bold flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-amber-600">
                    <TrendingUp className="w-3.5 h-3.5" /> Cashflow & Fleet Overview
                  </div>
                  <p className="text-[11px] font-semibold text-slate-600">{insights.summary}</p>
                  <div className="border-t border-slate-100 pt-2 text-[10px] text-slate-500 font-normal">
                    {insights.financialsAnalysis}
                  </div>
                </div>
              )}

              {activeTab === 'efficiency' && (
                <div className="space-y-2.5">
                  <div className="text-slate-800 font-bold flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-amber-600">
                    <Info className="w-3.5 h-3.5" /> Operations Optimization
                  </div>
                  <p className="text-[11px] font-semibold text-slate-600">{insights.efficiencyAdvice}</p>
                </div>
              )}

              {activeTab === 'reminders' && (
                <div className="space-y-3">
                  <div className="text-slate-800 font-bold flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-amber-600">
                    <Coins className="w-3.5 h-3.5" /> Due Balance Reminder Copier
                  </div>
                  {insights.customerReminders?.length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic text-center py-4">
                      All customers have paid their billing. No reminders needed!
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {insights.customerReminders.map((reminder, idx) => (
                        <div key={idx} className="p-2 border border-slate-100 bg-slate-50/50 rounded-lg space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="font-extrabold text-slate-800 text-[11px]">{reminder.customerName}</span>
                            <span className="text-rose-600 font-black text-[10px]">{formatCurrency(reminder.dueAmount)} due</span>
                          </div>
                          <p className="text-[10px] bg-white p-1.5 rounded border border-slate-150 text-slate-500 font-normal italic leading-snug">
                            &ldquo;{reminder.suggestedMessage}&rdquo;
                          </p>
                          <button
                            onClick={() => copyToClipboard(reminder.suggestedMessage, idx)}
                            className="px-2 py-1 w-full bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-700 hover:text-slate-900 rounded font-black text-[10px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
                          >
                            {copiedIndex === idx ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" /> Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" /> Copy Reminder Draft
                              </>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
