import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Twitter, 
  Send, 
  Copy, 
  Check, 
  Sparkles, 
  BrainCircuit,
  Wrench, 
  Wallet, 
  ListOrdered, 
  Lightbulb,
  Trash2,
  Loader2,
  ArrowRight,
  Zap,
  ShieldCheck,
  TrendingUp,
  Clock,
  History,
  Users,
  MessageCircle,
  Lock,
  Mail,
  User,
  Smartphone,
  Globe,
  Flame,
  Split,
  LogOut,
  Hash,
  Calendar,
  MousePointer2,
  LogIn,
  Bug,
  X
} from 'lucide-react';
import { 
  generateThread, 
  generateCoverImage, 
  fetchTrendingTopics, 
  fetchTrendingViaGemini,
  TrendingProduct,
  ThreadParams,
  ViralBooster
} from './services/gemini';
import { auth, db } from './lib/firebase';
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  deleteDoc,
  getDocFromServer,
  Timestamp
} from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Error Boundary Component
import React from 'react';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error) errorMessage = parsed.error;
      } catch (e) {
        errorMessage = this.state.error.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-[40px] max-w-md space-y-6">
            <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mx-auto">
              <ShieldCheck className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-black uppercase tracking-tighter">System Error</h1>
            <p className="text-gray-400 text-sm">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-red-500 text-white font-black uppercase tracking-widest rounded-2xl hover:scale-105 transition-all"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

type ViewState = 'landing' | 'code' | 'app';

export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

// App component
function App() {
  const [view, setView] = useState<ViewState>('landing');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMsg, setNotificationMsg] = useState('');
  
  const [params, setParams] = useState<ThreadParams>({
    topic: '',
    length: 'PENDEK',
    tone: 'SANTAI'
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [thread, setThread] = useState<string[]>([]);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [booster, setBooster] = useState<ViralBooster | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(900); // 15 minutes in seconds
  const [slotsLeft, setSlotsLeft] = useState(3);
  const [history, setHistory] = useState<{id: string, topic: string, length?: string, tone?: string, thread: string[], booster?: ViralBooster, timestamp: number}[]>([]);
  const [trendingTopics, setTrendingTopics] = useState<string[]>([]);
  const [trendingProducts, setTrendingProducts] = useState<TrendingProduct[]>([]);
  const [trendingTimestamp, setTrendingTimestamp] = useState<number | null>(null);
  const [isFetchingTrending, setIsFetchingTrending] = useState(false);
  const [isFetchingProducts, setIsFetchingProducts] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'history'>('preview');
  const [viralScore, setViralScore] = useState<number | null>(null);
  const [viralScoreB, setViralScoreB] = useState<number | null>(null);

  const [isApiKeyMissing, setIsApiKeyMissing] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const debugInfo = {
    "process.env.GEMINI_API_KEY": process.env.GEMINI_API_KEY ? `Found (len: ${process.env.GEMINI_API_KEY.length}, starts with: ${process.env.GEMINI_API_KEY.substring(0, 4)}...)` : "Not Found",
    "process.env.API_KEY": process.env.API_KEY ? `Found (len: ${process.env.API_KEY.length}, starts with: ${process.env.API_KEY.substring(0, 4)}...)` : "Not Found",
    "import.meta.env.VITE_GEMINI_API_KEY": (import.meta as any).env?.VITE_GEMINI_API_KEY ? `Found (len: ${(import.meta as any).env.VITE_GEMINI_API_KEY.length})` : "Not Found",
    "NODE_ENV": process.env.NODE_ENV,
    "isApiKeyMissing": isApiKeyMissing.toString()
  };

  useEffect(() => {
    const checkApiKey = async () => {
      const key = 
        process.env.GEMINI_API_KEY || 
        process.env.API_KEY || 
        (import.meta as any).env?.VITE_GEMINI_API_KEY ||
        (import.meta as any).env?.GEMINI_API_KEY;

      if (!key || key === "undefined" || key === "null" || key.includes("TODO_")) {
        setIsApiKeyMissing(true);
      } else {
        setIsApiKeyMissing(false);
      }
    };
    checkApiKey();
  }, []);

  const handleOpenKeySelection = async () => {
    if ((window as any).aistudio?.openSelectKey) {
      await (window as any).aistudio.openSelectKey();
      // After selection, the page might reload or we might need to check again
      window.location.reload();
    } else {
      alert("Silakan tambahkan GEMINI_API_KEY di menu Settings (ikon roda gigi).");
    }
  };

  const calculateViralScore = (text: string) => {
    // Simple pseudo-random score based on text length and some keywords
    const base = 75;
    const lengthBonus = Math.min(text.length / 50, 15);
    const randomFactor = Math.floor(Math.random() * 10);
    return Math.min(base + lengthBonus + randomFactor, 99);
  };

  const fetchTrendingTopicsList = async () => {
    setIsFetchingTrending(true);
    try {
      const topics = await fetchTrendingTopics();
      if (topics && topics.length > 0) {
        setTrendingTopics(topics);
        setTrendingTimestamp(Date.now());
      } else {
        setTrendingTopics(["Ketik topik manual di bawah ya 🙏"]);
        setTrendingTimestamp(null);
      }
    } catch (err: any) {
      console.error("Fetch trending error:", err);
      const errStr = JSON.stringify(err);
      if (err.message?.includes("API key not valid") || errStr.includes("API_KEY_INVALID") || errStr.includes("400")) {
        setError("API Key Gemini tidak valid. Silakan periksa kembali di Settings.");
      } else if (errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("429") || (err.message && err.message.includes("quota"))) {
        setError("Kuota API Gemini habis. Silakan tunggu sebentar atau gunakan API Key lain.");
      }
      setTrendingTopics(["Ketik topik manual di bawah ya 🙏"]);
      setTrendingTimestamp(null);
    } finally {
      setIsFetchingTrending(false);
    }
  };

  const fetchTrendingProductsList = async (force = false) => {
    setIsFetchingProducts(true);
    try {
      // Fetch from both sources in parallel
      const [geminiRes, shopeeRes] = await Promise.allSettled([
        fetchTrendingViaGemini(),
        fetch("/api/shopee/trending").then(r => r.json())
      ]);

      const geminiProducts = geminiRes.status === "fulfilled" ? geminiRes.value : [];
      const shopeeProducts = shopeeRes.status === "fulfilled" && shopeeRes.value.success 
        ? shopeeRes.value.data.map((p: any) => ({
            name: p.name,
            category: "Shopee Winning",
            reason: `${p.sold.toLocaleString()} terjual bulan ini`,
            priceRange: p.priceFormatted,
            source: "shopee"
          }))
        : [];

      // Merge and shuffle slightly
      const merged = [...geminiProducts, ...shopeeProducts].sort(() => Math.random() - 0.5);
      setTrendingProducts(merged.slice(0, 8));
    } catch (err: any) {
      console.error("Fetch products error:", err);
      const errStr = JSON.stringify(err);
      if (err.message?.includes("API key not valid") || errStr.includes("API_KEY_INVALID") || errStr.includes("400")) {
        setError("API Key Gemini tidak valid. Silakan periksa kembali di Settings.");
      } else if (errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("429") || (err.message && err.message.includes("quota"))) {
        setError("Kuota API Gemini habis. Silakan tunggu sebentar.");
      }
    } finally {
      setIsFetchingProducts(false);
    }
  };

  useEffect(() => {
    fetchTrendingTopicsList();
    fetchTrendingProductsList();
  }, []);

  useEffect(() => {
    const savedAccess = localStorage.getItem('threadgen_pro_access');
    if (savedAccess === 'true') {
      setHasAccess(true);
    }
  }, []);

  // Firebase Connection Test
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();
  }, []);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setIsAuthReady(true);
      
      if (firebaseUser) {
        // Sync user to Firestore
        const userRef = doc(db, 'users', firebaseUser.uid);
        try {
          const userDoc = await getDoc(userRef);
          if (!userDoc.exists()) {
            await setDoc(userRef, {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'Anonymous',
              email: firebaseUser.email || '',
              role: 'user',
              createdAt: serverTimestamp()
            });
          }
        } catch (err) {
          console.error("Error syncing user profile:", err);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Login failed:", err);
      showToast("Login gagal. Coba lagi ya!");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('threadgen_pro_access');
      setHasAccess(false);
      setView('landing');
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // History Sync with Firestore
  useEffect(() => {
    if (!user || !isAuthReady) {
      setHistory([]);
      return;
    }

    const q = query(
      collection(db, 'threads'),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const threads = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          topic: data.topic,
          length: data.length,
          tone: data.tone,
          thread: data.thread,
          booster: data.booster,
          timestamp: data.createdAt?.toMillis() || Date.now()
        };
      });
      setHistory(threads);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'threads');
    });

    return () => unsubscribe();
  }, [user, isAuthReady]);

  const saveToHistory = async (topic: string, length: string | undefined, tone: string | undefined, thread: string[], booster?: ViralBooster) => {
    if (!user) return;

    const threadId = Date.now().toString();
    const threadRef = doc(db, 'threads', threadId);
    
    try {
      await setDoc(threadRef, {
        uid: user.uid,
        topic,
        length: length || 'PENDEK',
        tone: tone || 'SANTAI',
        thread,
        booster: booster || null,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `threads/${threadId}`);
    }
  };

  const deleteHistoryItem = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!user) return;
    
    try {
      await deleteDoc(doc(db, 'threads', id));
      showToast("Thread dihapus!");
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `threads/${id}`);
    }
  };

  const loadFromHistory = (item: {topic: string, length?: string, tone?: string, thread: string[], booster?: ViralBooster}) => {
    setParams({ 
      topic: item.topic, 
      length: (item.length as any) || 'PENDEK',
      tone: (item.tone as any) || 'SANTAI'
    });
    setThread(item.thread);
    setBooster(item.booster || null);
  };

  useEffect(() => {
    const savedAccess = localStorage.getItem('threadgen_pro_access');
    if (savedAccess === 'true') {
      setHasAccess(true);
    }
  }, []);

  useEffect(() => {
    if (hasAccess && view !== 'landing') {
      setView('app');
    }
  }, [hasAccess]);

  useEffect(() => {
    if (view === 'landing') {
      const timer = setInterval(() => {
        setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [view]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const showToast = (msg: string) => {
    setNotificationMsg(msg);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3000);
  };

  const [isABTesting, setIsABTesting] = useState(false);
  const [threadB, setThreadB] = useState<string[]>([]);
  const [isGeneratingB, setIsGeneratingB] = useState(false);

  const handleGenerate = async (isVersionB = false) => {
    if (!params.topic) return;

    if (isVersionB) setIsGeneratingB(true);
    else setIsGenerating(true);
    
    setIsGeneratingImage(false);
    setError(null);
    if (!isVersionB) {
      setBooster(null);
      setCoverImage(null);
      setThreadB([]);
    }
    
    try {
      const result = await generateThread({
        ...params,
        topic: isVersionB ? `${params.topic} (Buat versi alternatif yang berbeda gaya)` : params.topic
      });

      if (result.tweets.length === 0) {
        setError("Gagal meracik thread. Coba ganti topik atau detailnya ya!");
      } else {
        let sanitizedTweets = (result.tweets || []).map(t => t.trim());
        
        if (isVersionB) {
          setThreadB(sanitizedTweets);
          setViralScoreB(calculateViralScore(sanitizedTweets.join(' ')));
        } else {
          // Look for [GAMBAR]: in the first tweet
          let firstTweet = result.tweets[0];
          const imageMatch = firstTweet.match(/\[GAMBAR\]:\s*(.*)/i);
          
          if (imageMatch) {
            const imagePrompt = imageMatch[1].trim();
            result.tweets[0] = firstTweet.replace(/\[GAMBAR\]:.*\n?/i, '').trim();
            handleGenerateCoverImage(imagePrompt);
          }

          setThread(sanitizedTweets);
          setViralScore(calculateViralScore(sanitizedTweets.join(' ')));
          setBooster(result.booster || null);
          saveToHistory(params.topic, params.length, params.tone, sanitizedTweets, result.booster);
          
          if (isABTesting) {
            handleGenerate(true);
          }
        }
      }
    } catch (err: any) {
      console.error("Generate Error:", err);
      let msg = err.message || 'Terjadi kesalahan sistem';
      
      // Check for API key invalid or quota error from Google
      const errStr = JSON.stringify(err);
      if (msg.includes("API key not valid") || errStr.includes("API_KEY_INVALID") || errStr.includes("400")) {
        msg = "API Key Gemini tidak valid. Silakan periksa kembali API Key Anda di menu Settings (ikon roda gigi).";
      } else if (errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("429") || msg.includes("quota")) {
        msg = "Kuota API Gemini Anda telah habis (Limit Tercapai). Silakan tunggu beberapa menit atau gunakan API Key lain yang memiliki kuota tersedia.";
      }
      
      setError(`Error: ${msg}`);
    } finally {
      if (isVersionB) setIsGeneratingB(false);
      else setIsGenerating(false);
    }
  };

  const handleGenerateCoverImage = async (prompt: string) => {
    setIsGeneratingImage(true);
    try {
      const base64 = await generateCoverImage(prompt);
      if (base64) {
        setCoverImage(`data:image/png;base64,${base64}`);
      }
    } catch (err) {
      console.error("Failed to generate image:", err);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const reset = () => {
    setParams({ topic: '', length: 'PENDEK' });
    setThread([]);
    setCoverImage(null);
    setBooster(null);
    setError(null);
  };

  const handleGetAccess = () => {
    if (hasAccess) {
      setView('app');
    } else {
      setView('code');
    }
  };

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (accessCode.toUpperCase() === 'KAYARAYA99') {
      setHasAccess(true);
      localStorage.setItem('threadgen_pro_access', 'true');
      setView('app');
      showToast("Akses Diberikan! Selamat datang.");
    } else {
      alert("Kode akses salah! Silakan dapatkan kode yang valid.");
    }
  };

  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-[#0A0A0B] text-white font-sans overflow-x-hidden selection:bg-indigo-500/30">
        {/* Background Glow */}
        <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/10 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-violet-500/10 blur-[120px] rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40%] h-[40%] bg-purple-500/5 blur-[120px] rounded-full" />
        </div>

        {/* Navigation */}
        <nav className="relative z-50 max-w-7xl mx-auto px-4 sm:px-6 h-20 sm:h-24 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-1.5 sm:p-2 rounded-lg sm:rounded-xl shadow-lg shadow-indigo-500/20">
              <BrainCircuit className="text-white w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <span className="text-lg sm:text-xl font-black tracking-tighter uppercase font-display">Thread Gen<span className="text-indigo-600">Pro</span></span>
          </div>
          <div className="flex items-center gap-3 sm:gap-6">
            <button 
              onClick={handleGetAccess}
              className="px-4 sm:px-6 py-2 sm:py-2.5 bg-white/5 border border-white/10 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold hover:bg-white/10 transition-all flex items-center gap-2"
            >
              <LogIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> {hasAccess ? 'Dashboard' : 'Login'}
            </button>
            <button 
              onClick={handleGetAccess}
              className="px-4 sm:px-6 py-2 sm:py-2.5 bg-indigo-600 text-white rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
            >
              Get Started
            </button>
          </div>
        </nav>

        <main className="relative z-10">
          {/* Hero Section - Split Layout */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-20 sm:pb-32 grid grid-cols-1 lg:grid-cols-2 gap-12 sm:gap-20 items-center relative">
            {/* Animated Background Glows */}
            <motion.div 
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.5, 0.3],
                x: [0, 50, 0],
                y: [0, -50, 0]
              }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/20 blur-[120px] rounded-full -z-10" 
            />
            <motion.div 
              animate={{ 
                scale: [1.2, 1, 1.2],
                opacity: [0.2, 0.4, 0.2],
                x: [0, -50, 0],
                y: [0, 50, 0]
              }}
              transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
              className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-violet-600/10 blur-[150px] rounded-full -z-10" 
            />
            <div className="space-y-10">
              <motion.div 
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600/10 border border-indigo-600/20 rounded-full text-indigo-500 text-xs font-black uppercase tracking-widest"
              >
                <Sparkles className="w-3 h-3" />
                Next-Gen Content Engine
              </motion.div>
              
              <motion.h1 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-5xl sm:text-7xl md:text-8xl font-black tracking-tighter leading-[0.85] font-display"
              >
                DOMINASI <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500 bg-[length:200%_auto] animate-gradient">THREADS</span> <br />
                TANPA MIKIR.
              </motion.h1>
              
              <motion.p 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-gray-400 text-lg sm:text-xl md:text-2xl max-w-xl leading-relaxed"
              >
                Ubah ide mentah jadi thread viral yang terasa <span className="text-white font-bold italic">"manusia banget"</span> dalam 30 detik. 100% Anti-AI detection.
              </motion.p>

              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex flex-col sm:flex-row items-center gap-6"
              >
                <button 
                  onClick={handleGetAccess}
                  className="premium-button w-full sm:w-auto flex items-center justify-center gap-3 group"
                >
                  {hasAccess ? 'MASUK DASHBOARD' : 'MULAI SEKARANG'}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
                <div className="flex items-center gap-4 text-gray-500 text-sm font-medium">
                  <div className="flex -space-x-2">
                    {[1,2,3,4].map(i => (
                      <img key={i} src={`https://i.pravatar.cc/100?u=${i+10}`} className="w-10 h-10 rounded-full border-2 border-[#0A0A0B]" referrerPolicy="no-referrer" />
                    ))}
                  </div>
                  <div className="text-xs">
                    <div className="flex gap-1 mb-1">
                      {[1,2,3,4,5].map(s => <Sparkles key={s} className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />)}
                    </div>
                    <p className="text-gray-500 font-bold uppercase tracking-widest">Dipercaya 2,500+ Kreator</p>
                  </div>
                </div>
              </motion.div>
            </div>

            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="relative hidden lg:block"
            >
              <div className="absolute inset-0 bg-indigo-600/20 blur-[120px] rounded-full animate-pulse" />
              <div className="glass-card p-10 space-y-8 relative animate-float border-white/10 shadow-2xl shadow-indigo-500/10">
                <div className="flex items-center justify-between border-b border-white/5 pb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/40">
                      <BrainCircuit className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="h-4 w-32 bg-white/10 rounded-full mb-2" />
                      <div className="h-3 w-20 bg-white/5 rounded-full" />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
                    <TrendingUp className="w-3 h-3 text-green-500" />
                    <span className="text-[9px] font-black text-green-500 uppercase">Viral Score: 98%</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="h-4 w-full bg-white/10 rounded-full" />
                  <div className="h-4 w-5/6 bg-white/10 rounded-full" />
                  <div className="h-4 w-4/6 bg-white/10 rounded-full" />
                </div>
                <div className="pt-6 grid grid-cols-2 gap-4">
                  <div className="h-24 bg-white/5 rounded-3xl border border-white/5 flex flex-col items-center justify-center gap-2 group hover:bg-white/10 transition-all">
                    <TrendingUp className="w-6 h-6 text-indigo-500 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Viral Rate</span>
                  </div>
                  <div className="h-24 bg-white/5 rounded-3xl border border-white/5 flex flex-col items-center justify-center gap-2 group hover:bg-white/10 transition-all">
                    <Zap className="w-6 h-6 text-amber-500 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Speed</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </section>

          {/* Features Bento Grid */}
          <section id="features" className="py-16 sm:py-32 bg-white/[0.01] border-y border-white/5">
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <div className="text-center mb-12 sm:mb-24 space-y-4 sm:space-y-6">
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  viewport={{ once: true }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600/10 border border-indigo-600/20 rounded-full text-indigo-500 text-[10px] font-black uppercase tracking-widest"
                >
                  <Sparkles className="w-3 h-3" />
                  Powerful Features
                </motion.div>
                <h2 className="text-3xl sm:text-4xl md:text-6xl font-black font-display tracking-tight">ENGINEERED FOR <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-violet-500">VIRALITY</span></h2>
                <p className="text-gray-400 text-lg sm:text-xl max-w-2xl mx-auto">Setiap fitur dirancang untuk satu tujuan: membuat konten kamu berhenti di scroll orang.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  viewport={{ once: true }}
                  className="glass-card p-6 sm:p-10 md:col-span-2 flex flex-col justify-between group relative overflow-hidden border-white/10"
                >
                  <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 blur-[80px] -z-10 group-hover:bg-indigo-600/20 transition-colors" />
                  <div>
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-indigo-600/20 rounded-xl sm:rounded-2xl flex items-center justify-center mb-6 sm:mb-8 group-hover:scale-110 transition-transform">
                      <ShieldCheck className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-500" />
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-black mb-4 font-display uppercase">100% Anti-AI Engine</h3>
                    <p className="text-gray-400 text-base sm:text-lg leading-relaxed max-w-md">Algoritma kami dilatih khusus untuk meniru gaya penulisan manusia yang emosional, berantakan secara natural, dan punya opini kuat. Dijamin lolos deteksi AI manapun.</p>
                  </div>
                  <div className="mt-8 sm:mt-12 flex flex-wrap items-center gap-3 sm:gap-4">
                    <div className="px-3 sm:px-4 py-1.5 sm:py-2 bg-white/5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-gray-500 border border-white/5">No "Tentu Saja"</div>
                    <div className="px-3 sm:px-4 py-1.5 sm:py-2 bg-white/5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-gray-500 border border-white/5">Natural Typos</div>
                  </div>
                </motion.div>

                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 }}
                  className="glass-card p-6 sm:p-10 group relative overflow-hidden border-white/10"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-amber-500/10 transition-all" />
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-amber-600/20 rounded-xl sm:rounded-2xl flex items-center justify-center mb-6 sm:mb-8 group-hover:scale-110 transition-transform">
                    <Zap className="w-6 h-6 sm:w-8 sm:h-8 text-amber-500" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black mb-4 font-display">VIRAL BOOSTER</h3>
                  <p className="text-gray-400 text-sm sm:text-base leading-relaxed">Saran kata kunci dan hook yang sedang trending di Indonesia untuk meningkatkan engagement secara instan.</p>
                </motion.div>

                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 }}
                  className="glass-card p-6 sm:p-10 group relative overflow-hidden border-white/10"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-purple-500/10 transition-all" />
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-violet-600/20 rounded-xl sm:rounded-2xl flex items-center justify-center mb-6 sm:mb-8 group-hover:scale-110 transition-transform">
                    <Split className="w-6 h-6 sm:w-8 sm:h-8 text-violet-500" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black mb-4 font-display">A/B TESTING</h3>
                  <p className="text-gray-400 text-sm sm:text-base leading-relaxed">Generate dua versi thread sekaligus dan bandingkan mana yang punya potensi viral lebih tinggi.</p>
                </motion.div>

                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 }}
                  className="glass-card p-6 sm:p-10 md:col-span-2 flex flex-col sm:flex-row items-center gap-6 sm:gap-10 group relative overflow-hidden border-white/10"
                >
                  <div className="absolute bottom-0 left-0 w-64 h-64 bg-violet-600/10 blur-[80px] -z-10 group-hover:bg-violet-600/20 transition-colors" />
                  <div className="hidden sm:block w-1/3">
                    <div className="aspect-square bg-gradient-to-br from-indigo-600 to-violet-600 rounded-[32px] sm:rounded-[40px] shadow-2xl shadow-indigo-500/20 flex items-center justify-center">
                      <TrendingUp className="w-16 h-16 sm:w-20 sm:h-20 text-white" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl sm:text-3xl font-black mb-4 font-display">TRENDING INSIGHT</h3>
                    <p className="text-gray-400 text-base sm:text-lg leading-relaxed">Dapatkan update topik apa yang lagi panas di Threads Indonesia setiap harinya agar kontenmu selalu relevan.</p>
                    <div className="mt-6 sm:mt-10 flex items-center gap-4 sm:gap-6">
                      <div className="flex -space-x-3">
                        {[1,2,3].map(i => (
                          <div key={i} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/10 border-2 border-[#0A0A0B] flex items-center justify-center text-[9px] sm:text-[10px] font-bold">#{i}</div>
                        ))}
                      </div>
                      <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-indigo-500">Real-time Analysis</span>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </section>

          {/* How It Works */}
          <section className="py-16 sm:py-32">
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <div className="text-center mb-16 sm:mb-24 space-y-4 sm:space-y-6">
                <h2 className="text-3xl sm:text-4xl md:text-6xl font-black font-display tracking-tight">CARA KERJA <span className="text-indigo-500">THREADGEN</span></h2>
                <p className="text-gray-400 text-lg sm:text-xl max-w-2xl mx-auto">Dari ide mentah jadi thread viral dalam hitungan detik.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12 relative">
                {/* Connecting Line */}
                <div className="hidden md:block absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent -translate-y-1/2 z-0" />
                
                {[
                  { step: "01", title: "Input Topik", desc: "Tulis ide atau topik apa saja yang ingin kamu bahas. Bisa sesimpel 'tips nabung' atau 'review gadget'.", icon: <MousePointer2 className="w-6 h-6" /> },
                  { step: "02", title: "Pilih Gaya", desc: "Sesuaikan panjang thread dan tone bahasa. Mau santai kayak curhat atau serius kayak edukasi.", icon: <Sparkles className="w-6 h-6" /> },
                  { step: "03", title: "Viral!", desc: "AI kami akan meracik thread dengan hook mematikan. Tinggal copy-paste dan lihat engagement naik.", icon: <TrendingUp className="w-6 h-6" /> }
                ].map((item, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ y: 20, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.1 }}
                    className="relative z-10 space-y-6 text-center group"
                  >
                    <div className="w-24 h-24 bg-[#0A0A0B] border border-white/10 rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-indigo-600/5 group-hover:border-indigo-500/50 transition-all duration-500 relative">
                      <div className="absolute inset-0 bg-indigo-600/5 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="text-indigo-500 group-hover:scale-110 transition-transform duration-500 relative z-10">{item.icon}</div>
                    </div>
                    <div className="space-y-2">
                      <span className="text-indigo-600 font-black tracking-widest text-[10px] uppercase">{item.step}</span>
                      <h3 className="text-2xl font-black font-display">{item.title}</h3>
                      <p className="text-gray-500 leading-relaxed max-w-[250px] mx-auto">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* Social Proof / Testimonials */}
          <section className="py-16 sm:py-32 bg-indigo-600/5">
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
                {[
                  { name: "Budi Santoso", role: "Tech Influencer", text: "Gila sih, hook-nya beneran berasa nulis sendiri. Engagement rate naik 40% sejak pake ThreadGen.", avatar: "https://i.pravatar.cc/100?u=1" },
                  { name: "Siti Aminah", role: "Content Creator", text: "Dulu bikin thread bisa sejam, sekarang 30 detik kelar. Tone bahasanya asik banget, gak kaku.", avatar: "https://i.pravatar.cc/100?u=2" },
                  { name: "Andi Wijaya", role: "Digital Marketer", text: "Fitur A/B Testing-nya ngebantu banget buat nentuin mana hook yang paling nendang.", avatar: "https://i.pravatar.cc/100?u=3" }
                ].map((t, i) => (
                  <motion.div 
                    key={i}
                    initial={{ scale: 0.9, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="glass-card p-6 sm:p-8 space-y-4 sm:space-y-6"
                  >
                    <div className="flex items-center gap-4">
                      <img src={t.avatar} className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-white/10" referrerPolicy="no-referrer" />
                      <div>
                        <h4 className="font-bold text-sm sm:text-base">{t.name}</h4>
                        <p className="text-[10px] sm:text-xs text-gray-500">{t.role}</p>
                      </div>
                    </div>
                    <p className="text-gray-400 text-sm sm:text-base italic">"{t.text}"</p>
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map(s => <Sparkles key={s} className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-500 fill-amber-500" />)}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* FAQ Section */}
          <section className="py-16 sm:py-32">
            <div className="max-w-3xl mx-auto px-4 sm:px-6">
              <div className="text-center mb-12 sm:mb-16">
                <h2 className="text-3xl sm:text-4xl font-black font-display tracking-tight">PERTANYAAN <span className="text-indigo-500">UMUM</span></h2>
              </div>
              <div className="space-y-4">
                {[
                  { q: "Apakah ini aman untuk akun saya?", a: "Sangat aman. Kami tidak meminta akses login akun kamu. Kamu hanya perlu copy-paste hasil generate ke platform favoritmu." },
                  { q: "Bisa untuk bahasa apa saja?", a: "Fokus utama kami adalah Bahasa Indonesia dengan dialek yang natural, tapi kami juga mendukung Bahasa Inggris." },
                  { q: "Apakah ada biaya bulanan?", a: "Tidak ada. Cukup bayar sekali Rp 99rb, kamu dapat akses selamanya termasuk update fitur di masa depan." }
                ].map((faq, i) => (
                  <motion.div 
                    key={i}
                    initial={{ y: 10, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    viewport={{ once: true }}
                    className="glass-card p-6"
                  >
                    <h4 className="font-bold mb-2 flex items-center gap-3">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                      {faq.q}
                    </h4>
                    <p className="text-gray-500 text-sm leading-relaxed pl-5">{faq.a}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* Pricing / CTA */}
          <section className="py-16 sm:py-32">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
              <motion.div 
                initial={{ y: 40, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                className="glass-card p-8 sm:p-20 relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-indigo-600/20 transition-all" />
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-violet-600/5 blur-[120px] rounded-full translate-y-1/2 -translate-x-1/2" />
                
                <div className="relative z-10 space-y-8 sm:space-y-10">
                  <div className="inline-flex items-center gap-2 px-6 py-2 bg-red-600 text-white font-black uppercase tracking-widest rounded-full text-[10px] animate-pulse">
                    Limited Offer: Sisa {slotsLeft} Slot!
                  </div>
                  <h2 className="text-3xl sm:text-5xl md:text-7xl font-black font-display tracking-tighter leading-none">
                    INVESTASI SEKALI <br />UNTUK <span className="text-indigo-500">SELAMANYA.</span>
                  </h2>
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-gray-500 text-xl sm:text-2xl line-through font-bold">Rp 299.000</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl sm:text-2xl font-bold text-gray-400">Rp</span>
                      <p className="text-6xl sm:text-8xl md:text-9xl font-black tracking-tighter">99rb</p>
                    </div>
                  </div>
                  <div className="space-y-4 sm:space-y-6">
                    <button 
                      onClick={handleGetAccess}
                      className="premium-button w-full sm:w-auto text-lg sm:text-xl px-8 sm:px-12 py-4 sm:py-6"
                    >
                      AMBIL AKSES SEKARANG
                    </button>
                    <div className="flex flex-wrap justify-center gap-4 sm:gap-6 text-gray-500 text-[10px] sm:text-xs font-bold uppercase tracking-widest">
                      <span className="flex items-center gap-2"><Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500" /> One-time Payment</span>
                      <span className="flex items-center gap-2"><Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500" /> Lifetime Access</span>
                      <span className="flex items-center gap-2"><Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500" /> Future Updates</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </section>
        </main>

        <footer className="py-12 sm:py-20 border-t border-white/5 text-center">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6 sm:space-y-8">
            <div className="flex items-center justify-center gap-3">
              <BrainCircuit className="text-indigo-600 w-5 h-5 sm:w-6 sm:h-6" />
              <span className="text-lg sm:text-xl font-black tracking-tighter uppercase font-display">Thread Gen<span className="text-indigo-600">Pro</span></span>
            </div>
            <p className="text-gray-500 text-xs sm:text-sm">© 2026 ThreadGen Pro. Dirancang untuk Kreator Indonesia.</p>
          </div>
        </footer>
      </div>
    );
  }

  if (view === 'code') {
    return (
      <div className="min-h-screen bg-[#0A0A0B] text-white flex items-center justify-center p-6 relative overflow-hidden">
        {/* Background Glow */}
        <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/5 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-purple-500/5 blur-[120px] rounded-full" />
        </div>

        <AnimatePresence>
          {showNotification && (
            <motion.div 
              initial={{ y: -100, opacity: 0 }}
              animate={{ y: 20, opacity: 1 }}
              exit={{ y: -100, opacity: 0 }}
              className="fixed top-0 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm"
            >
              <div className="bg-amber-500 p-6 rounded-3xl shadow-2xl border border-white/20 flex items-center gap-4">
                <div className="bg-white/20 p-3 rounded-2xl">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-black uppercase tracking-widest text-xs text-white">Sistem Notifikasi</p>
                  <p className="text-sm font-bold text-white">{notificationMsg}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white/5 border border-white/10 p-5 sm:p-10 rounded-[24px] sm:rounded-[40px] backdrop-blur-xl space-y-6 sm:space-y-8 relative z-10"
        >
          <div className="text-center space-y-2">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-amber-500 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-lg shadow-amber-500/20">
              <Lock className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <h2 className="text-xl sm:text-3xl font-black uppercase tracking-tighter">Aktivasi Akses</h2>
            <p className="text-gray-400 text-xs sm:text-base">Masukkan kode akses untuk mulai menggunakan Thread Gen Pro v10</p>
          </div>

          <form onSubmit={handleVerifyCode} className="space-y-4 sm:space-y-6">
            <input 
              type="text" 
              required
              placeholder="KODE-AKSES-ANDA"
              className="w-full px-4 py-4 sm:py-6 bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl focus:border-amber-500 outline-none transition-all font-black text-center text-lg sm:text-2xl tracking-[0.2em] sm:tracking-[0.3em] uppercase placeholder:tracking-normal placeholder:font-medium placeholder:text-base sm:placeholder:text-lg"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
            />

            <button 
              type="submit"
              className="w-full py-3.5 sm:py-4 bg-amber-500 text-white font-black uppercase tracking-widest rounded-xl sm:rounded-2xl hover:scale-[1.02] transition-all shadow-lg shadow-amber-500/20"
            >
              Aktivasi Sekarang
            </button>
          </form>

          <div className="bg-amber-500/10 border border-amber-500/20 p-5 sm:p-6 rounded-2xl sm:rounded-3xl space-y-3 sm:space-y-4">
            <div className="space-y-1">
              <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-amber-500">Belum punya kode?</p>
              <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                Dapatkan kode akses eksklusif kamu melalui link pembayaran resmi kami di bawah ini:
              </p>
            </div>
            <a 
              href="https://larisdigi.myscalev.com/threads-gen"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 sm:py-4 bg-amber-500 hover:bg-amber-600 text-white text-sm sm:text-base font-black uppercase tracking-widest rounded-xl sm:rounded-2xl flex items-center justify-center gap-2 sm:gap-3 transition-all shadow-lg shadow-amber-500/20"
            >
              BELI KODE AKSES SEKARANG <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </a>
            <p className="text-[10px] text-center text-gray-500 font-medium italic">
              *Setelah pembayaran sukses, kode akan dikirimkan otomatis ke WhatsApp/Email Anda.
            </p>
          </div>

          <button 
            onClick={() => setView('landing')}
            className="w-full text-center text-xs text-gray-600 hover:text-gray-400"
          >
            Kembali ke Beranda
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans selection:bg-indigo-600/10">
      {/* Debug Overlay */}
      {showDebug && (
        <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black tracking-tight">Debug Environment</h3>
              <button onClick={() => setShowDebug(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4 font-mono text-[10px] bg-slate-50 p-4 rounded-2xl overflow-auto max-h-[60vh]">
              {Object.entries(debugInfo).map(([key, value]) => (
                <div key={key} className="flex flex-col gap-1 border-b border-slate-200 pb-2 last:border-0">
                  <span className="text-indigo-600 font-bold uppercase tracking-widest">{key}</span>
                  <span className="text-slate-600 break-all">{value}</span>
                </div>
              ))}
            </div>
            <button 
              onClick={() => setShowDebug(false)}
              className="w-full mt-6 py-4 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-slate-800 transition-all active:scale-[0.98]"
            >
              Close Debug
            </button>
          </div>
        </div>
      )}

      {/* Floating Debug Trigger */}
      <button 
        onClick={() => setShowDebug(true)}
        className="fixed bottom-4 right-4 z-[100] p-3 bg-white/80 backdrop-blur-md border border-slate-200 rounded-full shadow-lg hover:bg-white transition-all active:scale-90 opacity-50 hover:opacity-100"
        title="Debug Env"
      >
        <Bug className="w-4 h-4 text-slate-400" />
      </button>
      <AnimatePresence>
        {showNotification && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 20, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-0 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm"
          >
            <div className="bg-amber-500 p-6 rounded-3xl shadow-2xl border border-white/20 flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-2xl">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-black uppercase tracking-widest text-xs text-white">Sistem Notifikasi</p>
                <p className="text-sm font-bold text-white">{notificationMsg}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 cursor-pointer" onClick={() => setView('landing')}>
            <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl shadow-lg shadow-indigo-100">
              <BrainCircuit className="text-white w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <span className="text-base sm:text-xl font-black tracking-tighter uppercase">Thread Gen<span className="text-indigo-600">Pro</span></span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-4">
            <div className="hidden sm:flex flex-col items-end mr-2">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</span>
              <span className="text-xs font-bold text-indigo-600">PRO MEMBER</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <button 
                onClick={handleLogout}
                className="p-1.5 sm:p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg sm:rounded-xl transition-all"
                title="Logout"
              >
                <LogOut className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              </button>
              <button 
                onClick={reset}
                className="p-1.5 sm:p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg sm:rounded-xl transition-all"
                title="Reset All"
              >
                <Trash2 className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              </button>
            </div>
            <div className="hidden sm:block h-8 w-[1px] bg-gray-200 mx-2" />
            <div className="hidden sm:flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Online</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-10">
          {/* Left Column: Form & History (Desktop) */}
          <aside className="lg:col-span-4 space-y-6 sm:space-y-8">
            <div className="bg-white p-5 sm:p-8 rounded-[24px] sm:rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-gray-100/50 sticky top-28">
              <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
                  <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black tracking-tight">Generator Utas</h2>
                  <p className="text-[9px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest">Premium Engine v10</p>
                </div>
              </div>

              {isApiKeyMissing && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-red-600">
                    <Lock className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">API Key Missing</span>
                  </div>
                  <p className="text-[10px] text-red-500 font-bold leading-relaxed">
                    Gemini API Key tidak ditemukan. Silakan tambahkan di Settings atau klik tombol di bawah.
                  </p>
                  <button 
                    onClick={handleOpenKeySelection}
                    className="w-full py-2 bg-red-600 text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-red-700 transition-all flex items-center justify-center gap-2"
                  >
                    <Wrench className="w-4 h-4" /> Perbaiki API Key
                  </button>
                </div>
              )}

              <div className="space-y-8">
                {/* Trending Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Trending Now</label>
                      <div className="flex items-center gap-1 px-2 py-0.5 bg-green-500/10 rounded-full">
                        <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-[8px] font-black text-green-600 uppercase tracking-widest">Live</span>
                      </div>
                    </div>
                    <button 
                      onClick={fetchTrendingTopicsList}
                      disabled={isFetchingTrending}
                      className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors disabled:opacity-50 uppercase tracking-widest"
                    >
                      {isFetchingTrending ? <Loader2 className="w-3 h-3 animate-spin" /> : <TrendingUp className="w-3 h-3" />}
                      Refresh
                    </button>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {trendingTopics.length > 0 ? (
                      trendingTopics.map((topic, i) => (
                        <button
                          key={i}
                          onClick={() => setParams({ ...params, topic })}
                          className={`px-3 py-1.5 text-[10px] font-bold rounded-full border transition-all ${
                            params.topic === topic 
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100' 
                              : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100'
                          }`}
                        >
                          {topic}
                        </button>
                      ))
                    ) : (
                      <div className="w-full p-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-center">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">No trending data</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Trending Products Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Trending Products</label>
                      <div className="flex items-center gap-1 px-2 py-0.5 bg-orange-500/10 rounded-full">
                        <Sparkles className="w-2 h-2 text-orange-500" />
                        <span className="text-[8px] font-black text-orange-600 uppercase tracking-widest">Hot</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => fetchTrendingProductsList(true)}
                      disabled={isFetchingProducts}
                      className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors disabled:opacity-50 uppercase tracking-widest"
                    >
                      {isFetchingProducts ? <Loader2 className="w-3 h-3 animate-spin" /> : <TrendingUp className="w-3 h-3" />}
                      Refresh
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2">
                    {trendingProducts.length > 0 ? (
                      trendingProducts.map((product, i) => (
                        <button
                          key={i}
                          onClick={() => setParams({ ...params, topic: `Ranking: ${product.name} (${product.category}) - kenapa ini viral? ${product.reason}` })}
                          className="p-3 text-left bg-gray-50 border border-gray-100 rounded-2xl hover:bg-indigo-50 hover:border-indigo-100 transition-all group"
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{product.category}</span>
                            <span className="text-[8px] font-bold text-gray-400 bg-white px-1.5 py-0.5 rounded border border-gray-100">{product.source}</span>
                          </div>
                          <h4 className="text-xs font-black text-gray-800 group-hover:text-indigo-700 transition-colors line-clamp-1">{product.name}</h4>
                          <p className="text-[9px] text-gray-500 mt-1 line-clamp-1 italic">{product.reason}</p>
                          {product.priceRange && (
                            <div className="mt-2 flex items-center gap-1">
                              <Wallet className="w-2.5 h-2.5 text-gray-400" />
                              <span className="text-[9px] font-bold text-gray-400">{product.priceRange}</span>
                            </div>
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="w-full p-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-center">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">No product data</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Input Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Topik & Konteks</label>
                    <div className="flex gap-1">
                      {['PENDEK', 'SEDANG', 'PANJANG'].map(l => (
                        <button 
                          key={l}
                          onClick={() => setParams({...params, length: l as any})}
                          className={`px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest transition-all ${params.length === l ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="relative group">
                    <textarea 
                      placeholder="Apa yang ingin kamu bahas hari ini? Tulis ide mentahmu di sini..."
                      className="w-full p-5 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-[24px] transition-all min-h-[160px] resize-none outline-none font-medium placeholder:text-gray-300 text-base shadow-inner group-hover:bg-gray-100/50"
                      value={params.topic}
                      onChange={(e) => setParams({...params, topic: e.target.value})}
                    />
                    <div className="absolute bottom-4 right-4 flex items-center gap-2">
                      <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">{params.topic.length} chars</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Creative Engine</label>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { name: 'Ranking', icon: ListOrdered, color: 'indigo' },
                      { name: 'Hidden Gem', icon: Sparkles, color: 'amber' },
                      { name: 'Versus', icon: Split, color: 'purple' },
                      { name: 'Tier List', icon: TrendingUp, color: 'blue' },
                      { name: 'Cerita', icon: MessageCircle, color: 'pink' },
                      { name: 'Tips', icon: Lightbulb, color: 'emerald' },
                      { name: 'Roast', icon: Flame, color: 'red' }
                    ].map((m) => (
                      <button
                        key={m.name}
                        onClick={() => {
                          const cleanTopic = params.topic.replace(/^(ranking|hidden gem|versus|vs|tier list|tier|cerita|pengalaman|story|tips|hacks|cara|roast|perbaiki|improve|model \d):\s*/i, '');
                          setParams({ ...params, topic: `${m.name.toLowerCase()}: ${cleanTopic}` });
                        }}
                        className={`py-3 px-1 flex flex-col items-center gap-2 rounded-2xl border transition-all ${
                          params.topic.toLowerCase().startsWith(m.name.toLowerCase()) 
                            ? `bg-${m.color}-600 border-${m.color}-600 text-white shadow-lg shadow-${m.color}-100` 
                            : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600'
                        }`}
                      >
                        <m.icon className="w-4 h-4" />
                        <span className="text-[8px] font-black uppercase tracking-widest">{m.name}</span>
                      </button>
                    ))}
                    <button
                      onClick={() => setIsABTesting(!isABTesting)}
                      className={`py-3 px-1 flex flex-col items-center gap-2 rounded-2xl border transition-all ${
                        isABTesting 
                          ? 'bg-black border-black text-white shadow-lg shadow-gray-200' 
                          : 'bg-gray-50 border-gray-100 text-gray-400 hover:bg-gray-100 hover:text-black'
                      }`}
                    >
                      <Split className="w-4 h-4" />
                      <span className="text-[8px] font-black uppercase tracking-widest">A/B Test</span>
                    </button>
                  </div>
                </div>

                <button 
                  onClick={() => handleGenerate()}
                  disabled={isGenerating || !params.topic}
                  className="w-full py-5 bg-indigo-600 text-white font-black uppercase tracking-widest rounded-2xl transition-all shadow-[0_20px_40px_rgba(79,70,229,0.2)] hover:shadow-[0_20px_40px_rgba(79,70,229,0.4)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 disabled:shadow-none flex flex-col items-center justify-center gap-1 text-base relative overflow-hidden group"
                >
                  {isGenerating ? (
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      Brewing Magic...
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <Zap className="w-6 h-6 fill-current" />
                      <span>Generate Viral Thread</span>
                    </div>
                  )}
                </button>
              </div>
            </div>

            {/* History Section (Desktop Only) */}
            {history.length > 0 && (
              <div className="hidden lg:block bg-white p-8 rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-gray-100/50">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                    <History className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black tracking-tight">Library</h2>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Past Masterpieces</p>
                  </div>
                </div>

                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {history.map((item) => (
                    <div 
                      key={item.id}
                      onClick={() => loadFromHistory(item)}
                      className="group p-4 bg-gray-50 hover:bg-white rounded-2xl cursor-pointer transition-all border border-transparent hover:border-gray-100 hover:shadow-xl hover:shadow-gray-100 relative"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <p className="text-xs font-bold text-gray-700 line-clamp-2 pr-6 leading-relaxed">
                          {item.topic}
                        </p>
                        <button 
                          onClick={(e) => deleteHistoryItem(e, item.id)}
                          className="absolute top-4 right-4 p-1.5 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all bg-white rounded-lg shadow-sm"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-gray-400">
                          <Clock className="w-3 h-3" />
                          {new Date(item.timestamp).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[8px] font-black uppercase tracking-widest rounded-md">
                          {item.length}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Viral Booster Section (Desktop Only - Middle) */}
            <AnimatePresence>
              {booster && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="hidden lg:block bg-gradient-to-br from-indigo-600 to-violet-600 p-6 sm:p-8 rounded-[24px] sm:rounded-[32px] shadow-[0_20px_40px_rgba(79,70,229,0.2)] text-white space-y-6"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black uppercase tracking-widest leading-tight">Viral Booster</h3>
                      <p className="text-white/70 text-[10px] font-medium">Optimalkan jangkauan</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/10 space-y-3">
                      <div className="flex items-center gap-2 text-white/60 text-[9px] font-black uppercase tracking-widest">
                        <MousePointer2 className="w-2.5 h-2.5" />
                        Hook Alternatif
                      </div>
                      <div className="space-y-3">
                        {booster.hooks?.map((hook, i) => (
                          <div key={i} className="flex gap-3 group/hook">
                            <div className="w-6 h-6 bg-white/20 rounded flex items-center justify-center font-black text-[10px] shrink-0">
                              {i + 1}
                            </div>
                            <p className="text-[11px] font-medium leading-relaxed flex-1">
                              {hook}
                            </p>
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(hook);
                                showToast('Hook disalin!');
                              }}
                              className="p-1.5 bg-white/10 hover:bg-white/30 rounded transition-all self-start"
                            >
                              <Copy className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </aside>

          {/* Right Column: Preview & History (Mobile) */}
          <section className="lg:col-span-8 space-y-6 sm:space-y-8">
            {/* Mobile Tabs */}
            <div className="lg:hidden flex bg-white p-1 rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm">
              <button 
                onClick={() => setActiveTab('preview')}
                className={`flex-1 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'preview' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-gray-400'}`}
              >
                Preview Utas
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-gray-400'}`}
              >
                Riwayat ({history.length})
              </button>
            </div>

            {/* History Section (Mobile/Tab Only) */}
            {activeTab === 'history' && history.length > 0 && (
              <div className="lg:hidden bg-white p-5 sm:p-8 rounded-[24px] sm:rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
                <div className="flex items-center gap-3 mb-6 sm:mb-8">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-50 rounded-lg sm:rounded-xl flex items-center justify-center">
                    <History className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-xl font-bold">Riwayat</h2>
                    <p className="text-[10px] sm:text-sm text-gray-400">Thread yang pernah dibuat</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {history.map((item) => (
                    <div 
                      key={item.id}
                      onClick={() => {
                        loadFromHistory(item);
                        setActiveTab('preview');
                      }}
                      className="group p-3 sm:p-4 bg-gray-50 hover:bg-gray-100 rounded-xl sm:rounded-2xl cursor-pointer transition-all border border-transparent hover:border-gray-200 relative"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <p className="text-xs sm:text-sm font-medium text-gray-700 line-clamp-2 pr-6">
                          {item.topic}
                        </p>
                        <button 
                          onClick={(e) => deleteHistoryItem(e, item.id)}
                          className="absolute top-3 right-3 p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                        </button>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                        <div className="flex items-center gap-2 text-gray-400">
                          <Clock className="w-3 h-3" />
                          {new Date(item.timestamp).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Viral Booster Section (Mobile Only) */}
            <AnimatePresence>
              {activeTab === 'preview' && booster && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="lg:hidden bg-gradient-to-br from-indigo-600 to-violet-600 p-6 sm:p-8 rounded-[24px] sm:rounded-[32px] shadow-[0_20px_40px_rgba(79,70,229,0.2)] text-white space-y-6"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black uppercase tracking-widest leading-tight">Viral Booster</h3>
                      <p className="text-white/70 text-[10px] font-medium">Optimalkan jangkauan</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/10 space-y-3">
                      <div className="flex items-center gap-2 text-white/60 text-[9px] font-black uppercase tracking-widest">
                        <MousePointer2 className="w-2.5 h-2.5" />
                        Hook Alternatif
                      </div>
                      <div className="space-y-3">
                        {booster.hooks?.map((hook, i) => (
                          <div key={i} className="flex gap-3 group/hook">
                            <div className="w-6 h-6 bg-white/20 rounded flex items-center justify-center font-black text-[10px] shrink-0">
                              {i + 1}
                            </div>
                            <p className="text-[11px] font-medium leading-relaxed flex-1">
                              {hook}
                            </p>
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(hook);
                                showToast('Hook disalin!');
                              }}
                              className="p-1.5 bg-white/10 hover:bg-white/30 rounded transition-all self-start"
                            >
                              <Copy className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {activeTab === 'preview' && (
              <div className="space-y-8 sm:space-y-16 relative">
                <AnimatePresence mode="popLayout">
                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-red-50 border-2 border-red-100 p-5 sm:p-6 rounded-2xl sm:rounded-3xl text-red-600 font-bold flex flex-col gap-4"
                    >
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="bg-red-100 p-2 rounded-lg sm:rounded-xl">
                          <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        <span className="text-sm sm:text-base">{error}</span>
                      </div>
                      {error.includes("API Key") && (
                        <button 
                          onClick={handleOpenKeySelection}
                          className="w-full py-3 bg-red-600 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-red-700 transition-all flex items-center justify-center gap-2"
                        >
                          <Wrench className="w-4 h-4" /> Perbaiki API Key
                        </button>
                      )}
                    </motion.div>
                  )}

                  {thread.length === 0 && !isGenerating && !error && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="bg-white p-12 sm:p-20 rounded-[32px] sm:rounded-[40px] border-4 border-dashed border-gray-100 flex flex-col items-center justify-center text-center space-y-4 sm:space-y-6"
                    >
                      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-50 rounded-[24px] sm:rounded-[32px] flex items-center justify-center">
                        <BrainCircuit className="w-8 h-8 sm:w-10 sm:h-10 text-gray-200" />
                      </div>
                      <div className="space-y-1 sm:space-y-2">
                        <p className="text-lg sm:text-xl font-bold text-gray-400">Siap Viral?</p>
                        <p className="text-sm sm:text-base text-gray-300 font-medium">Isi detail di samping dan biarkan keajaiban terjadi.</p>
                      </div>
                    </motion.div>
                  )}

                  {/* Version A Display */}
                  {(thread.length > 0 || isGenerating) && (
                    <div className="space-y-8">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black">A</div>
                          <div>
                            <h2 className="text-lg font-bold">Versi A (Original)</h2>
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-gray-400">Gaya penulisan standar ThreadGen</p>
                              {viralScore && (
                                <div className="flex flex-col gap-1.5">
                                  <div className="flex items-center gap-2 px-3 py-1 bg-green-50 rounded-full border border-green-100 shadow-sm">
                                    <TrendingUp className="w-3 h-3 text-green-600" />
                                    <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">Viral Score: {viralScore}%</span>
                                  </div>
                                  <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                                    <motion.div 
                                      initial={{ width: 0 }}
                                      animate={{ width: `${viralScore}%` }}
                                      className="h-full bg-gradient-to-r from-green-400 to-green-600"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        {thread.length > 0 && (
                          <div className="flex gap-2">
                            <button 
                              onClick={() => {
                                const allText = thread.map((t, i) => `${i + 1}/ ${t}`).join('\n\n');
                                navigator.clipboard.writeText(allText);
                                showToast('Versi A disalin (dengan nomor)!');
                              }}
                              className="hidden sm:block text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg transition-all"
                            >
                              Copy with Numbers
                            </button>
                            <button 
                              onClick={() => {
                                const allText = thread.join('\n\n');
                                navigator.clipboard.writeText(allText);
                                showToast('Seluruh Versi A disalin!');
                              }}
                              className="text-xs font-black uppercase tracking-widest bg-indigo-600 text-white hover:bg-indigo-700 px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-500/20"
                            >
                              Copy All
                            </button>
                          </div>
                        )}
                      </div>

                      {isGenerating ? (
                        <div className="space-y-6">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="bg-white p-8 rounded-[32px] border border-gray-100 animate-pulse">
                              <div className="h-4 bg-gray-50 rounded-full w-3/4 mb-4"></div>
                              <div className="h-4 bg-gray-50 rounded-full w-1/2"></div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-12">
                          {thread.map((tweet, index) => (
                            <motion.div 
                              key={index}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: index * 0.05 }}
                              className="bg-white p-6 sm:p-8 rounded-[24px] sm:rounded-[32px] shadow-[0_4px_20px_rgb(0,0,0,0.02)] border border-gray-100 group relative hover:border-indigo-600/30 transition-all"
                            >
                              <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 z-10">
                                <button 
                                  onClick={() => {
                                    copyToClipboard(tweet, index);
                                    showToast(`Tweet ${index + 1} disalin!`);
                                  }}
                                  className={`min-w-[44px] min-h-[44px] flex items-center justify-center gap-2 px-4 rounded-xl sm:rounded-2xl transition-all shadow-lg ${
                                    copiedIndex === index 
                                      ? 'bg-green-500 text-white' 
                                      : 'bg-indigo-600 text-white hover:scale-105 active:scale-95'
                                  }`}
                                >
                                  {copiedIndex === index ? (
                                    <>
                                      <Check className="w-4 h-4" />
                                      <span className="text-[10px] font-black uppercase tracking-widest">Tersalin!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-4 h-4" />
                                      <span className="text-[10px] font-black uppercase tracking-widest">Salin</span>
                                    </>
                                  )}
                                </button>
                              </div>
                              
                              <div className="flex gap-4 sm:gap-6">
                                <div className="flex flex-col items-center gap-2 sm:gap-3">
                                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-50 rounded-xl sm:rounded-2xl flex items-center justify-center font-black text-gray-300 text-base sm:text-lg">
                                    {index + 1}
                                  </div>
                                  {index < thread.length - 1 && (
                                    <div className="w-[1.5px] sm:w-[2px] flex-1 bg-gradient-to-b from-gray-100 to-transparent rounded-full"></div>
                                  )}
                                </div>
                                <div className="flex-1 pt-1 sm:pt-2 pb-12 sm:pb-0">
                                  <p className="whitespace-pre-wrap text-[15px] sm:text-[18px] md:text-[19px] leading-[1.8] text-gray-800 font-medium tracking-tight">
                                    {tweet}
                                  </p>

                                  {index === 0 && (coverImage || isGeneratingImage) && (
                                    <div className="mt-6 rounded-2xl overflow-hidden border border-gray-100 bg-gray-50 aspect-square max-w-[400px]">
                                      {isGeneratingImage ? (
                                        <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-gray-400">
                                          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                                          <span className="text-[10px] font-black uppercase tracking-widest animate-pulse">Meracik Visual...</span>
                                        </div>
                                      ) : (
                                        <img 
                                          src={coverImage!} 
                                          alt="Thread Cover" 
                                          className="w-full h-full object-cover"
                                          referrerPolicy="no-referrer"
                                        />
                                      )}
                                    </div>
                                  )}

                                  <div className="mt-6 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">
                                        {tweet.length} Karakter
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Version B Display (A/B Test) */}
                  {(threadB.length > 0 || isGeneratingB) && (
                    <div className="mt-12 sm:mt-20 pt-12 sm:pt-20 border-t border-gray-100 space-y-8">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white font-black">B</div>
                          <div>
                            <h2 className="text-lg font-bold">Versi B (Alternatif)</h2>
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-gray-400">Gaya penulisan lebih eksperimental</p>
                              {viralScoreB && (
                                <div className="flex flex-col gap-1.5">
                                  <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 rounded-full border border-amber-100 shadow-sm">
                                    <TrendingUp className="w-3 h-3 text-amber-600" />
                                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Viral Score: {viralScoreB}%</span>
                                  </div>
                                  <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                                    <motion.div 
                                      initial={{ width: 0 }}
                                      animate={{ width: `${viralScoreB}%` }}
                                      className="h-full bg-gradient-to-r from-amber-400 to-amber-600"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        {threadB.length > 0 && (
                          <div className="flex gap-2">
                            <button 
                              onClick={() => {
                                const allText = threadB.map((t, i) => `${i + 1}/ ${t}`).join('\n\n');
                                navigator.clipboard.writeText(allText);
                                showToast('Versi B disalin (dengan nomor)!');
                              }}
                              className="hidden sm:block text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-amber-600 hover:bg-amber-50 px-4 py-2 rounded-lg transition-all"
                            >
                              Copy with Numbers
                            </button>
                            <button 
                              onClick={() => {
                                const allText = threadB.join('\n\n');
                                navigator.clipboard.writeText(allText);
                                showToast('Seluruh Versi B disalin!');
                              }}
                              className="text-xs font-black uppercase tracking-widest bg-amber-500 text-white hover:bg-amber-600 px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-amber-500/20"
                            >
                              Copy All
                            </button>
                          </div>
                        )}
                      </div>

                      {isGeneratingB ? (
                        <div className="space-y-6">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="bg-white p-8 rounded-[32px] border border-gray-100 animate-pulse">
                              <div className="h-4 bg-gray-50 rounded-full w-3/4 mb-4"></div>
                              <div className="h-4 bg-gray-50 rounded-full w-1/2"></div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-12">
                          {threadB.map((tweet, index) => (
                            <motion.div 
                              key={index}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: index * 0.05 }}
                              className="bg-white p-6 sm:p-8 rounded-[24px] sm:rounded-[32px] shadow-[0_4px_20px_rgb(0,0,0,0.02)] border border-gray-100 group relative hover:border-amber-600/30 transition-all"
                            >
                              <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 z-10">
                                <button 
                                  onClick={() => {
                                    navigator.clipboard.writeText(tweet);
                                    showToast(`Tweet ${index + 1} Versi B disalin!`);
                                  }}
                                  className="min-w-[44px] min-h-[44px] flex items-center justify-center gap-2 px-4 rounded-xl sm:rounded-2xl transition-all shadow-lg bg-amber-500 text-white hover:scale-105 active:scale-95"
                                >
                                  <Copy className="w-4 h-4" />
                                  <span className="text-[10px] font-black uppercase tracking-widest">Salin</span>
                                </button>
                              </div>
                              
                              <div className="flex gap-4 sm:gap-6">
                                <div className="flex flex-col items-center gap-2 sm:gap-3">
                                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-amber-50 rounded-xl sm:rounded-2xl flex items-center justify-center font-black text-amber-300 text-base sm:text-lg">
                                    {index + 1}
                                  </div>
                                  {index < threadB.length - 1 && (
                                    <div className="w-[1.5px] sm:w-[2px] flex-1 bg-gradient-to-b from-amber-100 to-transparent rounded-full"></div>
                                  )}
                                </div>
                                <div className="flex-1 pt-1 sm:pt-2 pb-12 sm:pb-0">
                                  <p className="whitespace-pre-wrap text-[15px] sm:text-[18px] md:text-[19px] leading-[1.8] text-gray-800 font-medium tracking-tight">
                                    {tweet}
                                  </p>

                                  <div className="mt-6 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">
                                        {tweet.length} Karakter
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </AnimatePresence>

              {/* Bottom History Section (Visible after generation) */}
              {history.length > 0 && thread.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-12 sm:mt-20 pt-12 sm:pt-20 border-t border-gray-100"
                >
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                        <History className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold">Riwayat Terakhir</h2>
                        <p className="text-xs text-gray-400">Akses cepat ke thread sebelumnya</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {history.slice(0, 4).map((item) => (
                      <div 
                        key={item.id}
                        onClick={() => {
                          loadFromHistory(item);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="group p-4 sm:p-5 bg-white hover:bg-gray-50 rounded-[24px] cursor-pointer transition-all border border-gray-100 hover:border-indigo-600/30 shadow-[0_4px_20px_rgb(0,0,0,0.02)] relative"
                      >
                        <div className="flex justify-between items-start gap-4">
                          <p className="text-sm font-bold text-gray-700 line-clamp-2">
                            {item.topic}
                          </p>
                          <div className="p-2 bg-gray-50 group-hover:bg-indigo-50 rounded-lg transition-all">
                            <Zap className="w-3 h-3 text-gray-300 group-hover:text-indigo-600" />
                          </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                          <div className="flex items-center gap-2 text-gray-400">
                            <Clock className="w-3 h-3" />
                            {new Date(item.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                          </div>
                          <span className="text-indigo-600 opacity-0 group-hover:opacity-100 transition-all">Muat Ulang →</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
        )}
      </section>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto px-6 py-20 border-t border-gray-100 text-center space-y-4">
        <div className="flex items-center justify-center gap-2 text-gray-400 font-bold">
          <span>Dibuat dengan</span>
          <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
            ❤️
          </motion.div>
          <span>Ryant Kaya Raya</span>
        </div>
        <p className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-300">Powered by UD KAYA RAYA</p>
      </footer>
    </div>
  );
}
