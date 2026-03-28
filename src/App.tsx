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
  LogIn
} from 'lucide-react';
import type { ThreadParams, ViralBooster } from './services/gemini';
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
    tone: 'SANTAI',
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
  const [trendingTimestamp, setTrendingTimestamp] = useState<number | null>(null);
  const [isFetchingTrending, setIsFetchingTrending] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'history'>('preview');

  const fetchTrendingTopics = async () => {
    setIsFetchingTrending(true);
    try {
      const response = await fetch('/api/trending-topics');
      if (!response.ok) {
        let errMsg = "Gagal mengambil trending topics.";
        try {
          const errData = await response.json();
          errMsg = errData.error || errMsg;
        } catch (e) {
          errMsg = `Server Error (${response.status})`;
        }
        throw new Error(errMsg);
      }

      const data = await response.json();
      if (data.topics && data.topics.length > 0) {
        setTrendingTopics(data.topics);
        setTrendingTimestamp(Date.now());
      } else {
        setTrendingTopics(["Ketik topik manual di bawah ya 🙏"]);
        setTrendingTimestamp(null);
      }
    } catch (err) {
      console.error("Fetch trending error:", err);
      setTrendingTopics(["Ketik topik manual di bawah ya 🙏"]);
      setTrendingTimestamp(null);
    } finally {
      setIsFetchingTrending(false);
    }
  };

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

  const handleGenerate = async () => {
    if (!params.topic) return;

    setIsGenerating(true);
    setIsGeneratingImage(false);
    setError(null);
    setBooster(null);
    setCoverImage(null);
    
    try {
      const prompt = `BUAT UTAS TWITTER/X TENTANG: ${params.topic}. 
PENTING: Setelah tweet pertama (1/), tambahkan tweet kedua (2/) yang berisi rekomendasi produk Shopee yang relevan dengan topik ini.`;

      const response = await fetch('/api/generate-thread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...params, topic: prompt })
      });

      if (!response.ok) {
        let errMsg = 'Gagal generate thread';
        try {
          const errData = await response.json();
          errMsg = errData.error || errMsg;
        } catch (e) {
          errMsg = `Server Error (${response.status}): ${response.statusText}`;
        }
        throw new Error(errMsg);
      }

      const result = await response.json();
      if (result.tweets.length === 0) {
        setError("Gagal meracik thread. Coba ganti topik atau detailnya ya!");
      } else {
        // Look for [GAMBAR]: in the first tweet
        let firstTweet = result.tweets[0];
        const imageMatch = firstTweet.match(/\[GAMBAR\]:\s*(.*)/i);
        
        if (imageMatch) {
          const imagePrompt = imageMatch[1].trim();
          // Remove the [GAMBAR] line from the tweet text
          result.tweets[0] = firstTweet.replace(/\[GAMBAR\]:.*\n?/i, '').trim();
          
          // Start image generation
          generateCoverImage(imagePrompt);
        }

        const sanitizedTweets = (result.tweets || []).map(t => t.trim());
        setThread(sanitizedTweets);
        setBooster(result.booster || null);
        saveToHistory(params.topic, params.length, params.tone, sanitizedTweets, result.booster);
      }
    } catch (err: any) {
      const msg = err.message || 'Terjadi kesalahan sistem';
      setError(`Error: ${msg}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateCoverImage = async (prompt: string) => {
    setIsGeneratingImage(true);
    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      if (!response.ok) {
        let errMsg = 'Gagal generate gambar';
        try {
          const errData = await response.json();
          errMsg = errData.error || errMsg;
        } catch (e) {
          errMsg = `Server Error (${response.status})`;
        }
        throw new Error(errMsg);
      }

      const data = await response.json();
      if (data.image) {
        setCoverImage(`data:image/png;base64,${data.image}`);
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
      <div className="min-h-screen bg-[#0A0A0B] text-white font-sans overflow-x-hidden selection:bg-indigo-600/30">
        {/* Background Glow */}
        <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/5 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-violet-500/5 blur-[120px] rounded-full" />
        </div>

        {/* Navigation */}
        <nav className="relative z-50 max-w-7xl mx-auto px-4 sm:px-6 h-20 sm:h-24 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-1.5 sm:p-2 rounded-lg sm:rounded-xl shadow-lg shadow-indigo-500/20">
              <BrainCircuit className="text-white w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <span className="text-lg sm:text-xl font-black tracking-tighter uppercase">Thread Gen<span className="text-indigo-600">Pro</span></span>
          </div>
          <div className="flex items-center gap-3 sm:gap-6">
            <button 
              onClick={handleGetAccess}
              className="px-4 py-2 sm:px-6 sm:py-2.5 bg-indigo-600 text-white rounded-xl text-xs sm:text-sm font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20"
            >
              <LogIn className="w-3.5 h-3.5 sm:w-4 h-4" /> {hasAccess ? 'Dashboard' : 'Login / Aktivasi'}
            </button>
            {!hasAccess && (
              <a 
                href="https://larisdigi.myscalev.com/threads-gen"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex px-6 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm font-bold hover:bg-white/10 transition-all items-center gap-2"
              >
                <Zap className="w-4 h-4 text-yellow-400" /> Beli Akses
              </a>
            )}
          </div>
        </nav>

        <main className="relative z-10">
          {/* Hero Section */}
          <section className="max-w-7xl mx-auto px-6 pt-12 sm:pt-20 pb-20 sm:pb-32 text-center">
            <motion.div 
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600/10 border border-indigo-600/20 rounded-full text-indigo-600 text-[10px] sm:text-xs font-black uppercase tracking-widest mb-6 sm:mb-8"
            >
              <BrainCircuit className="w-3 h-3" />
              THREAD GEN PRO v10
            </motion.div>
            
            <motion.h1 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-8xl font-black tracking-tighter leading-[0.9] mb-8"
            >
              KONTEN <span className="text-indigo-600">THREADS</span> VIRAL <br />DALAM <span className="text-purple-500">HITUNGAN</span> DETIK.
            </motion.h1>
            
            <motion.p 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-gray-400 text-lg sm:text-xl md:text-2xl max-w-3xl mx-auto leading-relaxed mb-12"
            >
              Berhenti pusing mikir konten. Gunakan asisten kreatif yang dirancang khusus untuk membuat Threads yang punchy, emosional, dan relatable.
            </motion.p>

            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col items-center gap-6"
            >
              <button 
                onClick={handleGetAccess}
                className="group relative px-6 py-4 sm:px-10 sm:py-5 bg-indigo-600 text-white font-black uppercase tracking-widest rounded-2xl text-base sm:text-lg hover:scale-105 transition-all flex items-center gap-3 shadow-[0_0_50px_rgba(79,70,229,0.4)]"
              >
                {hasAccess ? 'MASUK KE DASHBOARD' : 'AMBIL AKSES SEKARANG'}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <div className="flex items-center gap-4 text-gray-500 text-sm font-medium">
                <div className="flex -space-x-2">
                  {[1,2,3,4].map(i => (
                    <img key={i} src={`https://i.pravatar.cc/100?u=${i}`} className="w-8 h-8 rounded-full border-2 border-[#0A0A0B]" referrerPolicy="no-referrer" />
                  ))}
                </div>
                <span>Bergabung dengan 5,200+ Creators</span>
              </div>
            </motion.div>
          </section>

          {/* Detailed Features Section */}
          <section className="py-16 sm:py-24 md:py-32 bg-white/[0.01]">
            <div className="max-w-7xl mx-auto px-6">
              <div className="text-center mb-12 sm:mb-20">
                <h2 className="text-2xl sm:text-4xl md:text-5xl font-black mb-4 sm:mb-6">FITUR UNGGULAN KAMI</h2>
                <p className="text-gray-400 text-sm sm:text-lg max-w-2xl mx-auto">Dirancang khusus untuk kamu yang ingin membangun personal brand kuat di media sosial.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
                {[
                  { icon: Globe, title: "Multi-Platform", desc: "Satu kali generate, konten langsung siap untuk X dan Threads sekaligus." },
                  { icon: ShieldCheck, title: "100% Anti-AI", desc: "Gaya bahasa sangat manusiawi, menggunakan slang yang tepat, dan emosional." },
                  { icon: MessageCircle, title: "Anti-Ghosting V4", desc: "Teknik khusus untuk memancing interaksi dan memastikan thread kamu ramai reply." },
                  { icon: Flame, title: "Roast Mode V5", desc: "Analisis tajam untuk konten yang kurang perform. Paste teksnya, kami perbaiki." },
                  { icon: Split, title: "A/B Testing V11", desc: "Bandingkan dua versi konten dan temukan mana yang lebih berpotensi viral." },
                  { icon: Users, title: "Collab Mode V15", desc: "Buat konten kolaborasi dengan kreator lain dalam satu alur cerita yang kuat." },
                  { icon: TrendingUp, title: "Growth Analytics", desc: "Struktur thread yang didesain untuk memaksimalkan retweet dan share." },
                  { icon: Smartphone, title: "Mobile Optimized", desc: "Tampilan dashboard yang sangat responsif, kerja dari mana saja." },
                  { icon: Lock, title: "Secure Access", desc: "Sistem login aman dengan kode akses eksklusif untuk setiap member." },
                  { icon: MessageCircle, title: "Priority Support", desc: "Butuh bantuan? Tim kami siap membantu langsung via Dashboard." },
                  { icon: Zap, title: "Instant Result", desc: "Tidak perlu menunggu lama, hasil keluar dalam hitungan detik." }
                ].map((feature, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 p-6 sm:p-8 rounded-[24px] sm:rounded-[32px] hover:bg-white/10 transition-all group">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-600/10 rounded-xl sm:rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                      <feature.icon className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3">{feature.title}</h3>
                    <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">{feature.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Problem Section */}
          <section className="bg-white/[0.02] py-16 sm:py-24 md:py-32 border-y border-white/5">
            <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-12 sm:gap-20 items-center">
              <div className="space-y-6 sm:space-y-8">
                <h2 className="text-2xl sm:text-4xl md:text-5xl font-black leading-tight">
                  KENAPA THREAD KAMU <span className="text-red-500">GAK PERNAH</span> VIRAL?
                </h2>
                <div className="space-y-4 sm:space-y-6">
                  {[
                    "Hook yang membosankan & gak bikin orang berhenti scroll.",
                    "Struktur berantakan yang bikin pembaca pusing.",
                    "Bahasa kaku kayak robot (AI banget).",
                    "Gak tahu cara 'soft sell' produk yang bener."
                  ].map((text, i) => (
                    <div key={i} className="flex items-start gap-3 sm:gap-4">
                      <div className="mt-1 w-4 h-4 sm:w-5 sm:h-5 bg-red-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-red-500 rounded-full" />
                      </div>
                      <p className="text-gray-400 text-base sm:text-lg">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-600/20 blur-[100px] rounded-full" />
                <div className="relative bg-white/5 border border-white/10 p-8 rounded-[40px] backdrop-blur-xl">
                  <div className="space-y-4">
                    <div className="h-4 bg-white/10 rounded-full w-3/4" />
                    <div className="h-4 bg-white/10 rounded-full w-full" />
                    <div className="h-4 bg-white/10 rounded-full w-2/3" />
                    <div className="pt-8 space-y-4">
                      <div className="h-20 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center text-red-400 font-bold italic">
                        "Thread ini membosankan..."
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Solution / How it Works */}
          <section className="py-16 sm:py-24 md:py-32">
            <div className="max-w-7xl mx-auto px-6">
              <div className="text-center mb-12 sm:mb-20 space-y-3 sm:space-y-4">
                <h2 className="text-2xl sm:text-4xl md:text-6xl font-black">3 LANGKAH MENUJU VIRAL</h2>
                <p className="text-gray-400 text-base sm:text-xl">Proses yang sangat simpel, hasil yang sangat brutal.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12">
                {[
                  { step: "01", title: "Input Ide", desc: "Masukkan topik atau poin-poin kasar yang ada di kepala kamu." },
                  { step: "02", title: "AI Magic", desc: "Mesin kami meracik hook, storytelling, dan teknik Anti-Ghosting." },
                  { step: "03", title: "Copy & Viral", desc: "Salin hasilnya, posting, dan lihat engagement kamu meledak." }
                ].map((item, i) => (
                  <div key={i} className="relative group">
                    <div className="text-6xl sm:text-8xl font-black text-white/5 absolute -top-6 sm:-top-10 -left-2 sm:-left-4 group-hover:text-indigo-600/10 transition-colors">{item.step}</div>
                    <div className="relative space-y-3 sm:space-y-4">
                      <h3 className="text-xl sm:text-2xl font-bold">{item.title}</h3>
                      <p className="text-gray-400 text-sm sm:text-base leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Testimonials Section */}
          <section className="py-16 sm:py-24 md:py-32 bg-white/[0.01]">
            <div className="max-w-7xl mx-auto px-6">
              <div className="text-center mb-12 sm:mb-20">
                <h2 className="text-2xl sm:text-4xl md:text-5xl font-black mb-4 sm:mb-6">APA KATA MEREKA?</h2>
                <p className="text-gray-400 text-sm sm:text-lg max-w-2xl mx-auto italic">"Beneran anti-AI, gak kaku, dan hasilnya gila parah."</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
                {[
                  { 
                    name: "@BudiKreator", 
                    text: "Jujurly, awalnya ragu. Tapi pas nyoba... gila sih. Hook-nya beneran nendang. Thread pertama gue langsung dapet 500+ retweet. Worth it parah cuma 99rb sekali bayar.",
                    avatar: "https://i.pravatar.cc/150?u=budi"
                  },
                  { 
                    name: "@SiskaDigital", 
                    text: "Gak nyangka AI bisa nulis se-manusia ini. Gak kaku sama sekali. Sangat membantu buat gue yang sibuk tapi pengen tetep eksis di X & Threads tanpa pusing mikir.",
                    avatar: "https://i.pravatar.cc/150?u=siska"
                  },
                  { 
                    name: "@AndiTech", 
                    text: "Investasi terbaik tahun ini. Cuma sekali bayar, dapet mesin viral. Gak perlu pusing mikir konten lagi tiap pagi. Langsung copy-paste, engagement meledak!",
                    avatar: "https://i.pravatar.cc/150?u=andi"
                  }
                ].map((testi, i) => (
                  <motion.div 
                    key={i} 
                    whileHover={{ y: -10 }}
                    className="bg-white/5 border border-white/10 p-6 sm:p-8 rounded-[24px] sm:rounded-[32px] space-y-4 sm:space-y-6 relative overflow-hidden group"
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Twitter className="w-8 h-8 sm:w-12 sm:h-12" />
                    </div>
                    <div className="flex items-center gap-3 sm:gap-4">
                      <img src={testi.avatar} className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-indigo-600" referrerPolicy="no-referrer" />
                      <div>
                        <p className="text-sm sm:text-base font-bold">{testi.name}</p>
                        <p className="text-[10px] sm:text-xs text-gray-500">Verified Member</p>
                      </div>
                    </div>
                    <p className="text-gray-300 text-sm sm:text-base leading-relaxed italic">"{testi.text}"</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* Radical Scarcity Offer */}
          <section className="max-w-5xl mx-auto px-6 py-12 sm:py-20">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              className="bg-gradient-to-br from-indigo-600 to-violet-900 rounded-[32px] sm:rounded-[64px] p-8 sm:p-12 md:p-24 text-center relative overflow-hidden shadow-[0_0_120px_rgba(79,70,229,0.4)] border-4 sm:border-8 border-white/10"
            >
              <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-96 h-96 bg-black/30 blur-[120px] rounded-full translate-y-1/2 -translate-x-1/2" />
              
              <div className="relative z-10 flex flex-col items-center space-y-10">
                <motion.div 
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="inline-flex items-center gap-2 px-8 py-3 bg-red-600 text-white font-black uppercase tracking-[0.2em] rounded-full text-sm shadow-xl"
                >
                  <Flame className="w-5 h-5" /> PERINGATAN: SISA {slotsLeft} SLOT TERAKHIR!
                </motion.div>
                
                <h2 className="text-4xl sm:text-5xl md:text-8xl font-black leading-[0.85] tracking-tighter">
                  AMANKAN HARGA <br /><span className="text-yellow-400">PROMO 99RB</span> <br />SEKARANG JUGA!
                </h2>
                
                <div className="flex flex-col items-center gap-2">
                  <p className="text-white/40 text-xl sm:text-3xl font-bold line-through tracking-tighter">Rp 299.000</p>
                  <div className="flex items-center gap-6">
                    <p className="text-5xl sm:text-7xl md:text-9xl font-black text-white drop-shadow-2xl">Rp 99rb</p>
                    <motion.div 
                      animate={{ rotate: [12, 15, 12] }}
                      transition={{ repeat: Infinity, duration: 1 }}
                      className="bg-yellow-400 text-black px-4 py-1 sm:px-6 sm:py-2 rounded-2xl font-black text-xl sm:text-2xl shadow-2xl"
                    >
                      SAVE 67%
                    </motion.div>
                  </div>
                </div>

                <p className="text-white/90 text-lg sm:text-2xl max-w-3xl mx-auto font-bold leading-relaxed">
                  Jangan sampai menyesal. Besok harga <span className="text-red-400 underline decoration-4 underline-offset-8">NAIK 3X LIPAT</span>. Ini adalah kesempatan terakhir kamu untuk akses seumur hidup.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 w-full max-w-3xl">
                  <div className="bg-black/20 backdrop-blur-xl p-8 rounded-[40px] border border-white/10 shadow-inner">
                    <p className="text-white/50 text-xs font-black uppercase tracking-[0.3em] mb-4">Slot Hampir Habis</p>
                    <div className="flex items-end justify-center gap-3">
                      <p className="text-5xl sm:text-7xl font-black text-yellow-400 tabular-nums">{slotsLeft}</p>
                      <p className="text-xl sm:text-2xl font-bold text-white/30 mb-2">/ 100</p>
                    </div>
                    <div className="mt-6 h-4 bg-white/10 rounded-full overflow-hidden p-1">
                      <motion.div 
                        initial={{ width: "0%" }}
                        animate={{ width: `${(slotsLeft / 100) * 100}%` }}
                        className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full shadow-[0_0_20px_rgba(250,204,21,0.5)]"
                      />
                    </div>
                  </div>
                  
                  <div className="bg-black/20 backdrop-blur-xl p-8 rounded-[40px] border border-white/10 shadow-inner">
                    <p className="text-white/50 text-xs font-black uppercase tracking-[0.3em] mb-4">Promo Berakhir Dalam</p>
                    <p className="text-5xl sm:text-7xl font-black font-mono text-white tabular-nums tracking-tighter">{formatTime(timeLeft)}</p>
                    <p className="mt-6 text-[10px] font-black text-red-400 uppercase tracking-[0.5em] animate-pulse">Waktu Hampir Habis!</p>
                  </div>
                </div>

                <div className="pt-12 w-full max-w-2xl">
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleGetAccess}
                    className="group w-full px-8 py-6 sm:px-12 sm:py-10 bg-white text-indigo-600 font-black uppercase tracking-[0.2em] rounded-[30px] sm:rounded-[40px] text-xl sm:text-3xl shadow-[0_30px_100px_rgba(255,255,255,0.4)] flex flex-col items-center gap-2"
                  >
                    <span>{hasAccess ? 'MASUK KE DASHBOARD' : 'SAYA MAU AKSES PRO SEKARANG!'}</span>
                    <span className="text-xs sm:text-sm font-bold opacity-50 tracking-normal normal-case">Klik untuk lanjut ke Aktivasi Aman</span>
                  </motion.button>
                </div>

                <div className="flex flex-wrap justify-center gap-10 pt-12 opacity-50">
                  <div className="flex items-center gap-3 text-sm font-black tracking-widest">
                    <ShieldCheck className="w-5 h-5" /> SECURE CHECKOUT
                  </div>
                  <div className="flex items-center gap-3 text-sm font-black tracking-widest">
                    <Zap className="w-5 h-5" /> INSTANT ACTIVATION
                  </div>
                  <div className="flex items-center gap-3 text-sm font-black tracking-widest">
                    <Users className="w-5 h-5" /> 5,200+ MEMBERS
                  </div>
                </div>
              </div>
            </motion.div>
          </section>

          {/* FAQ Section */}
          <section className="max-w-3xl mx-auto px-6 py-32">
            <h2 className="text-3xl font-black text-center mb-16">PERTANYAAN YANG SERING DIAJUKAN</h2>
            <div className="space-y-6">
              {[
                { q: "Apakah hasilnya beneran gak kayak AI?", a: "Ya! Algoritma kami dirancang khusus untuk meniru gaya bahasa manusia Indonesia yang santai dan relatable." },
                { q: "Bisa buat topik apa aja?", a: "Apapun. Mulai dari tech, finansial, curhat, sampai jualan produk affiliate." },
                { q: "Apakah aman buat akun X & Threads saya?", a: "Sangat aman. Kami hanya membantu meracik konten, kamu tetap yang memposting secara manual." },
                { q: "Bagaimana cara mendapatkan kode akses?", a: "Klik tombol 'Aktivasi' atau 'Ambil Akses Sekarang', lalu beli kode melalui link pembayaran resmi kami. Kode akan dikirim otomatis dan bisa langsung kamu gunakan untuk aktivasi." }
              ].map((faq, i) => (
                <div key={i} className="bg-white/5 border border-white/10 p-8 rounded-3xl space-y-4">
                  <h4 className="text-lg font-bold flex items-center gap-3">
                    <div className="w-2 h-2 bg-indigo-600 rounded-full" />
                    {faq.q}
                  </h4>
                  <p className="text-gray-400 leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Final CTA */}
          <section className="py-16 sm:py-32 text-center border-t border-white/5">
            <h2 className="text-2xl sm:text-4xl md:text-6xl font-black mb-8 sm:mb-12">SIAP JADI RAJA <span className="text-indigo-600">X</span> & <span className="text-purple-500">THREADS</span>?</h2>
            <button 
              onClick={handleGetAccess}
              className="px-8 py-4 sm:px-12 sm:py-6 bg-white text-black font-black uppercase tracking-widest rounded-2xl text-base sm:text-xl hover:bg-gray-200 transition-all"
            >
              {hasAccess ? 'MASUK KE DASHBOARD' : 'AMBIL AKSES SEKARANG'}
            </button>
          </section>
        </main>

        <footer className="max-w-7xl mx-auto px-6 py-20 text-center space-y-4 opacity-50">
          <p className="text-sm font-bold">© 2026 Thread Gen Pro v10. All Rights Reserved.</p>
          <p className="text-[10px] font-black uppercase tracking-[0.5em]">Dibuat dengan ❤️ Ryant Kaya Raya</p>
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
          className="w-full max-w-md bg-white/5 border border-white/10 p-6 sm:p-10 rounded-[32px] sm:rounded-[40px] backdrop-blur-xl space-y-6 sm:space-y-8 relative z-10"
        >
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-500/20">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter">Aktivasi Akses</h2>
            <p className="text-gray-400 text-sm sm:text-base">Masukkan kode akses untuk mulai menggunakan Thread Gen Pro v10</p>
          </div>

          <form onSubmit={handleVerifyCode} className="space-y-6">
            <input 
              type="text" 
              required
              placeholder="KODE-AKSES-ANDA"
              className="w-full px-4 py-6 bg-white/5 border border-white/10 rounded-2xl focus:border-amber-500 outline-none transition-all font-black text-center text-xl sm:text-2xl tracking-[0.3em] uppercase placeholder:tracking-normal placeholder:font-medium placeholder:text-lg"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
            />

            <button 
              type="submit"
              className="w-full py-4 bg-amber-500 text-white font-black uppercase tracking-widest rounded-2xl hover:scale-[1.02] transition-all shadow-lg shadow-amber-500/20"
            >
              Aktivasi Sekarang
            </button>
          </form>

          <div className="bg-amber-500/10 border border-amber-500/20 p-6 rounded-3xl space-y-4">
            <div className="space-y-1">
              <p className="text-xs font-black uppercase tracking-widest text-amber-500">Belum punya kode?</p>
              <p className="text-sm text-gray-400 leading-relaxed">
                Dapatkan kode akses eksklusif kamu melalui link pembayaran resmi kami di bawah ini:
              </p>
            </div>
            <a 
              href="https://larisdigi.myscalev.com/threads-gen"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white text-base font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-3 transition-all shadow-lg shadow-amber-500/20"
            >
              BELI KODE AKSES SEKARANG <ArrowRight className="w-5 h-5" />
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 cursor-pointer" onClick={() => setView('landing')}>
            <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-2 sm:p-2.5 rounded-lg sm:rounded-xl shadow-lg shadow-indigo-100">
              <BrainCircuit className="text-white w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <span className="text-lg sm:text-xl font-black tracking-tighter uppercase">Thread Gen<span className="text-indigo-600">Pro</span></span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden sm:flex flex-col items-end mr-2">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</span>
              <span className="text-xs font-bold text-indigo-600">PRO MEMBER</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <button 
                onClick={handleLogout}
                className="p-2 sm:p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg sm:rounded-xl transition-all"
                title="Logout"
              >
                <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button 
                onClick={reset}
                className="p-2 sm:p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg sm:rounded-xl transition-all"
                title="Reset All"
              >
                <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-10">
          {/* Left Column: Form & History (Desktop) */}
          <aside className="lg:col-span-4 space-y-6 sm:space-y-8">
            <div className="bg-white p-6 sm:p-8 rounded-[24px] sm:rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
              <div className="flex items-center gap-3 mb-6 sm:mb-8">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold">Asisten Utas Santai</h2>
                  <p className="text-xs sm:text-sm text-gray-400">Nulis Utas Jadi Lebih Personal</p>
                </div>
              </div>

              <div className="space-y-4 sm:space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">Topik Trending</label>
                      <div className="flex items-center gap-1 px-1.5 py-0.5 bg-green-500/10 border border-green-500/20 rounded-full">
                        <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-[8px] font-black text-green-600 uppercase tracking-widest">Real-time</span>
                      </div>
                    </div>
                    <button 
                      onClick={fetchTrendingTopics}
                      disabled={isFetchingTrending}
                      className="text-[10px] sm:text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors disabled:opacity-50"
                    >
                      {isFetchingTrending ? <Loader2 className="w-3 h-3 animate-spin" /> : <TrendingUp className="w-3 h-3" />}
                      Cari Topik Trending
                    </button>
                  </div>
                  
                  {trendingTopics.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {trendingTopics.map((topic, i) => (
                          topic === "Ketik topik manual di bawah ya 🙏" ? (
                            <div key={i} className="px-3 py-1.5 bg-gray-50 text-gray-500 text-[10px] font-medium rounded-full border border-gray-100 italic">
                              {topic}
                            </div>
                          ) : (
                            <button
                              key={i}
                              onClick={() => setParams({ ...params, topic })}
                              className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full hover:bg-indigo-100 transition-colors border border-indigo-100"
                            >
                              {topic}
                            </button>
                          )
                        ))}
                      </div>
                      {trendingTimestamp && (
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-400 ml-1">
                          <Clock className="w-3 h-3" />
                          <span>Data diperbarui: {new Date(trendingTimestamp).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} WIB</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">Bahan Konten</label>
                  <textarea 
                    placeholder="Contoh: 'roast ini [paste]', 'A/B test ini [paste A & B]', atau 'buatin konten collab sama @kreator'..."
                    className="w-full p-3 sm:p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-xl sm:rounded-2xl transition-all min-h-[100px] sm:min-h-[120px] resize-none outline-none font-medium placeholder:text-gray-300 text-sm sm:text-base"
                    value={params.topic}
                    onChange={(e) => setParams({...params, topic: e.target.value})}
                  />
                </div>

                <button 
                  onClick={handleGenerate}
                  disabled={isGenerating || !params.topic}
                  className="w-full py-4 sm:py-5 bg-indigo-600 text-white font-black uppercase tracking-widest rounded-xl sm:rounded-2xl shadow-[0_20px_40px_rgba(79,70,229,0.2)] hover:shadow-[0_20px_40px_rgba(79,70,229,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 disabled:shadow-none flex items-center justify-center gap-3 text-sm sm:text-base"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5 fill-current" />
                      Generate Thread
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* History Section (Desktop Only) */}
            {history.length > 0 && (
              <div className="hidden lg:block bg-white p-6 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center">
                    <History className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold">Riwayat</h2>
                    <p className="text-[10px] text-gray-400">Thread sebelumnya</p>
                  </div>
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {history.map((item) => (
                    <div 
                      key={item.id}
                      onClick={() => loadFromHistory(item)}
                      className="group p-3 bg-gray-50 hover:bg-gray-100 rounded-xl cursor-pointer transition-all border border-transparent hover:border-gray-200 relative"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <p className="text-[11px] font-medium text-gray-700 line-clamp-2 pr-6">
                          {item.topic}
                        </p>
                        <button 
                          onClick={(e) => deleteHistoryItem(e, item.id)}
                          className="absolute top-2 right-2 p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[9px] font-bold uppercase tracking-wider">
                        <div className="flex items-center gap-2 text-gray-400">
                          <Clock className="w-2.5 h-2.5" />
                          {new Date(item.timestamp).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' })}
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
            <div className="lg:hidden flex bg-white p-1 rounded-2xl border border-gray-100 shadow-sm">
              <button 
                onClick={() => setActiveTab('preview')}
                className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'preview' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-gray-400'}`}
              >
                Preview Utas
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-gray-400'}`}
              >
                Riwayat ({history.length})
              </button>
            </div>

            {/* History Section (Mobile/Tab Only) */}
            {activeTab === 'history' && history.length > 0 && (
              <div className="lg:hidden bg-white p-6 sm:p-8 rounded-[24px] sm:rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
                <div className="flex items-center gap-3 mb-6 sm:mb-8">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                    <History className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold">Riwayat</h2>
                    <p className="text-xs sm:text-sm text-gray-400">Thread yang pernah dibuat</p>
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
              <>
                <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                  <BrainCircuit className="w-5 h-5 text-indigo-600" />
                </div>
                <h2 className="text-lg sm:text-xl font-bold">Preview Utas (X & Threads)</h2>
              </div>
              {thread.length > 0 && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      const allText = thread.map((t, i) => `${i + 1}/ ${t}`).join('\n\n');
                      navigator.clipboard.writeText(allText);
                      showToast('Thread disalin (dengan nomor)!');
                    }}
                    className="hidden sm:block text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg transition-all"
                  >
                    Copy with Numbers
                  </button>
                  <button 
                    onClick={() => {
                      const allText = thread.join('\n\n');
                      navigator.clipboard.writeText(allText);
                      showToast('Seluruh thread disalin!');
                    }}
                    className="text-xs font-black uppercase tracking-widest bg-indigo-600 text-white hover:bg-indigo-700 px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-500/20"
                  >
                    Copy All
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-12 sm:space-y-16 relative">
              <AnimatePresence mode="popLayout">
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-50 border-2 border-red-100 p-6 rounded-3xl text-red-600 font-bold flex items-center gap-4"
                  >
                    <div className="bg-red-100 p-2 rounded-xl">
                      <Trash2 className="w-5 h-5" />
                    </div>
                    {error}
                  </motion.div>
                )}

                {thread.length === 0 && !isGenerating && !error && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-white p-20 rounded-[40px] border-4 border-dashed border-gray-100 flex flex-col items-center justify-center text-center space-y-6"
                  >
                    <div className="w-20 h-20 bg-gray-50 rounded-[32px] flex items-center justify-center">
                      <BrainCircuit className="w-10 h-10 text-gray-200" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xl font-bold text-gray-400">Siap Viral?</p>
                      <p className="text-gray-300 font-medium">Isi detail di samping dan biarkan keajaiban terjadi.</p>
                    </div>
                  </motion.div>
                )}

                {isGenerating && (
                  <div className="space-y-6">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="bg-white p-8 rounded-[32px] border border-gray-100 animate-pulse">
                        <div className="h-4 bg-gray-50 rounded-full w-3/4 mb-4"></div>
                        <div className="h-4 bg-gray-50 rounded-full w-1/2"></div>
                      </div>
                    ))}
                  </div>
                )}

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
                        <p className="whitespace-pre-wrap text-[16px] sm:text-[19px] leading-[1.8] text-gray-800 font-medium tracking-tight">
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
              </AnimatePresence>

              {/* Bottom History Section (Visible after generation) */}
              {history.length > 0 && thread.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-20 pt-20 border-t border-gray-100"
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
                        className="group p-5 bg-white hover:bg-gray-50 rounded-[24px] cursor-pointer transition-all border border-gray-100 hover:border-indigo-600/30 shadow-[0_4px_20px_rgb(0,0,0,0.02)] relative"
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
          </>
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
