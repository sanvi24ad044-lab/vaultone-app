'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Shield, Key, Lock, Unlock, Search, Plus,
  FileText, Zap, Check, Copy, Bot,
  ArrowUpRight, LogOut, Trash2, AlertTriangle,
  Loader2, X, Eye, EyeOff, Globe, Mail, Sun, Moon
} from 'lucide-react';

// --- SUPABASE CLIENT ---
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
const supabase = supabaseUrl.startsWith('https://') && supabaseAnonKey
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
  siteUrl?: string;
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

const EMPTY_VAULT: VaultPayload = {
  accounts: [],
  experiments: [],
  documents: [],
};

export default function VaultOneApp() {
  // Dual Theme State: 'light' (Warm Cream & Champagne) | 'dark' (Deep Matte Charcoal & Warm Sand)
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const [stage, setStage] = useState<'auth' | 'pin_lock' | 'unlocked'>('auth');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');
  const [encryptedBlob, setEncryptedBlob] = useState<string>('');

  const [emailInput, setEmailInput] = useState('');
  const [accountPassInput, setAccountPassInput] = useState('');
  const [quickPinInput, setQuickPinInput] = useState('');
  const [activeQuickPin, setActiveQuickPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [lockReason, setLockReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'local'>('synced');

  const [vaultData, setVaultData] = useState<VaultPayload>(EMPTY_VAULT);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemType, setNewItemType] = useState<'account' | 'experiment' | 'document'>('account');
  const [formField1, setFormField1] = useState('');
  const [formField2, setFormField2] = useState('');
  const [formField3, setFormField3] = useState('');
  const [formField4, setFormField4] = useState('');
  const [formField5, setFormField5] = useState('');

  const [aiQuestion, setAiQuestion] = useState('');
  const [aiReply, setAiReply] = useState('');

  const awayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load saved theme preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('vaultone_theme');
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setTheme(savedTheme);
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('vaultone_theme', next);
  };

  const isLight = theme === 'light';

  // Reusable Theme Toggle Pill
  const ThemeSwitcher = () => (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full font-mono-code text-[10px] uppercase tracking-[0.18em] border transition-all cursor-pointer ${
        isLight
          ? 'bg-[#EFE8DB] border-[#1F1915]/15 text-[#1F1915] hover:bg-[#E5DCCB]'
          : 'bg-[#1B1917] border-[#E4D8C4]/15 text-[#E4D8C4] hover:bg-[#25221F]'
      }`}
      title="Switch between Warm Cream (Light) and Matte Charcoal (Dark)"
    >
      {isLight ? (
        <>
          <Moon className="w-3 h-3 text-[#8C6D38]" />
          <span>DARK // CHARCOAL</span>
        </>
      ) : (
        <>
          <Sun className="w-3 h-3 text-[#E4D8C4]" />
          <span>LIGHT // CREAM</span>
        </>
      )}
    </button>
  );

  // --- 5-SECOND TAB SWITCH / WINDOW BLUR AUTO-LOCK ---
  useEffect(() => {
    const startLockCountdown = () => {
      if (stage !== 'unlocked') return;
      if (awayTimerRef.current) clearTimeout(awayTimerRef.current);
      awayTimerRef.current = setTimeout(() => {
        setVaultData(EMPTY_VAULT);
        setVisiblePasswords({});
        setActiveQuickPin('');
        setQuickPinInput('');
        setLockReason('SESSION PAUSED // AUTO-LOCKED AFTER 5S AWAY');
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
      if (document.hidden) startLockCountdown();
      else cancelLockCountdown();
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

  // --- SIGN UP ---
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const email = emailInput.trim().toLowerCase();
    if (!email || accountPassInput.length < 4 || quickPinInput.length < 4) {
      setErrorMsg('Enter a valid email and passwords with at least 4 characters.');
      return;
    }
    if (accountPassInput === quickPinInput) {
      setErrorMsg('Keep your Quick Unlock PIN distinct from your Account Password.');
      return;
    }

    setIsLoading(true);
    try {
      const accountPassHash = await hashText(accountPassInput);
      const quickPinHash = await hashText(quickPinInput);
      const encryptedVault = await encryptData(EMPTY_VAULT, quickPinInput);

      if (supabase) {
        const { data: existing } = await supabase
          .from('vaults')
          .select('email')
          .eq('email', email)
          .maybeSingle();

        if (existing) {
          setErrorMsg('Account already exists. Please Sign In.');
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
      setVaultData(EMPTY_VAULT);
      setVisiblePasswords({});
      setAccountPassInput('');
      setQuickPinInput('');
      setStage('unlocked');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to initialize vault.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- SIGN IN ---
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
          setErrorMsg('No vault found for this email. Create an account first.');
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
          setErrorMsg('No vault found for this email. Create an account first.');
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
        setErrorMsg('Incorrect account password.');
        setIsLoading(false);
        return;
      }

      const users = JSON.parse(localStorage.getItem('vaultone_users') || '{}');
      users[email] = { accountPassHash, quickPinHash, encryptedVault };
      localStorage.setItem('vaultone_users', JSON.stringify(users));

      setVaultData(EMPTY_VAULT);
      setVisiblePasswords({});
      setEncryptedBlob(encryptedVault);
      setCurrentUserEmail(email);
      setAccountPassInput('');
      setQuickPinInput('');
      setLockReason('IDENTITY VERIFIED // ENTER PIN TO DECRYPT');
      setStage('pin_lock');
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to reach cloud vault.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- QUICK UNLOCK ---
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
      setVaultData({
        accounts: decrypted.accounts || [],
        experiments: decrypted.experiments || [],
        documents: decrypted.documents || [],
      });
      setVisiblePasswords({});
      setActiveQuickPin(quickPinInput);
      setQuickPinInput('');
      setLockReason('');
      setStage('unlocked');
    } catch {
      setErrorMsg('Invalid PIN. Decryption rejected.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- PERSIST ---
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

  const handleQuickLock = () => {
    setVaultData(EMPTY_VAULT);
    setVisiblePasswords({});
    setActiveQuickPin('');
    setQuickPinInput('');
    setLockReason('LOCKED MANUALLY // MEMORY WIPED');
    setStage('pin_lock');
  };

  const handleFullLogout = () => {
    setVaultData(EMPTY_VAULT);
    setVisiblePasswords({});
    setActiveQuickPin('');
    setEncryptedBlob('');
    setCurrentUserEmail('');
    setAccountPassInput('');
    setQuickPinInput('');
    setAiReply('');
    setErrorMsg('');
    setStage('auth');
  };

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
        name: formField1.trim(),
        category: formField2.trim() || 'PLATFORM',
        username: formField3.trim(),
        password: formField4,
        siteUrl: formField5.trim(),
      });
    } else if (newItemType === 'experiment') {
      updated.experiments.push({
        id,
        name: formField1.trim(),
        tool: formField2.trim() || 'NOTE',
        category: formField3.trim() || 'PERSONAL',
        status: 'ACTIVE',
        rating: 5,
        notes: formField4.trim() || 'Stored privately in VaultOne.',
      });
    } else if (newItemType === 'document') {
      updated.documents.push({
        id,
        title: formField1.trim(),
        category: formField2.trim() || 'ID',
        expiry: formField3.trim() || 'NO EXPIRY',
        status: 'VERIFIED',
      });
    }

    await persistVault(updated);
    setFormField1('');
    setFormField2('');
    setFormField3('');
    setFormField4('');
    setFormField5('');
    setShowAddModal(false);
  };

  const handleDeleteAccount = async (id: string) => {
    await persistVault({ ...vaultData, accounts: vaultData.accounts.filter(a => a.id !== id) });
  };

  const handleDeleteExperiment = async (id: string) => {
    await persistVault({ ...vaultData, experiments: vaultData.experiments.filter(e => e.id !== id) });
  };

  const handleDeleteDocument = async (id: string) => {
    await persistVault({ ...vaultData, documents: vaultData.documents.filter(d => d.id !== id) });
  };

  const handleCopy = (id: string, val: string) => {
    navigator.clipboard.writeText(val);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleRunAiSearch = () => {
    if (!aiQuestion.trim()) return;
    const q = aiQuestion.toLowerCase();
    if (q.includes('gmail') || q.includes('email') || q.includes('where') || q.includes('site') || q.includes('account') || q.includes('login') || q.includes('password')) {
      if (vaultData.accounts.length === 0) {
        setAiReply('ZERO LOGINS SAVED YET // TAP "+ NEW ENTRY" TO RECORD YOUR FIRST SITE.');
      } else {
        const list = vaultData.accounts
          .map(a => `${a.name.toUpperCase()} (${a.username}${a.siteUrl ? ` → ${a.siteUrl}` : ''})`)
          .join('  //  ');
        setAiReply(`ACTIVE FOOTPRINT [${vaultData.accounts.length}]: ${list}`);
      }
    } else if (q.includes('expir') || q.includes('document') || q.includes('id')) {
      const docs = vaultData.documents.map(d => `${d.title} [${d.expiry}]`).join(' // ');
      setAiReply(`STORED DOCS [${vaultData.documents.length}]: ${docs || 'NONE YET'}`);
    } else {
      setAiReply(`VAULT SUMMARY // ${vaultData.accounts.length} LOGINS • ${vaultData.documents.length} DOCS • ${vaultData.experiments.length} NOTES`);
    }
  };

  // =========================================================================
  // SCREEN 1: AUTHENTICATION (WARM CREAM IN LIGHT MODE / MATTE CHARCOAL IN DARK)
  // =========================================================================
  if (stage === 'auth') {
    return (
      <div
        className={`min-h-screen relative overflow-hidden flex flex-col justify-between p-6 md:p-10 transition-colors duration-300 ${
          isLight ? 'theme-cream-bg text-[#1F1915]' : 'theme-charcoal-bg text-[#F3EFE8]'
        }`}
      >
        {/* Behind-Print Architectural Watermark */}
        <div className="pointer-events-none select-none fixed inset-0 flex flex-col justify-between overflow-hidden z-0">
          <div
            className={`font-display font-extrabold text-[17vw] leading-[0.84] tracking-tighter whitespace-nowrap -ml-3 ${
              isLight ? 'text-[#1F1915]/[0.055]' : 'text-[#E4D8C4]/[0.045]'
            }`}
          >
            VAULT // 01
          </div>
          <div
            className={`font-display font-extrabold text-[15vw] leading-[0.84] tracking-tighter whitespace-nowrap self-end -mr-4 ${
              isLight ? 'text-[#B5945B]/[0.09]' : 'text-[#97A88E]/[0.04]'
            }`}
          >
            ZERO—KNOWLEDGE
          </div>
          <div
            className={`font-display font-extrabold text-[17vw] leading-[0.84] tracking-tighter whitespace-nowrap -ml-2 ${
              isLight ? 'text-[#1F1915]/[0.05]' : 'text-[#E4D8C4]/[0.04]'
            }`}
          >
            VAULT // 01
          </div>
        </div>

        {/* Top Bar with Theme Switcher */}
        <header
          className={`relative z-10 flex items-center justify-between pb-4 border-b ${
            isLight ? 'border-[#1F1915]/10' : 'border-[#E4D8C4]/10'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isLight ? 'bg-[#B5945B]' : 'bg-[#97A88E]'
              }`}
            />
            <span
              className={`font-mono-code text-[11px] uppercase tracking-[0.25em] ${
                isLight ? 'text-[#6E6256]' : 'text-[#9E9589]'
              }`}
            >
              VAULTONE // SYS.2026
            </span>
          </div>
          <ThemeSwitcher />
        </header>

        {/* Center Editorial Card */}
        <div className="relative z-10 w-full max-w-[430px] mx-auto my-auto py-8">
          <div
            className={`rounded-[32px] p-7 md:p-8 border backdrop-blur-2xl transition-all duration-300 space-y-6 ${
              isLight
                ? 'bg-[#FBF8F2]/90 border-[#B5945B]/30 shadow-[0_24px_70px_rgba(31,25,21,0.10)]'
                : 'bg-[#191816]/90 border-[#E4D8C4]/12 shadow-[0_24px_80px_rgba(0,0,0,0.75)]'
            }`}
          >
            {/* Emblem & Title */}
            <div className="text-center space-y-2">
              <div
                className={`w-13 h-13 rounded-2xl flex items-center justify-center mx-auto border ${
                  isLight
                    ? 'bg-gradient-to-br from-[#DFC99B] to-[#B5945B] border-[#9C7D46]/30 text-[#1F1915]'
                    : 'bg-[#23211E] border-[#E4D8C4]/15 text-[#E4D8C4]'
                }`}
              >
                <Shield className="w-6 h-6" />
              </div>
              <h1 className="font-display text-3xl font-extrabold tracking-tight">
                VaultOne
              </h1>
              <p className={`text-xs ${isLight ? 'text-[#73675B]' : 'text-[#9A9185]'}`}>
                Zero-Knowledge Cloud-Synced Personal Vault
              </p>
            </div>

            {/* Pill Toggle */}
            <div
              className={`grid grid-cols-2 p-1 rounded-full border ${
                isLight
                  ? 'bg-[#1F1915] border-[#1F1915]/10'
                  : 'bg-[#11100F] border-[#E4D8C4]/10'
              }`}
            >
              <button
                type="button"
                onClick={() => { setAuthMode('signup'); setErrorMsg(''); }}
                className={`py-2 text-[11px] font-mono-code font-semibold uppercase tracking-wider rounded-full transition-all cursor-pointer ${
                  authMode === 'signup'
                    ? isLight
                      ? 'bg-gradient-to-r from-[#DFC99B] to-[#C2A268] text-[#1F1915]'
                      : 'bg-[#97A88E] text-[#121110]'
                    : isLight
                      ? 'text-[#EFE8DB]/80 hover:text-white'
                      : 'text-[#9A9185] hover:text-[#F3EFE8]'
                }`}
              >
                01. New Vault
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setErrorMsg(''); }}
                className={`py-2 text-[11px] font-mono-code font-semibold uppercase tracking-wider rounded-full transition-all cursor-pointer ${
                  authMode === 'login'
                    ? isLight
                      ? 'bg-gradient-to-r from-[#DFC99B] to-[#C2A268] text-[#1F1915]'
                      : 'bg-[#97A88E] text-[#121110]'
                    : isLight
                      ? 'text-[#EFE8DB]/80 hover:text-white'
                      : 'text-[#9A9185] hover:text-[#F3EFE8]'
                }`}
              >
                02. Sign In
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs text-rose-500 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {errorMsg}
              </div>
            )}

            {authMode === 'signup' ? (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isLight ? 'text-[#4D4339]' : 'text-[#B8AFA3]'}`}>
                    Personal Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="you@gmail.com"
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    className={`w-full px-4 py-3 rounded-2xl text-sm border focus:outline-none transition-colors ${
                      isLight
                        ? 'bg-[#F3EDE2] border-[#1F1915]/15 text-[#1F1915] placeholder:text-[#9C8F80] focus:border-[#B5945B]'
                        : 'bg-[#121110] border-[#E4D8C4]/12 text-[#F3EFE8] placeholder:text-[#635C54] focus:border-[#E4D8C4]'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isLight ? 'text-[#4D4339]' : 'text-[#B8AFA3]'}`}>
                    Account Sign-In Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={accountPassInput}
                    onChange={e => setAccountPassInput(e.target.value)}
                    className={`w-full px-4 py-3 rounded-2xl text-sm border focus:outline-none transition-colors ${
                      isLight
                        ? 'bg-[#F3EDE2] border-[#1F1915]/15 text-[#1F1915] placeholder:text-[#9C8F80] focus:border-[#B5945B]'
                        : 'bg-[#121110] border-[#E4D8C4]/12 text-[#F3EFE8] placeholder:text-[#635C54] focus:border-[#E4D8C4]'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isLight ? 'text-[#8C6D38]' : 'text-[#97A88E]'}`}>
                    Master Decryption PIN
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Decrypts only your vault"
                    value={quickPinInput}
                    onChange={e => setQuickPinInput(e.target.value)}
                    className={`w-full px-4 py-3 rounded-2xl text-sm border focus:outline-none transition-colors ${
                      isLight
                        ? 'bg-[#F3EDE2] border-[#B5945B]/40 text-[#1F1915] placeholder:text-[#9C8F80] focus:border-[#B5945B]'
                        : 'bg-[#121110] border-[#97A88E]/30 text-[#F3EFE8] placeholder:text-[#635C54] focus:border-[#97A88E]'
                    }`}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full py-3.5 rounded-full font-display font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer mt-2 ${
                    isLight
                      ? 'bg-[#1F1915] hover:bg-[#332A24] text-[#FBF8F2]'
                      : 'bg-[#E4D8C4] hover:bg-[#EFE6D6] text-[#121110]'
                  }`}
                >
                  {isLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Initializing...</>
                  ) : (
                    <>Initialize Private Vault <ArrowUpRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isLight ? 'text-[#4D4339]' : 'text-[#B8AFA3]'}`}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="you@gmail.com"
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    className={`w-full px-4 py-3 rounded-2xl text-sm border focus:outline-none transition-colors ${
                      isLight
                        ? 'bg-[#F3EDE2] border-[#1F1915]/15 text-[#1F1915] placeholder:text-[#9C8F80] focus:border-[#B5945B]'
                        : 'bg-[#121110] border-[#E4D8C4]/12 text-[#F3EFE8] placeholder:text-[#635C54] focus:border-[#E4D8C4]'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isLight ? 'text-[#4D4339]' : 'text-[#B8AFA3]'}`}>
                    Account Sign-In Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={accountPassInput}
                    onChange={e => setAccountPassInput(e.target.value)}
                    className={`w-full px-4 py-3 rounded-2xl text-sm border focus:outline-none transition-colors ${
                      isLight
                        ? 'bg-[#F3EDE2] border-[#1F1915]/15 text-[#1F1915] placeholder:text-[#9C8F80] focus:border-[#B5945B]'
                        : 'bg-[#121110] border-[#E4D8C4]/12 text-[#F3EFE8] placeholder:text-[#635C54] focus:border-[#E4D8C4]'
                    }`}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full py-3.5 rounded-full font-display font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer mt-2 ${
                    isLight
                      ? 'bg-[#1F1915] hover:bg-[#332A24] text-[#FBF8F2]'
                      : 'bg-[#E4D8C4] hover:bg-[#EFE6D6] text-[#121110]'
                  }`}
                >
                  {isLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Fetching Vault...</>
                  ) : (
                    <>Continue to Vault Unlock <ArrowUpRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer
          className={`relative z-10 flex items-center justify-between pt-4 border-t font-mono-code text-[10px] uppercase tracking-[0.2em] ${
            isLight ? 'border-[#1F1915]/10 text-[#6E6256]' : 'border-[#E4D8C4]/10 text-[#8A8175]'
          }`}
        >
          <span>ZERO-KNOWLEDGE CLOUD-SYNCED PERSONAL VAULT</span>
          <span className="hidden sm:inline">5S AUTO-LOCK</span>
        </footer>
      </div>
    );
  }

  // =========================================================================
  // SCREEN 2: LAYER 2 QUICK UNLOCK
  // =========================================================================
  if (stage === 'pin_lock') {
    return (
      <div
        className={`min-h-screen relative overflow-hidden flex flex-col justify-between p-6 md:p-10 transition-colors duration-300 ${
          isLight ? 'theme-cream-bg text-[#1F1915]' : 'theme-charcoal-bg text-[#F3EFE8]'
        }`}
      >
        <div className="pointer-events-none select-none fixed inset-0 flex items-center justify-center z-0">
          <span
            className={`font-display font-extrabold text-[19vw] tracking-tighter ${
              isLight ? 'text-[#1F1915]/[0.05]' : 'text-[#E4D8C4]/[0.04]'
            }`}
          >
            VAULT // 01
          </span>
        </div>

        <header className="relative z-10 flex justify-end">
          <ThemeSwitcher />
        </header>

        <div
          className={`relative z-10 w-full max-w-[400px] mx-auto my-auto rounded-[32px] p-8 border backdrop-blur-2xl text-center space-y-6 ${
            isLight
              ? 'bg-[#FBF8F2]/90 border-[#B5945B]/30 shadow-[0_24px_70px_rgba(31,25,21,0.10)]'
              : 'bg-[#191816]/90 border-[#E4D8C4]/12 shadow-[0_24px_80px_rgba(0,0,0,0.75)]'
          }`}
        >
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto border ${
              isLight
                ? 'bg-[#EFE8DB] border-[#B5945B]/35 text-[#8C6D38]'
                : 'bg-[#23211E] border-[#97A88E]/30 text-[#97A88E]'
            }`}
          >
            <Lock className="w-6 h-6" />
          </div>

          <div className="space-y-1.5">
            <h1 className="font-display text-2xl font-extrabold tracking-tight">
              VAULT SEALED
            </h1>
            <p className={`font-mono-code text-xs ${isLight ? 'text-[#73675B]' : 'text-[#9A9185]'}`}>
              {currentUserEmail}
            </p>
            {lockReason && (
              <div
                className={`mt-3 px-3 py-2 rounded-2xl font-mono-code text-[10px] tracking-wider border ${
                  isLight
                    ? 'bg-[#EFE8DB] border-[#B5945B]/30 text-[#7A5E2E]'
                    : 'bg-[#23211E] border-[#97A88E]/25 text-[#97A88E]'
                }`}
              >
                {lockReason}
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs text-rose-500">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleQuickUnlock} className="space-y-4">
            <input
              type="password"
              required
              autoFocus
              placeholder="ENTER MASTER PIN"
              value={quickPinInput}
              onChange={(e) => setQuickPinInput(e.target.value)}
              className={`w-full px-4 py-3.5 rounded-2xl text-center font-mono-code text-sm tracking-[0.3em] border focus:outline-none ${
                isLight
                  ? 'bg-[#F3EDE2] border-[#1F1915]/15 text-[#1F1915] placeholder:text-[#9C8F80] focus:border-[#B5945B]'
                  : 'bg-[#121110] border-[#E4D8C4]/15 text-[#F3EFE8] placeholder:text-[#635C54] focus:border-[#E4D8C4]'
              }`}
            />
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3.5 rounded-full font-display font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                isLight
                  ? 'bg-[#1F1915] hover:bg-[#332A24] text-[#FBF8F2]'
                  : 'bg-[#E4D8C4] hover:bg-[#EFE6D6] text-[#121110]'
              }`}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
              Decrypt Vault
            </button>
          </form>

          <button
            onClick={handleFullLogout}
            className={`font-mono-code text-[11px] uppercase tracking-widest transition-colors ${
              isLight ? 'text-[#73675B] hover:text-[#1F1915]' : 'text-[#8A8175] hover:text-[#F3EFE8]'
            }`}
          >
            ← Switch Account
          </button>
        </div>

        <div />
      </div>
    );
  }

  // =========================================================================
  // SCREEN 3: UNLOCKED COMMAND CENTER (WARM CREAM OR MATTE CHARCOAL)
  // =========================================================================
  const filteredAccounts = vaultData.accounts.filter(a =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (a.siteUrl || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredExperiments = vaultData.experiments.filter(e =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.tool.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDocuments = vaultData.documents.filter(d =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const uniqueEmailsUsed = Array.from(new Set(vaultData.accounts.map(a => a.username).filter(Boolean)));

  return (
    <div
      className={`min-h-screen relative overflow-x-hidden flex flex-col lg:flex-row transition-colors duration-300 ${
        isLight ? 'theme-cream-bg text-[#1F1915]' : 'theme-charcoal-bg text-[#F3EFE8]'
      }`}
    >
      {/* Subtle Behind-Print Watermark */}
      <div className="pointer-events-none select-none fixed bottom-3 right-6 z-0 hidden xl:block">
        <span
          className={`font-display font-extrabold text-[11vw] leading-none tracking-tighter ${
            isLight ? 'text-[#1F1915]/[0.04]' : 'text-[#E4D8C4]/[0.035]'
          }`}
        >
          VAULT // 01
        </span>
      </div>

      {/* Minimalist Sidebar */}
      <aside
        className={`relative z-10 w-full lg:w-64 p-5 lg:p-6 flex flex-col justify-between border-b lg:border-b-0 lg:border-r backdrop-blur-xl transition-colors ${
          isLight
            ? 'bg-[#F3EDE2]/90 border-[#1F1915]/10'
            : 'bg-[#171614]/90 border-[#E4D8C4]/10'
        }`}
      >
        <div className="space-y-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 overflow-hidden">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-display font-extrabold text-xs shrink-0 border ${
                  isLight
                    ? 'bg-gradient-to-br from-[#DFC99B] to-[#B5945B] border-[#9C7D46]/30 text-[#1F1915]'
                    : 'bg-[#23211E] border-[#E4D8C4]/15 text-[#E4D8C4]'
                }`}
              >
                V1
              </div>
              <div className="overflow-hidden">
                <h2 className="font-display font-extrabold text-base tracking-tight leading-none">
                  VaultOne
                </h2>
                <span
                  className={`font-mono-code text-[10px] truncate block mt-1 max-w-[140px] ${
                    isLight ? 'text-[#8C6D38]' : 'text-[#97A88E]'
                  }`}
                >
                  {currentUserEmail}
                </span>
              </div>
            </div>
            <div className="lg:hidden">
              <ThemeSwitcher />
            </div>
          </div>

          <nav className="flex lg:flex-col gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            {[
              { id: 'dashboard', num: '01', label: 'Dashboard', icon: Shield },
              { id: 'accounts', num: '02', label: 'Accounts & Passwords', icon: Key },
              { id: 'documents', num: '03', label: 'Document & Identity', icon: FileText },
              { id: 'experiments', num: '04', label: 'Private Notes', icon: Zap },
              { id: 'ai', num: '05', label: 'VaultAI Assistant', icon: Bot },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-medium transition-all shrink-0 cursor-pointer ${
                    isActive
                      ? isLight
                        ? 'bg-[#E5DAC7] text-[#1F1915] font-semibold shadow-xs'
                        : 'bg-[#262420] text-[#F3EFE8] font-semibold border border-[#E4D8C4]/15'
                      : isLight
                        ? 'text-[#6E6256] hover:bg-[#1F1915]/[0.04] hover:text-[#1F1915]'
                        : 'text-[#8E8579] hover:bg-[#E4D8C4]/[0.04] hover:text-[#F3EFE8]'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </span>
                  <span
                    className={`font-mono-code text-[10px] hidden lg:inline ${
                      isActive
                        ? isLight ? 'text-[#8C6D38]' : 'text-[#97A88E]'
                        : 'opacity-45'
                    }`}
                  >
                    {tab.num}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        <div
          className={`hidden lg:flex flex-col gap-2.5 pt-6 border-t ${
            isLight ? 'border-[#1F1915]/10' : 'border-[#E4D8C4]/10'
          }`}
        >
          <div className="flex justify-center">
            <ThemeSwitcher />
          </div>
          <div
            className={`flex items-center justify-between px-3 py-2 rounded-xl font-mono-code text-[10px] border ${
              isLight
                ? 'bg-[#FBF8F2] border-[#1F1915]/10 text-[#6E6256]'
                : 'bg-[#121110] border-[#E4D8C4]/10 text-[#8E8579]'
            }`}
          >
            <span>AUTO-LOCK</span>
            <span className={isLight ? 'text-[#8C6D38] font-semibold' : 'text-[#97A88E] font-semibold'}>
              5.0 SEC
            </span>
          </div>
          <button
            onClick={handleQuickLock}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-mono-code uppercase tracking-wider transition-all cursor-pointer border ${
              isLight
                ? 'bg-[#FBF8F2] hover:bg-[#EAE2D3] border-[#1F1915]/15 text-[#1F1915]'
                : 'bg-[#23211E] hover:bg-[#2E2B27] border-[#E4D8C4]/12 text-[#E4D8C4]'
            }`}
          >
            <Lock className="w-3.5 h-3.5" /> Lock Screen
          </button>
          <button
            onClick={handleFullLogout}
            className={`w-full flex items-center justify-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-mono-code uppercase tracking-wider transition-all cursor-pointer ${
              isLight ? 'text-[#73675B] hover:text-rose-600' : 'text-[#8E8579] hover:text-rose-400'
            }`}
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="relative z-10 flex-1 p-5 md:p-8 lg:p-10 space-y-8 max-w-6xl">
        {/* Top Bar */}
        <header
          className={`flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b ${
            isLight ? 'border-[#1F1915]/10' : 'border-[#E4D8C4]/10'
          }`}
        >
          <div>
            <div
              className={`flex items-center gap-2 font-mono-code text-[10px] uppercase tracking-[0.2em] ${
                isLight ? 'text-[#6E6256]' : 'text-[#8E8579]'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isLight ? 'bg-[#B5945B]' : 'bg-[#97A88E]'}`} />
              <span>ENCRYPTED LOCALLY WITH AES-256-GCM</span>
              <span>•</span>
              <span className={isLight ? 'text-[#8C6D38] font-semibold' : 'text-[#97A88E] font-semibold'}>
                {syncStatus === 'syncing' ? 'SYNCING...' : syncStatus === 'synced' ? 'SYNCED TO CLOUD' : 'SAVED LOCALLY'}
              </span>
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight uppercase mt-1">
              {activeTab === 'dashboard' ? 'COMMAND CENTER' : activeTab}
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative flex-1 md:w-56">
              <Search
                className={`w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                  isLight ? 'text-[#8C7E70]' : 'text-[#756D63]'
                }`}
              />
              <input
                type="text"
                placeholder="Search site, Gmail..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-9 pr-4 py-2.5 rounded-full text-xs border focus:outline-none ${
                  isLight
                    ? 'bg-[#FBF8F2] border-[#1F1915]/15 text-[#1F1915] placeholder:text-[#9C8F80] focus:border-[#B5945B]'
                    : 'bg-[#191816] border-[#E4D8C4]/12 text-[#F3EFE8] placeholder:text-[#6B6359] focus:border-[#E4D8C4]'
                }`}
              />
            </div>
            <button
              onClick={() => { setNewItemType('account'); setShowAddModal(true); }}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-display font-bold uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
                isLight
                  ? 'bg-[#1F1915] hover:bg-[#332A24] text-[#FBF8F2]'
                  : 'bg-[#E4D8C4] hover:bg-[#EFE6D6] text-[#121110]'
              }`}
            >
              <Plus className="w-4 h-4" /> New Entry
            </button>
          </div>
        </header>

        {/* OVERVIEW / DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* 4 Bento Metric Tiles */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              {[
                { code: '/01', label: 'SITES SAVED', val: vaultData.accounts.length, icon: Key },
                { code: '/02', label: 'GMAIL / IDS', val: uniqueEmailsUsed.length, icon: Mail },
                { code: '/03', label: 'ID DOCS', val: vaultData.documents.length, icon: FileText },
                { code: '/04', label: 'NOTES', val: vaultData.experiments.length, icon: Zap },
              ].map((m, idx) => {
                const Icon = m.icon;
                return (
                  <div
                    key={idx}
                    className={`p-5 rounded-3xl border flex flex-col justify-between h-32 transition-all ${
                      isLight
                        ? 'bg-[#EFE8DB]/85 border-[#1F1915]/10 hover:border-[#B5945B]/50'
                        : 'bg-[#1B1917]/90 border-[#E4D8C4]/10 hover:border-[#E4D8C4]/30'
                    }`}
                  >
                    <div
                      className={`flex items-center justify-between font-mono-code text-[10px] tracking-[0.18em] ${
                        isLight ? 'text-[#6E6256]' : 'text-[#9A9185]'
                      }`}
                    >
                      <span>{m.label}</span>
                      <span>{m.code}</span>
                    </div>
                    <div className="flex items-end justify-between">
                      <p
                        className={`font-display text-3xl md:text-4xl font-extrabold ${
                          isLight ? 'text-[#B5945B]' : 'text-[#E4D8C4]'
                        }`}
                      >
                        {m.val}
                      </p>
                      <Icon className={`w-5 h-5 ${isLight ? 'text-[#1F1915]/65' : 'text-[#E4D8C4]/55'}`} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Where You Have Signed In */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl font-bold tracking-tight">
                  Where You Have Signed In
                </h3>
                <button
                  onClick={() => setActiveTab('accounts')}
                  className={`font-mono-code text-[11px] uppercase tracking-wider flex items-center gap-1 cursor-pointer ${
                    isLight ? 'text-[#8C6D38] hover:text-[#1F1915]' : 'text-[#97A88E] hover:text-[#F3EFE8]'
                  }`}
                >
                  VIEW ALL <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {vaultData.accounts.length === 0 ? (
                <div
                  className={`border border-dashed rounded-3xl p-10 text-center space-y-3 ${
                    isLight
                      ? 'bg-[#FBF8F2]/70 border-[#1F1915]/15'
                      : 'bg-[#191816]/70 border-[#E4D8C4]/15'
                  }`}
                >
                  <p className="font-display text-base font-bold">
                    Your private vault is empty.
                  </p>
                  <p className={`text-xs max-w-md mx-auto ${isLight ? 'text-[#73675B]' : 'text-[#8E8579]'}`}>
                    Tap <strong>New Entry</strong> to save any website, app, Gmail ID, and password. Everything stays encrypted and isolated to {currentUserEmail}.
                  </p>
                  <button
                    onClick={() => { setNewItemType('account'); setShowAddModal(true); }}
                    className={`inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-display font-bold uppercase tracking-wider mt-2 cursor-pointer ${
                      isLight
                        ? 'bg-[#1F1915] text-[#FBF8F2]'
                        : 'bg-[#E4D8C4] text-[#121110]'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" /> Add First Login
                  </button>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {vaultData.accounts.map((acc) => (
                    <div
                      key={acc.id}
                      className={`p-5 rounded-3xl border space-y-3 transition-all ${
                        isLight
                          ? 'bg-[#231D18] border-[#1F1915] text-[#F6F2EA] shadow-sm'
                          : 'bg-[#1B1917] border-[#E4D8C4]/15 text-[#F3EFE8]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-display font-bold text-base">{acc.name}</span>
                        <span
                          className={`font-mono-code text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                            isLight
                              ? 'bg-[#DFC99B]/20 text-[#DFC99B]'
                              : 'bg-[#97A88E]/15 text-[#97A88E]'
                          }`}
                        >
                          {acc.category}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs opacity-85 flex items-center gap-2">
                          <Mail className={`w-3.5 h-3.5 ${isLight ? 'text-[#DFC99B]' : 'text-[#97A88E]'}`} />
                          <span className="font-mono-code text-xs truncate">{acc.username}</span>
                        </p>
                        {acc.siteUrl && (
                          <p className="text-[11px] opacity-55 flex items-center gap-2 truncate">
                            <Globe className="w-3.5 h-3.5 shrink-0" />
                            <span>{acc.siteUrl}</span>
                          </p>
                        )}
                      </div>

                      <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                        <span className="font-mono-code text-xs tracking-wider">
                          {visiblePasswords[acc.id] ? acc.password : '••••••••••••'}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => togglePasswordVisibility(acc.id)}
                            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
                            title={visiblePasswords[acc.id] ? 'Hide Password' : 'Reveal Password'}
                          >
                            {visiblePasswords[acc.id] ? (
                              <EyeOff className={`w-3.5 h-3.5 ${isLight ? 'text-[#DFC99B]' : 'text-[#97A88E]'}`} />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => handleCopy(acc.id, acc.password)}
                            className={`px-3 py-1 rounded-full font-mono-code text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                              isLight
                                ? 'bg-[#DFC99B] text-[#1F1915] hover:bg-[#ead8b3]'
                                : 'bg-[#E4D8C4] text-[#121110] hover:bg-white'
                            }`}
                          >
                            {copiedId === acc.id ? 'COPIED' : 'COPY'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ACCOUNTS & PASSWORDS TAB */}
        {activeTab === 'accounts' && (
          <div
            className={`rounded-3xl border overflow-hidden ${
              isLight
                ? 'bg-[#FBF8F2]/90 border-[#1F1915]/10'
                : 'bg-[#191816]/90 border-[#E4D8C4]/10'
            }`}
          >
            <div
              className={`p-6 border-b flex items-center justify-between ${
                isLight ? 'border-[#1F1915]/10' : 'border-[#E4D8C4]/10'
              }`}
            >
              <div>
                <h3 className="font-display font-bold text-lg">Saved Logins & Passwords</h3>
                <p className={`text-xs mt-0.5 ${isLight ? 'text-[#73675B]' : 'text-[#8E8579]'}`}>
                  Tap the eye icon to reveal any password you saved
                </p>
              </div>
              <button
                onClick={() => { setNewItemType('account'); setShowAddModal(true); }}
                className={`px-4 py-2 rounded-full text-xs font-display font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer ${
                  isLight ? 'bg-[#1F1915] text-[#FBF8F2]' : 'bg-[#E4D8C4] text-[#121110]'
                }`}
              >
                <Plus className="w-3.5 h-3.5" /> Add Login
              </button>
            </div>
            <div className={`divide-y ${isLight ? 'divide-[#1F1915]/10' : 'divide-[#E4D8C4]/10'}`}>
              {filteredAccounts.length === 0 ? (
                <p className={`p-8 text-xs font-mono-code ${isLight ? 'text-[#73675B]' : 'text-[#8E8579]'}`}>
                  NO LOGINS SAVED YET.
                </p>
              ) : (
                filteredAccounts.map((acc) => (
                  <div key={acc.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-display font-bold text-sm shrink-0 ${
                          isLight
                            ? 'bg-[#EFE8DB] text-[#8C6D38] border border-[#B5945B]/30'
                            : 'bg-[#23211E] text-[#E4D8C4] border border-[#E4D8C4]/15'
                        }`}
                      >
                        {acc.name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-display font-bold text-sm">{acc.name}</h4>
                          <span
                            className={`font-mono-code text-[10px] px-2.5 py-0.5 rounded-full ${
                              isLight ? 'bg-[#EFE8DB] text-[#6E6256]' : 'bg-[#23211E] text-[#9A9185]'
                            }`}
                          >
                            {acc.category}
                          </span>
                        </div>
                        <p className={`font-mono-code text-xs mt-0.5 ${isLight ? 'text-[#8C6D38]' : 'text-[#97A88E]'}`}>
                          {acc.username}
                        </p>
                        {acc.siteUrl && (
                          <p className={`font-mono-code text-[11px] ${isLight ? 'text-[#8C7E70]' : 'text-[#6B6359]'}`}>
                            {acc.siteUrl}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div
                        className={`px-3.5 py-2 rounded-full font-mono-code text-xs min-w-[140px] text-center border ${
                          isLight
                            ? 'bg-[#F3EDE2] border-[#1F1915]/12 text-[#1F1915]'
                            : 'bg-[#121110] border-[#E4D8C4]/12 text-[#F3EFE8]'
                        }`}
                      >
                        {visiblePasswords[acc.id] ? acc.password : '••••••••••••'}
                      </div>
                      <button
                        onClick={() => togglePasswordVisibility(acc.id)}
                        className={`p-2 rounded-full border cursor-pointer ${
                          isLight
                            ? 'bg-[#EFE8DB] border-[#1F1915]/10 text-[#1F1915]'
                            : 'bg-[#23211E] border-[#E4D8C4]/12 text-[#E4D8C4]'
                        }`}
                        title={visiblePasswords[acc.id] ? 'Hide' : 'Show'}
                      >
                        {visiblePasswords[acc.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleCopy(acc.id, acc.password)}
                        className={`p-2 rounded-full border cursor-pointer ${
                          isLight
                            ? 'bg-[#EFE8DB] border-[#1F1915]/10 text-[#1F1915]'
                            : 'bg-[#23211E] border-[#E4D8C4]/12 text-[#E4D8C4]'
                        }`}
                        title="Copy"
                      >
                        {copiedId === acc.id ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDeleteAccount(acc.id)}
                        className={`p-2 rounded-full border cursor-pointer hover:text-rose-500 ${
                          isLight
                            ? 'bg-[#EFE8DB] border-[#1F1915]/10 text-[#73675B]'
                            : 'bg-[#23211E] border-[#E4D8C4]/12 text-[#8E8579]'
                        }`}
                        title="Delete"
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

        {/* NOTES TAB */}
        {activeTab === 'experiments' && (
          <div className="grid md:grid-cols-2 gap-4">
            {filteredExperiments.length === 0 ? (
              <p className={`text-xs font-mono-code ${isLight ? 'text-[#73675B]' : 'text-[#8E8579]'}`}>
                NO PRIVATE NOTES YET.
              </p>
            ) : (
              filteredExperiments.map((exp) => (
                <div
                  key={exp.id}
                  className={`p-5 rounded-3xl border space-y-3 ${
                    isLight
                      ? 'bg-[#FBF8F2] border-[#1F1915]/10'
                      : 'bg-[#191816] border-[#E4D8C4]/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-mono-code text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full ${
                        isLight ? 'bg-[#EFE8DB] text-[#8C6D38]' : 'bg-[#23211E] text-[#97A88E]'
                      }`}
                    >
                      {exp.category}
                    </span>
                    <button
                      onClick={() => handleDeleteExperiment(exp.id)}
                      className="p-1.5 opacity-60 hover:text-rose-500 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <h4 className="font-display font-bold text-base">{exp.name}</h4>
                  <p className={`text-xs leading-relaxed ${isLight ? 'text-[#6E6256]' : 'text-[#9A9185]'}`}>
                    {exp.notes}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {/* DOCUMENTS TAB */}
        {activeTab === 'documents' && (
          <div
            className={`rounded-3xl border overflow-hidden ${
              isLight
                ? 'bg-[#FBF8F2]/90 border-[#1F1915]/10'
                : 'bg-[#191816]/90 border-[#E4D8C4]/10'
            }`}
          >
            <div
              className={`p-6 border-b flex items-center justify-between ${
                isLight ? 'border-[#1F1915]/10' : 'border-[#E4D8C4]/10'
              }`}
            >
              <h3 className="font-display font-bold text-lg">Identity & Personal Docs</h3>
              <span className="font-mono-code text-[10px] uppercase tracking-widest opacity-60">ENCRYPTED</span>
            </div>
            <div className={`divide-y ${isLight ? 'divide-[#1F1915]/10' : 'divide-[#E4D8C4]/10'}`}>
              {filteredDocuments.length === 0 ? (
                <p className={`p-8 text-xs font-mono-code ${isLight ? 'text-[#73675B]' : 'text-[#8E8579]'}`}>
                  NO DOCUMENTS STORED YET.
                </p>
              ) : (
                filteredDocuments.map((doc) => (
                  <div key={doc.id} className="p-5 flex items-center justify-between">
                    <div>
                      <h4 className="font-display font-bold text-sm">{doc.title}</h4>
                      <p className={`font-mono-code text-[11px] mt-0.5 ${isLight ? 'text-[#73675B]' : 'text-[#8E8579]'}`}>
                        {doc.category} • EXP: {doc.expiry}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`font-mono-code text-[10px] px-2.5 py-1 rounded-full ${
                          isLight ? 'bg-[#EFE8DB] text-[#8C6D38]' : 'bg-[#23211E] text-[#97A88E]'
                        }`}
                      >
                        {doc.status}
                      </span>
                      <button
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="p-2 rounded-full opacity-60 hover:text-rose-500 cursor-pointer"
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

        {/* VAULTAI ASSISTANT TAB */}
        {activeTab === 'ai' && (
          <div
            className={`rounded-3xl border p-6 space-y-4 max-w-2xl ${
              isLight
                ? 'bg-[#FBF8F2]/90 border-[#1F1915]/10'
                : 'bg-[#191816]/90 border-[#E4D8C4]/10'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border ${
                  isLight
                    ? 'bg-[#EFE8DB] border-[#B5945B]/30 text-[#8C6D38]'
                    : 'bg-[#23211E] border-[#97A88E]/30 text-[#97A88E]'
                }`}
              >
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold">Ask Vault // Local Query</h3>
                <p className={`font-mono-code text-[11px] ${isLight ? 'text-[#73675B]' : 'text-[#8E8579]'}`}>
                  Runs 100% locally in browser RAM
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ask: 'Where have I signed in?' or 'Which Gmail did I use?'"
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRunAiSearch()}
                className={`flex-1 px-4 py-3 rounded-full text-xs border focus:outline-none ${
                  isLight
                    ? 'bg-[#F3EDE2] border-[#1F1915]/15 text-[#1F1915] placeholder:text-[#9C8F80] focus:border-[#B5945B]'
                    : 'bg-[#121110] border-[#E4D8C4]/12 text-[#F3EFE8] placeholder:text-[#6B6359] focus:border-[#E4D8C4]'
                }`}
              />
              <button
                onClick={handleRunAiSearch}
                className={`px-5 py-3 rounded-full font-display font-bold text-xs uppercase tracking-wider cursor-pointer ${
                  isLight ? 'bg-[#1F1915] text-[#FBF8F2]' : 'bg-[#E4D8C4] text-[#121110]'
                }`}
              >
                Run
              </button>
            </div>
            {aiReply && (
              <div
                className={`p-4 rounded-2xl font-mono-code text-xs leading-relaxed border ${
                  isLight
                    ? 'bg-[#EFE8DB] border-[#B5945B]/30 text-[#1F1915]'
                    : 'bg-[#121110] border-[#97A88E]/30 text-[#97A88E]'
                }`}
              >
                {aiReply}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ADD ENTRY MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div
            className={`w-full max-w-md rounded-3xl p-6 space-y-5 border shadow-2xl ${
              isLight
                ? 'bg-[#FBF8F2] border-[#B5945B]/30 text-[#1F1915]'
                : 'bg-[#191816] border-[#E4D8C4]/15 text-[#F3EFE8]'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-extrabold text-lg">NEW VAULT ENTRY</h3>
              <button onClick={() => setShowAddModal(false)} className="opacity-60 hover:opacity-100 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div
              className={`grid grid-cols-3 p-1 rounded-full font-mono-code text-[11px] border ${
                isLight ? 'bg-[#EFE8DB] border-[#1F1915]/10' : 'bg-[#121110] border-[#E4D8C4]/10'
              }`}
            >
              {(['account', 'document', 'experiment'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setNewItemType(t)}
                  className={`py-2 rounded-full uppercase cursor-pointer ${
                    newItemType === t
                      ? isLight
                        ? 'bg-[#1F1915] text-[#FBF8F2] font-bold'
                        : 'bg-[#E4D8C4] text-[#121110] font-bold'
                      : 'opacity-65'
                  }`}
                >
                  {t === 'account' ? 'Login' : t === 'document' ? 'ID Doc' : 'Note'}
                </button>
              ))}
            </div>

            <form onSubmit={handleAddItem} className="space-y-3">
              <input
                type="text"
                required
                placeholder={newItemType === 'account' ? 'Platform / Website (e.g. Instagram, GitHub)' : newItemType === 'document' ? 'Document Name' : 'Note Title'}
                value={formField1}
                onChange={(e) => setFormField1(e.target.value)}
                className={`w-full px-4 py-3 rounded-2xl text-xs border focus:outline-none ${
                  isLight
                    ? 'bg-[#F3EDE2] border-[#1F1915]/15 text-[#1F1915] placeholder:text-[#9C8F80]'
                    : 'bg-[#121110] border-[#E4D8C4]/12 text-[#F3EFE8] placeholder:text-[#6B6359]'
                }`}
              />
              <input
                type="text"
                placeholder={newItemType === 'account' ? 'Tag (e.g. Social, College, Finance)' : newItemType === 'document' ? 'Category' : 'Tag'}
                value={formField2}
                onChange={(e) => setFormField2(e.target.value)}
                className={`w-full px-4 py-3 rounded-2xl text-xs border focus:outline-none ${
                  isLight
                    ? 'bg-[#F3EDE2] border-[#1F1915]/15 text-[#1F1915] placeholder:text-[#9C8F80]'
                    : 'bg-[#121110] border-[#E4D8C4]/12 text-[#F3EFE8] placeholder:text-[#6B6359]'
                }`}
              />
              <input
                type="text"
                required={newItemType === 'account'}
                placeholder={newItemType === 'account' ? 'Gmail / Username used' : newItemType === 'document' ? 'Expiry Date' : 'Topic'}
                value={formField3}
                onChange={(e) => setFormField3(e.target.value)}
                className={`w-full px-4 py-3 rounded-2xl text-xs border focus:outline-none ${
                  isLight
                    ? 'bg-[#F3EDE2] border-[#1F1915]/15 text-[#1F1915] placeholder:text-[#9C8F80]'
                    : 'bg-[#121110] border-[#E4D8C4]/12 text-[#F3EFE8] placeholder:text-[#6B6359]'
                }`}
              />
              {newItemType !== 'document' && (
                <input
                  type="text"
                  required={newItemType === 'account'}
                  placeholder={newItemType === 'account' ? 'Password set for this site' : 'Details'}
                  value={formField4}
                  onChange={(e) => setFormField4(e.target.value)}
                  className={`w-full px-4 py-3 rounded-2xl text-xs border focus:outline-none ${
                    isLight
                      ? 'bg-[#F3EDE2] border-[#1F1915]/15 text-[#1F1915] placeholder:text-[#9C8F80]'
                      : 'bg-[#121110] border-[#E4D8C4]/12 text-[#F3EFE8] placeholder:text-[#6B6359]'
                  }`}
                />
              )}
              {newItemType === 'account' && (
                <input
                  type="text"
                  placeholder="Website URL (optional)"
                  value={formField5}
                  onChange={(e) => setFormField5(e.target.value)}
                  className={`w-full px-4 py-3 rounded-2xl text-xs border focus:outline-none ${
                    isLight
                      ? 'bg-[#F3EDE2] border-[#1F1915]/15 text-[#1F1915] placeholder:text-[#9C8F80]'
                      : 'bg-[#121110] border-[#E4D8C4]/12 text-[#F3EFE8] placeholder:text-[#6B6359]'
                  }`}
                />
              )}
              <button
                type="submit"
                className={`w-full py-3.5 rounded-full font-display font-bold text-xs uppercase tracking-wider transition-all cursor-pointer mt-1 ${
                  isLight ? 'bg-[#1F1915] text-[#FBF8F2]' : 'bg-[#E4D8C4] text-[#121110]'
                }`}
              >
                Encrypt & Save
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}