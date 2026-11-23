'use client';

import React, { useState } from 'react';
import { 
  Shield, Key, Lock, Unlock, Search, Plus, ExternalLink, 
  Sparkles, FileText, Award, FolderGit2, Zap, Check, Copy, Bot, ArrowRight
} from 'lucide-react';

export default function VaultOneDashboard() {
  const [isLocked, setIsLocked] = useState(true);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');

  const stats = {
    accounts: 12,
    experiments: 8,
    projects: 5,
    securityScore: 88,
  };

  const [accounts, setAccounts] = useState([
    { id: '1', name: 'GitHub', category: 'Development', username: 'alex_dev', pass: '••••••••••••', lastUpdated: '2026-08-12' },
    { id: '2', name: 'AWS Cloud', category: 'Cloud', username: 'admin@vault.io', pass: '••••••••••••', lastUpdated: '2026-09-01' },
    { id: '3', name: 'Canva Pro', category: 'Design', username: 'alex@design.com', pass: '••••••••••••', lastUpdated: '2026-07-20' },
  ]);

  const [experiments, setExperiments] = useState([
    { id: '1', name: 'SoilSense AI Builder', tool: 'v0.dev', category: 'AI Builder', status: 'Completed', rating: 5, notes: 'Generated clean Tailwind UI components for college project.' },
    { id: '2', name: 'Local Vector Store', tool: 'ChromaDB', category: 'Database', status: 'Experimenting', rating: 4, notes: 'Testing fast vector indexing locally.' },
    { id: '3', name: 'API Tester', tool: 'Postman', category: 'Developer Tool', status: 'Frequently Used', rating: 5, notes: 'Essential for testing Next.js REST endpoints.' },
  ]);

  const [documents, setDocuments] = useState([
    { id: '1', title: 'Passport Copy', category: 'Identity', expiry: '2028-05-14', status: 'Valid' },
    { id: '2', title: 'College Student ID', category: 'Education', expiry: '2026-11-30', status: 'Expiring Soon' },
    { id: '3', title: 'AWS Cloud Practitioner Certificate', category: 'Certification', expiry: '2027-01-15', status: 'Valid' },
  ]);

  const filteredAccounts = accounts.filter((item) =>
    `${item.name} ${item.category} ${item.username}`.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredExperiments = experiments.filter((item) =>
    `${item.name} ${item.tool} ${item.category} ${item.notes}`.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredDocuments = documents.filter((item) =>
    `${item.title} ${item.category} ${item.expiry}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCopy = (id: string, val: string) => {
    navigator.clipboard.writeText(val);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const unlockVault = () => {
    if (pin === '1234') {
      setPinError('');
      setIsLocked(false);
    } else {
      setPinError('Incorrect PIN. Use 1234 for this demo.');
    }
  };

  const runVaultSearch = () => {
    const question = aiQuestion.toLowerCase();
    if (!question.trim()) {
      setAiAnswer('Enter a question to search your vault metadata.');
    } else if (question.includes('expir')) {
      setAiAnswer(documents.map((doc) => `${doc.title}: ${doc.status} (expiry ${doc.expiry})`).join('\n'));
    } else if (question.includes('project') || question.includes('experiment') || question.includes('tool')) {
      setAiAnswer(experiments.map((exp) => `${exp.name} — ${exp.tool}, ${exp.status}`).join('\n'));
    } else if (question.includes('account') || question.includes('credential') || question.includes('password')) {
      setAiAnswer(accounts.map((account) => `${account.name}: ${account.username} (${account.category})`).join('\n'));
    } else {
      setAiAnswer(`I found ${accounts.length} accounts, ${experiments.length} experiments, and ${documents.length} documents in your vault.`);
    }
  };

  const addVaultItem = () => {
    const name = newItemName.trim();
    if (!name) return;
    const id = `${Date.now()}`;
    if (activeTab === 'accounts') {
      setAccounts((items) => [...items, { id, name, category: 'Custom', username: 'Not configured', pass: '••••••••••••', lastUpdated: new Date().toISOString().slice(0, 10) }]);
    } else if (activeTab === 'experiments') {
      setExperiments((items) => [...items, { id, name, tool: 'Custom', category: 'New Entry', status: 'Experimenting', rating: 0, notes: 'New vault experiment entry.' }]);
    } else if (activeTab === 'documents') {
      setDocuments((items) => [...items, { id, title: name, category: 'Custom', expiry: 'Not set', status: 'Valid' }]);
    } else {
      setAccounts((items) => [...items, { id, name, category: 'Custom', username: 'Not configured', pass: '••••••••••••', lastUpdated: new Date().toISOString().slice(0, 10) }]);
    }
    setNewItemName('');
    setShowAddItem(false);
  };

  if (isLocked) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 bg-indigo-600/20 text-indigo-400 rounded-full flex items-center justify-center mx-auto border border-indigo-500/30">
            <Lock className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">VaultOne Locked</h1>
            <p className="text-sm text-slate-400 mt-1">Enter your Vault PIN to decrypt your dashboard</p>
          </div>
          <div className="space-y-4">
            <input
              type="password"
              placeholder="Enter PIN (Demo: 1234)"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setPinError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && unlockVault()}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-center text-lg tracking-widest text-white focus:outline-none focus:border-indigo-500 transition-all"
            />
            {pinError && <p className="text-sm text-red-400">{pinError}</p>}
            <button
              onClick={unlockVault}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
            >
              <Unlock className="w-4 h-4" /> Unlock Vault
            </button>
          </div>
          <p className="text-xs text-slate-500">AES-256-GCM Browser-Side Zero Knowledge Encryption</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-800 p-6 flex flex-col justify-between">
        <div className="space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-white leading-none">VaultOne</h2>
              <span className="text-xs text-emerald-400 font-medium">Vault Unlocked</span>
            </div>
          </div>

          <nav className="space-y-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: Shield },
              { id: 'accounts', label: 'Accounts & Credentials', icon: Key },
              { id: 'experiments', label: 'Student Experiment Lab', icon: Zap },
              { id: 'documents', label: 'Document & Identity', icon: FileText },
              { id: 'ai', label: 'VaultAI Assistant', icon: Bot },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="pt-6 border-t border-slate-800">
          <button
            onClick={() => {
              setIsLocked(true);
              setPin('');
              setPinError('');
              setSearchQuery('');
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-all"
          >
            <Lock className="w-4 h-4" /> Lock Vault
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-10 space-y-8 overflow-y-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <h1 className="text-2xl font-bold text-white capitalize">{activeTab}</h1>
            <p className="text-sm text-slate-400">Personal Command Center & Encrypted Repository</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search across vault..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 transition-all w-64"
              />
            </div>
            <button
              onClick={() => setShowAddItem(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-indigo-600/20"
            >
              <Plus className="w-4 h-4" /> Add Item
            </button>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Accounts', val: stats.accounts, icon: Key, color: 'text-indigo-400' },
                { label: 'Tested Experiments', val: stats.experiments, icon: Zap, color: 'text-amber-400' },
                { label: 'Linked Projects', val: stats.projects, icon: FolderGit2, color: 'text-blue-400' },
                { label: 'Security Score', val: `${stats.securityScore}%`, icon: Shield, color: 'text-emerald-400' },
              ].map((m, idx) => {
                const Icon = m.icon;
                return (
                  <div key={idx} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center gap-4">
                    <div className={`p-3 bg-slate-950 rounded-xl ${m.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-medium">{m.label}</p>
                      <p className="text-2xl font-bold text-white mt-0.5">{m.val}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-400" /> Student Experiment Lab
                  </h3>
                  <p className="text-xs text-slate-400">Recent AI builders, developer tools, and framework tests</p>
                </div>
                <button onClick={() => setActiveTab('experiments')} className="text-xs text-indigo-400 hover:underline flex items-center gap-1">
                  View All <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                {filteredExperiments.map((exp) => (
                  <div key={exp.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg">{exp.category}</span>
                      <span className="text-xs text-slate-400">★ {exp.rating}/5</span>
                    </div>
                    <h4 className="font-semibold text-white text-sm">{exp.name}</h4>
                    <p className="text-xs text-slate-400 line-clamp-2">{exp.notes}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'accounts' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-white">Encrypted Credentials</h3>
              <span className="text-xs text-slate-400">AES-256-GCM Protected</span>
            </div>
            <div className="divide-y divide-slate-800">
              {filteredAccounts.map((acc) => (
                <div key={acc.id} className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-indigo-600/10 text-indigo-400 rounded-xl flex items-center justify-center font-bold">
                      {acc.name[0]}
                    </div>
                    <div>
                      <h4 className="font-semibold text-white text-sm">{acc.name}</h4>
                      <p className="text-xs text-slate-400">{acc.username}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs px-3 py-1 bg-slate-950 text-slate-400 rounded-lg border border-slate-800">{acc.category}</span>
                    <button onClick={() => handleCopy(acc.id, 'SuperSecretPass123!')} className="p-2 text-slate-400 hover:text-white bg-slate-950 rounded-lg border border-slate-800">
                      {copiedId === acc.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'experiments' && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredExperiments.map((exp) => (
                <div key={exp.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs px-3 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full">{exp.category}</span>
                    <span className="text-xs font-semibold text-amber-400">Rating: {exp.rating}/5</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg">{exp.name}</h3>
                    <p className="text-xs text-indigo-400 mt-0.5">Tool Tested: {exp.tool}</p>
                  </div>
                  <p className="text-sm text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800/80">{exp.notes}</p>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-400">
                    <span>Status: {exp.status}</span>
                    <button className="text-indigo-400 hover:underline flex items-center gap-1">
                      Journal Entries <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800">
              <h3 className="font-bold text-white">Identity & Soft Documents</h3>
              <p className="text-xs text-slate-400">Masked records with automatic expiry tracking warnings</p>
            </div>
            <div className="divide-y divide-slate-800">
              {filteredDocuments.map((doc) => (
                <div key={doc.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <FileText className="w-8 h-8 text-indigo-400" />
                    <div>
                      <h4 className="font-semibold text-white text-sm">{doc.title}</h4>
                      <p className="text-xs text-slate-400">{doc.category} • Expiry: {doc.expiry}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-3 py-1 rounded-full ${doc.status === 'Expiring Soon' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                      {doc.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div className="flex items-center gap-3">
              <Bot className="w-8 h-8 text-indigo-400" />
              <div>
                <h3 className="font-bold text-white">VaultAI Query Assistant</h3>
                <p className="text-xs text-slate-400">Query your vault metadata locally without revealing raw secrets</p>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <textarea
                placeholder="Ask VaultAI about your connected projects, tools, or expiring documents..."
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500 h-28 resize-none"
              ></textarea>
              <button
                onClick={runVaultSearch}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" /> Run Natural Language Search
              </button>
              {aiAnswer && (
                <div className="mt-3 whitespace-pre-line rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4 text-sm text-slate-200">
                  {aiAnswer}
                </div>
              )}
            </div>
          </div>
        )}

        {showAddItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-white">Add Vault Item</h3>
              <p className="mt-1 text-sm text-slate-400">Add a new entry to the current vault section.</p>
              <input
                autoFocus
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addVaultItem()}
                placeholder="Item name"
                className="mt-5 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-white focus:border-indigo-500 focus:outline-none"
              />
              <div className="mt-5 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowAddItem(false);
                    setNewItemName('');
                  }}
                  className="rounded-xl border border-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={addVaultItem}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                >
                  Add Item
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}