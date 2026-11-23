'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Shield, Key, Lock, Unlock, Search, Plus,
  FileText, FolderGit2, Zap, Check, Copy, Bot,
  ArrowRight, LogOut, UserPlus, LogIn, Trash2, Clock, ShieldCheck, AlertTriangle,
  Cloud, Loader2, X
} from 'lucide-react';

// --- SUPABASE CLIENT ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// --- CRYPTO HELPERS (Real AES-256-GCM Browser Encryption) ---
async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>) {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptData(data: any, password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(JSON.stringify(data))
  );
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decryptData(base64Str: string, password: string): Promise<any> {
  const binary = atob(base64Str);
  const combined = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) combined[i] = binary.charCodeAt(i);
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const ciphertext = combined.slice(28);
  const key = await deriveKey(password, salt);
  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  return JSON.parse(new TextDecoder().decode(decrypted));
}

async function hashText(text: string): Promise<string> {
  const buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- TYPES ---
interface AccountItem {
  id: string;
  name: string;
  category: string;
  username: string;
  password: string;
}

interface ExperimentItem {
  id: string;
  name: string;
  tool: string;
  category: string;
  status: string;
  rating: number;
  notes: string;
}

interface DocumentItem {
  id: string;
  title: string;
  category: string;
  expiry: string;
  status: string;
}

interface VaultPayload {
  accounts: AccountItem[];
  experiments: ExperimentItem[];
  documents: DocumentItem[];
}

const DEFAULT_VAULT: VaultPayload = {
  accounts: [
    { id: '1', name: 'GitHub', category: 'Development', username: 'student_dev', password: 'ghp_SecretToken99!' },
    { id: '2', name: 'AWS Educate', category: 'Cloud', username: 'sanvi@college.edu', password: 'AwsCloud#2026' },
  ],
  experiments: [
    { id: '1', name: 'SoilSense AI Builder', tool: 'v0.dev', category: 'AI Builder', status: 'Completed', rating: 5, notes: 'Generated clean Tailwind UI components for college project.' },
    { id: '2', name: 'Local Vector Store', tool: 'ChromaDB', category: 'Database', status: 'Experimenting', rating: 4, notes: 'Testing fast vector indexing locally.' },
  ],
  documents: [
    { id: '1', title: 'College Student ID', category: 'Education', expiry: '2026-12-30', status: 'Expiring Soon' },
    { id: '2', title: 'Passport Copy', category: 'Identity', expiry: '2030-05-14', status: 'Valid' },
  ],
};

export default function VaultOneApp() {
  // Auth & Lock States
  const [stage, setStage] = useState<'auth' | 'pin_lock' | 'unlocked'>('auth');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');
  const [encryptedBlob, setEncryptedBlob] = useState<string>('');

  // Form inputs for Layer 1 & Layer 2
  const [emailInput, setEmailInput] = useState('');
  const [accountPassInput, setAccountPassInput] = useState('');
  const [quickPinInput, setQuickPinInput] = useState('');
  const [activeQuickPin, setActiveQuickPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [lockReason, setLockReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'local'>('synced');

  // Vault Data (Held in RAM only while unlocked)
  const [vaultData, setVaultData] = useState<VaultPayload>(DEFAULT_VAULT);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal State for Adding Items
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemType, setNewItemType] = useState<'account' | 'experiment' | 'document'>('account');
  const [formField1, setFormField1] = useState('');
  const [formField2, setFormField2] = useState('');
  const [formField3, setFormField3] = useState('');
  const [formField4, setFormField4] = useState('');

  // AI Query State
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiReply, setAiReply] = useState('');

  // Timer ref for 5-second tab switch auto-lock
  const awayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // --- 5-SECOND TAB SWITCH / WINDOW BLUR AUTO-LOCK ---
  useEffect(() => {
    const startLockCountdown = () => {
      if (stage !== 'unlocked') return;
      if (awayTimerRef.current) clearTimeout(awayTimerRef.current);
      awayTimerRef.current = setTimeout(() => {
        setVaultData({ accounts: [], experiments: [], documents: [] });
        setActiveQuickPin('');
        setQuickPinInput('');
        setLockReason('Auto-locked after 5 seconds away from tab for your privacy.');
        setStage('pin_lock');
      }, 5000);
    };

    const cancelLockCountdown = () => {
      if (awayTimerRef.current) {
        clearTimeout(awayTimerRef.current);
        awayTimerRef.current = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        startLockCountdown();
      } else {
        cancelLockCountdown();
      }
    };

    const handleWindowBlur = () => startLockCountdown();
    const handleWindowFocus = () => cancelLockCountdown();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      cancelLockCountdown();
    };
  }, [stage]);

  // --- LAYER 1: SIGN UP (Creates Account in Supabase + Local Cache) ---
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const email = emailInput.trim().toLowerCase();
    if (!email || accountPassInput.length < 4 || quickPinInput.length < 4) {
      setErrorMsg('Please enter an email and make both passwords at least 4 characters.');
      return;
    }
    if (accountPassInput === quickPinInput) {
      setErrorMsg('For better security, make your Quick Unlock Password different from your Account Password.');
      return;
    }

    setIsLoading(true);
    try {
      const accountPassHash = await hashText(accountPassInput);
      const quickPinHash = await hashText(quickPinInput);
      const encryptedVault = await encryptData(DEFAULT_VAULT, quickPinInput);

      if (supabase) {
        const { data: existing } = await supabase
          .from('vaults')
          .select('email')
          .eq('email', email)
          .maybeSingle();

        if (existing) {
          setErrorMsg('An account with this email already exists. Please Sign In.');
          setIsLoading(false);
          return;
        }

        const { error } = await supabase.from('vaults').insert({
          email,
          salt: accountPassHash,
          quick_unlock_verifier: quickPinHash,
          encrypted_payload: encryptedVault,
        });

        if (error) throw new Error(error.message);
        setSyncStatus('synced');
      } else {
        setSyncStatus('local');
      }

      const users = JSON.parse(localStorage.getItem('vaultone_users') || '{}');
      users[email] = { accountPassHash, quickPinHash, encryptedVault };
      localStorage.setItem('vaultone_users', JSON.stringify(users));

      setEncryptedBlob(encryptedVault);
      setCurrentUserEmail(email);
      setActiveQuickPin(quickPinInput);
      setVaultData(DEFAULT_VAULT);
      setAccountPassInput('');
      setQuickPinInput('');
      setStage('unlocked');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create cloud vault.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- LAYER 1: SIGN IN (Fetches Encrypted Vault from Supabase) ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const email = emailInput.trim().toLowerCase();
    setIsLoading(true);

    try {
      let accountPassHash = '';
      let quickPinHash = '';
      let encryptedVault = '';

      if (supabase) {
        const { data, error } = await supabase
          .from('vaults')
          .select('*')
          .eq('email', email)
          .maybeSingle();

        if (error) throw new Error(error.message);
        if (!data) {
          setErrorMsg('No account found with that email. Please Create Account first.');
          setIsLoading(false);
          return;
        }

        accountPassHash = data.salt;
        quickPinHash = data.quick_unlock_verifier;
        encryptedVault = data.encrypted_payload;
        setSyncStatus('synced');
      } else {
        const users = JSON.parse(localStorage.getItem('vaultone_users') || '{}');
        const userRecord = users[email];
        if (!userRecord) {
          setErrorMsg('No account found with that email. Please Sign Up first.');
          setIsLoading(false);
          return;
        }
        accountPassHash = userRecord.accountPassHash;
        quickPinHash = userRecord.quickPinHash;
        encryptedVault = userRecord.encryptedVault;
        setSyncStatus('local');
      }

      const enteredHash = await hashText(accountPassInput);
      if (enteredHash !== accountPassHash) {
        setErrorMsg('Incorrect Account Password.');
        setIsLoading(false);
        return;
      }

      const users = JSON.parse(localStorage.getItem('vaultone_users') || '{}');
      users[email] = { accountPassHash, quickPinHash, encryptedVault };
      localStorage.setItem('vaultone_users', JSON.stringify(users));

      setEncryptedBlob(encryptedVault);
      setCurrentUserEmail(email);
      setAccountPassInput('');
      setQuickPinInput('');
      setLockReason('Account verified! Enter your Quick Unlock Password to decrypt your vault.');
      setStage('pin_lock');
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to reach cloud vault.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- LAYER 2: QUICK UNLOCK (Decrypts Vault Locally in RAM) ---
  const handleQuickUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    try {
      let blobToDecrypt = encryptedBlob;

      if (supabase && currentUserEmail) {
        const { data } = await supabase
          .from('vaults')
          .select('encrypted_payload')
          .eq('email', currentUserEmail)
          .maybeSingle();
        if (data?.encrypted_payload) {
          blobToDecrypt = data.encrypted_payload;
          setEncryptedBlob(blobToDecrypt);
        }
      }

      if (!blobToDecrypt) {
        const users = JSON.parse(localStorage.getItem('vaultone_users') || '{}');
        blobToDecrypt = users[currentUserEmail]?.encryptedVault || '';
      }

      if (!blobToDecrypt) {
        setStage('auth');
        setIsLoading(false);
        return;
      }

      const decrypted = await decryptData(blobToDecrypt, quickPinInput);
      setVaultData(decrypted);
      setActiveQuickPin(quickPinInput);
      setQuickPinInput('');
      setLockReason('');
      setStage('unlocked');
    } catch {
      setErrorMsg('Wrong Quick Unlock Password. Unable to decrypt vault.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- SAVE ENCRYPTED VAULT TO SUPABASE + LOCALSTORAGE ---
  const persistVault = async (updated: VaultPayload) => {
    setVaultData(updated);
    if (!currentUserEmail || !activeQuickPin) return;

    setSyncStatus('syncing');
    const newEncryptedPayload = await encryptData(updated, activeQuickPin);
    setEncryptedBlob(newEncryptedPayload);

    const users = JSON.parse(localStorage.getItem('vaultone_users') || '{}');
    if (users[currentUserEmail]) {
      users[currentUserEmail].encryptedVault = newEncryptedPayload;
      localStorage.setItem('vaultone_users', JSON.stringify(users));
    }

    if (supabase) {
      const { error } = await supabase
        .from('vaults')
        .update({
          encrypted_payload: newEncryptedPayload,
          updated_at: new Date().toISOString(),
        })
        .eq('email', currentUserEmail);

      setSyncStatus(error ? 'local' : 'synced');
    } else {
      setSyncStatus('local');
    }
  };

  // --- MANUAL LOCK & FULL LOGOUT ---
  const handleQuickLock = () => {
    setVaultData({ accounts: [], experiments: [], documents: [] });
    setActiveQuickPin('');
    setQuickPinInput('');
    setLockReason('Vault locked manually.');
    setStage('pin_lock');
  };

  const handleFullLogout = () => {
    setVaultData({ accounts: [], experiments: [], documents: [] });
    setActiveQuickPin('');
    setEncryptedBlob('');
    setCurrentUserEmail('');
    setAccountPassInput('');
    setQuickPinInput('');
    setErrorMsg('');
    setStage('auth');
  };

  // --- ADD / DELETE VAULT ITEMS ---
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formField1.trim()) return;

    const id = Date.now().toString();
    const updated: VaultPayload = {
      accounts: [...vaultData.accounts],
      experiments: [...vaultData.experiments],
      documents: [...vaultData.documents],
    };

    if (newItemType === 'account') {
      updated.accounts.push({
        id,
        name: formField1,
        category: formField2 || 'General',
        username: formField3 || 'user',
        password: formField4 || '********',
      });
    } else if (newItemType === 'experiment') {
      updated.experiments.push({
        id,
        name: formField1,
        tool: formField2 || 'Custom Tool',
        category: formField3 || 'Experiment',
        status: 'Active',
        rating: 5,
        notes: formField4 || 'Logged in VaultOne Lab.',
      });
    } else if (newItemType === 'document') {
      updated.documents.push({
        id,
        title: formField1,
        category: formField2 || 'Personal',
        expiry: formField3 || '2027-12-31',
        status: 'Valid',
      });
    }

    await persistVault(updated);
    setFormField1('');
    setFormField2('');
    setFormField3('');
    setFormField4('');
    setShowAddModal(false);
  };

  const handleDeleteAccount = async (id: string) => {
    const updated = { ...vaultData, accounts: vaultData.accounts.filter(a => a.id !== id) };
    await persistVault(updated);
  };

  const handleDeleteExperiment = async (id: string) => {
    const updated = { ...vaultData, experiments: vaultData.experiments.filter(e => e.id !== id) };
    await persistVault(updated);
  };

  const handleDeleteDocument = async (id: string) => {
    const updated = { ...vaultData, documents: vaultData.documents.filter(d => d.id !== id) };
    await persistVault(updated);
  };

  const handleCopy = (id: string, val: string) => {
    navigator.clipboard.writeText(val);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRunAiSearch = () => {
    if (!aiQuestion.trim()) return;
    const q = aiQuestion.toLowerCase();
    if (q.includes('expir') || q.includes('document') || q.includes('id')) {
      const docs = vaultData.documents.map(d => `${d.title} (Expires: ${d.expiry})`).join(', ');
      setAiReply(`You have ${vaultData.documents.length} saved documents: ${docs || 'None yet'}.`);
    } else if (q.includes('account') || q.includes('password') || q.includes('login')) {
      const accs = vaultData.accounts.map(a => `${a.name} (${a.username})`).join(', ');
      setAiReply(`You have ${vaultData.accounts.length} encrypted accounts stored: ${accs || 'None yet'}. (Raw passwords remain masked for safety).`);
    } else {
      setAiReply(`Vault Summary for ${currentUserEmail}: ${vaultData.accounts.length} Accounts, ${vaultData.experiments.length} Lab Experiments, and ${vaultData.documents.length} Documents encrypted with AES-256-GCM.`);
    }
  };

  // =========================================================================
  // SCREEN 1: LAYER 1 AUTHENTICATION (ACCOUNT SIGN UP / SIGN IN)
  // =========================================================================
  if (stage === 'auth') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-indigo-600/30">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">VaultOne</h1>
            <p className="text-xs text-slate-400">Zero-Knowledge Cloud-Synced Personal Vault</p>
          </div>

          <div className="grid grid-cols-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => { setAuthMode('signup'); setErrorMsg(''); }}
              className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${authMode === 'signup' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <UserPlus className="w-3.5 h-3.5" /> Create Account
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('login'); setErrorMsg(''); }}
              className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${authMode === 'login' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <LogIn className="w-3.5 h-3.5" /> Sign In
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {errorMsg}
            </div>
          )}

          {authMode === 'signup' ? (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">1. Account Sign-In Password</label>
                <input
                  type="password"
                  required
                  placeholder="Used when logging into your account"
                  value={accountPassInput}
                  onChange={e => setAccountPassInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-indigo-400 font-medium mb-1">2. Quick Vault Unlock Password / PIN</label>
                <input
                  type="password"
                  required
                  placeholder="Used to decrypt & unlock after 5s tab switch"
                  value={quickPinInput}
                  onChange={e => setQuickPinInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-indigo-500/40 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
              >
                {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating Cloud Vault...</> : 'Create Encrypted Vault'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Account Sign-In Password</label>
                <input
                  type="password"
                  required
                  placeholder="Enter your account password"
                  value={accountPassInput}
                  onChange={e => setAccountPassInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
              >
                {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Fetching Encrypted Vault...</> : 'Continue to Vault Unlock'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // SCREEN 2: LAYER 2 QUICK UNLOCK (AFTER LOGIN OR 5-SECOND TAB SWITCH)
  // =========================================================================
  if (stage === 'pin_lock') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 bg-amber-500/10 text-amber-400 rounded-full flex items-center justify-center mx-auto border border-amber-500/30">
            <Lock className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Vault Screen Locked</h1>
            <p className="text-xs text-slate-400 mt-1">{currentUserEmail}</p>
            {lockReason && (
              <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 mt-3">
                {lockReason}
              </p>
            )}
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleQuickUnlock} className="space-y-4">
            <input
              type="password"
              required
              autoFocus
              placeholder="Enter Quick Unlock Password"
              value={quickPinInput}
              onChange={(e) => setQuickPinInput(e.target.value)}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-center text-base tracking-widest text-white focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 text-sm"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
              Decrypt & Open Vault
            </button>
          </form>

          <button
            onClick={handleFullLogout}
            className="text-xs text-slate-500 hover:text-slate-300 underline"
          >
            Sign out completely / Switch Account
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // SCREEN 3: UNLOCKED VAULT COMMAND CENTER
  // =========================================================================
  const filteredAccounts = vaultData.accounts.filter(a =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredExperiments = vaultData.experiments.filter(e =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.tool.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDocuments = vaultData.documents.filter(d =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-800 p-6 flex flex-col justify-between">
        <div className="space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div className="overflow-hidden">
              <h2 className="font-bold text-lg text-white leading-none">VaultOne</h2>
              <span className="text-xs text-emerald-400 font-medium truncate block mt-1">{currentUserEmail}</span>
            </div>
          </div>

          <nav className="space-y-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: Shield },
              { id: 'accounts', label: 'Accounts & Passwords', icon: Key },
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

        <div className="pt-6 border-t border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Auto-locks 5s after leaving tab</span>
          </div>
          <button
            onClick={handleQuickLock}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition-all"
          >
            <Lock className="w-3.5 h-3.5" /> Quick Lock Screen
          </button>
          <button
            onClick={handleFullLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl text-xs font-medium transition-all"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out Account
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-10 space-y-8 overflow-y-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <h1 className="text-2xl font-bold text-white capitalize">{activeTab}</h1>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> Encrypted locally with AES-256-GCM
              </p>
              <span className="text-slate-700">•</span>
              <p className="text-xs text-sky-400 flex items-center gap-1.5">
                <Cloud className="w-3.5 h-3.5" />
                {syncStatus === 'syncing' ? 'Syncing to Supabase...' : syncStatus === 'synced' ? 'Synced to Cloud' : 'Saved Locally'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search vault..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 w-56"
              />
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-indigo-600/20"
            >
              <Plus className="w-4 h-4" /> Add to Vault
            </button>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Saved Accounts', val: vaultData.accounts.length, icon: Key, color: 'text-indigo-400' },
                { label: 'Lab Experiments', val: vaultData.experiments.length, icon: Zap, color: 'text-amber-400' },
                { label: 'Identity Docs', val: vaultData.documents.length, icon: FolderGit2, color: 'text-blue-400' },
                { label: 'Encryption', val: 'AES-256', icon: Shield, color: 'text-emerald-400' },
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
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" /> Recent Lab Experiments
                </h3>
                <button onClick={() => setActiveTab('experiments')} className="text-xs text-indigo-400 hover:underline flex items-center gap-1">
                  View All <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                {vaultData.experiments.map((exp) => (
                  <div key={exp.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg">{exp.category}</span>
                      <span className="text-xs text-slate-400">Tool: {exp.tool}</span>
                    </div>
                    <h4 className="font-semibold text-white text-sm">{exp.name}</h4>
                    <p className="text-xs text-slate-400">{exp.notes}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'accounts' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-white">Encrypted Passwords & Logins</h3>
              <span className="text-xs text-slate-400">Synced as AES-256 ciphertext</span>
            </div>
            <div className="divide-y divide-slate-800">
              {filteredAccounts.length === 0 ? (
                <p className="p-6 text-sm text-slate-500">No matching accounts found.</p>
              ) : (
                filteredAccounts.map((acc) => (
                  <div key={acc.id} className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-indigo-600/10 text-indigo-400 rounded-xl flex items-center justify-center font-bold">
                        {acc.name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-semibold text-white text-sm">{acc.name}</h4>
                        <p className="text-xs text-slate-400">{acc.username}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-3 py-1 bg-slate-950 text-slate-400 rounded-lg border border-slate-800">{acc.category}</span>
                      <button
                        onClick={() => handleCopy(acc.id, acc.password)}
                        title="Copy Password"
                        className="p-2 text-slate-400 hover:text-white bg-slate-950 rounded-lg border border-slate-800"
                      >
                        {copiedId === acc.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDeleteAccount(acc.id)}
                        title="Delete"
                        className="p-2 text-slate-500 hover:text-rose-400 bg-slate-950 rounded-lg border border-slate-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'experiments' && (
          <div className="grid md:grid-cols-2 gap-4">
            {filteredExperiments.length === 0 ? (
              <p className="text-sm text-slate-500">No experiments logged yet.</p>
            ) : (
              filteredExperiments.map((exp) => (
                <div key={exp.id} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg">{exp.category}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">{exp.tool}</span>
                      <button
                        onClick={() => handleDeleteExperiment(exp.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <h4 className="font-bold text-white text-base">{exp.name}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{exp.notes}</p>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-white">Identity & Academic Documents</h3>
              <span className="text-xs text-slate-400">Expiry tracking</span>
            </div>
            <div className="divide-y divide-slate-800">
              {filteredDocuments.length === 0 ? (
                <p className="p-6 text-sm text-slate-500">No documents stored yet.</p>
              ) : (
                filteredDocuments.map((doc) => (
                  <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition-all">
                    <div>
                      <h4 className="font-semibold text-white text-sm">{doc.title}</h4>
                      <p className="text-xs text-slate-400">Category: {doc.category} • Expires: {doc.expiry}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg">
                        {doc.status}
                      </span>
                      <button
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="p-2 text-slate-500 hover:text-rose-400 bg-slate-950 rounded-lg border border-slate-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 max-w-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-xl">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white">Local VaultAI Query</h3>
                <p className="text-xs text-slate-400">Runs 100% locally in browser memory—zero raw data leaves your device</p>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ask e.g. 'Which documents are expiring?' or 'List my accounts'"
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRunAiSearch()}
                className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={handleRunAiSearch}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium"
              >
                Ask
              </button>
            </div>
            {aiReply && (
              <div className="p-4 bg-slate-950 border border-indigo-500/30 rounded-xl text-sm text-slate-200">
                {aiReply}
              </div>
            )}
          </div>
        )}
      </main>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-lg">Add Encrypted Item</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-medium">
              {(['account', 'experiment', 'document'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setNewItemType(t)}
                  className={`py-2 rounded-lg capitalize ${newItemType === t ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                >
                  {t}
                </button>
              ))}
            </div>

            <form onSubmit={handleAddItem} className="space-y-3">
              <input
                type="text"
                required
                placeholder={newItemType === 'account' ? 'Service Name (e.g. Gmail)' : newItemType === 'experiment' ? 'Experiment Name' : 'Document Title'}
                value={formField1}
                onChange={(e) => setFormField1(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              />
              <input
                type="text"
                placeholder={newItemType === 'account' ? 'Category (e.g. Social, Bank)' : newItemType === 'experiment' ? 'Tool Used (e.g. Next.js, Supabase)' : 'Category (e.g. Identity, Education)'}
                value={formField2}
                onChange={(e) => setFormField2(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              />
              <input
                type="text"
                placeholder={newItemType === 'account' ? 'Username / Email' : newItemType === 'experiment' ? 'Category' : 'Expiry Date (YYYY-MM-DD)'}
                value={formField3}
                onChange={(e) => setFormField3(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              />
              {newItemType !== 'document' && (
                <input
                  type={newItemType === 'account' ? 'password' : 'text'}
                  placeholder={newItemType === 'account' ? 'Password' : 'Notes'}
                  value={formField4}
                  onChange={(e) => setFormField4(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              )}
              <button
                type="submit"
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm transition-all"
              >
                Encrypt & Save to Cloud
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}