/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component, useState, useEffect, useMemo } from 'react';
import { 
  auth, 
  db, 
  signInWithGoogle, 
  logout, 
  onAuthStateChanged, 
  User,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  collectionGroup,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  handleFirestoreError,
  OperationType,
  GoogleAuthProvider,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  storage
} from './firebase';
import { 
  BookOpen, 
  CheckCircle2, 
  Clock, 
  LayoutDashboard, 
  LogOut, 
  Plus, 
  Settings, 
  Target, 
  Trash2, 
  TrendingUp,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  Calendar,
  AlertCircle,
  Pencil,
  X,
  Flame,
  Check,
  ChevronLeft,
  Activity,
  Dumbbell,
  Droplets,
  Coffee,
  Moon,
  Sun,
  Brain,
  Heart,
  Music,
  Code,
  PenTool,
  Award,
  Video,
  ExternalLink,
  Paperclip,
  FileText,
  File,
  Download,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { 
  format, 
  subDays, 
  startOfDay, 
  isWithinInterval, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  addMonths,
  subMonths,
  isToday,
  startOfWeek,
  endOfWeek
} from 'date-fns';
import { cn } from './lib/utils';

// --- Icons Map ---
const HABIT_ICONS_MAP: Record<string, React.ReactNode> = {
  Activity: <Activity />,
  Dumbbell: <Dumbbell />,
  Droplets: <Droplets />,
  Coffee: <Coffee />,
  Moon: <Moon />,
  Sun: <Sun />,
  Brain: <Brain />,
  Heart: <Heart />,
  Music: <Music />,
  Code: <Code />,
  PenTool: <PenTool />,
  Target: <Target />,
  BookOpen: <BookOpen />,
  Clock: <Clock />,
  Award: <Award />
};

// --- Types ---
interface Subject {
  id: string;
  name: string;
  color: string;
  createdAt: any;
}

interface Topic {
  id: string;
  subjectId: string;
  name: string;
  status: 'not-started' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  notes?: string;
  attachments?: {
    name: string;
    url: string;
    type: string;
    size: number;
    createdAt: any;
  }[];
  updatedAt: any;
}

interface StudySession {
  id: string;
  topicId: string;
  subjectId: string;
  durationMinutes: number;
  startTime: any;
  notes?: string;
}

interface Habit {
  id: string;
  uid: string;
  name: string;
  icon: string;
  color: string;
  createdAt: any;
}

interface HabitLog {
  id: string;
  uid: string;
  habitId: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
}

// --- Components ---

const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<any>(null);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h2>
          <p className="text-gray-600 mb-6 text-sm">
            {error?.message || "An unexpected error occurred. Please try refreshing the page."}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div onError={(e) => { 
      // Only catch media errors if they are not handled by the element itself
      if (e.target instanceof HTMLImageElement && e.target.src.includes('logo.png')) {
        return;
      }
      setHasError(true); 
      setError(e); 
    }}>
      {children}
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'subjects' | 'timer' | 'habits' | 'calendar'>('dashboard');
  
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(localStorage.getItem('google_access_token'));
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);
  const [calendarSyncError, setCalendarSyncError] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
  
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const [isAddingTopic, setIsAddingTopic] = useState(false);

  const toggleHabit = async (habitId: string, date: string) => {
    if (!user) return;
    const existingLog = habitLogs.find(l => l.habitId === habitId && l.date === date);
    try {
      if (existingLog) {
        await updateDoc(doc(db, 'users', user.uid, 'habitLogs', existingLog.id), {
          completed: !existingLog.completed
        });
      } else {
        await addDoc(collection(db, 'users', user.uid, 'habitLogs'), {
          habitId,
          date,
          completed: true,
          uid: user.uid
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/habitLogs`);
    }
  };

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // Ensure user document exists
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: user.uid,
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            createdAt: serverTimestamp(),
            role: 'user'
          });
        }
      } else {
        setGoogleAccessToken(null);
        localStorage.removeItem('google_access_token');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      const result = await signInWithGoogle();
      // Use GoogleAuthProvider to get the credential from the result
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;
      
      if (token) {
        setGoogleAccessToken(token);
        localStorage.setItem('google_access_token', token);
        console.log("Google Access Token successfully captured.");
      } else {
        console.warn("No access token found in Google login result.");
      }
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const fetchCalendarEvents = async () => {
    if (!googleAccessToken) return;
    setIsSyncingCalendar(true);
    setCalendarSyncError(null);
    try {
      // Fetch events from 3 months ago to 1 year in the future to ensure the calendar is well-populated
      const rangeStart = subMonths(new Date(), 3);
      rangeStart.setHours(0, 0, 0, 0);
      
      const rangeEnd = addMonths(new Date(), 12);
      rangeEnd.setHours(23, 59, 59, 999);
      
      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${rangeStart.toISOString()}&timeMax=${rangeEnd.toISOString()}&orderBy=startTime&singleEvents=true&maxResults=2500`, {
        headers: {
          'Authorization': `Bearer ${googleAccessToken}`
        }
      });
      
      if (response.status === 401) {
        console.error("Calendar API: Unauthorized. Token might be expired.");
        setGoogleAccessToken(null);
        localStorage.removeItem('google_access_token');
        setIsSyncingCalendar(false);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Calendar API Error:", errorData);
        setCalendarSyncError(errorData.error?.message || "Failed to fetch calendar events. Please ensure the Google Calendar API is enabled and you have granted the necessary permissions.");
        setIsSyncingCalendar(false);
        return;
      }

      const data = await response.json();
      console.log(`Fetched ${data.items?.length || 0} calendar events from ${rangeStart.toLocaleDateString()} to ${rangeEnd.toLocaleDateString()}.`);
      setCalendarEvents(data.items || []);
    } catch (error) {
      console.error("Failed to fetch calendar events", error);
      setCalendarSyncError("A network error occurred while syncing your calendar. Please check your connection and try again.");
    } finally {
      setIsSyncingCalendar(false);
    }
  };

  useEffect(() => {
    if (googleAccessToken && user) {
      fetchCalendarEvents();
    }
  }, [googleAccessToken, user]);

  // Data Listeners
  useEffect(() => {
    if (!user) return;

    const subjectsUnsubscribe = onSnapshot(
      collection(db, 'users', user.uid, 'subjects'),
      (snapshot) => {
        setSubjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/subjects`)
    );

    const sessionsUnsubscribe = onSnapshot(
      collection(db, 'users', user.uid, 'sessions'),
      (snapshot) => {
        setSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudySession)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/sessions`)
    );

    const topicsUnsubscribe = onSnapshot(
      query(collectionGroup(db, 'topics'), where('uid', '==', user.uid)),
      (snapshot) => {
        setTopics(snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) } as Topic)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/topics`)
    );

    const habitsUnsubscribe = onSnapshot(
      collection(db, 'users', user.uid, 'habits'),
      (snapshot) => {
        setHabits(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Habit)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/habits`)
    );

    const habitLogsUnsubscribe = onSnapshot(
      collection(db, 'users', user.uid, 'habitLogs'),
      (snapshot) => {
        setHabitLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HabitLog)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/habitLogs`)
    );

    return () => {
      subjectsUnsubscribe();
      sessionsUnsubscribe();
      topicsUnsubscribe();
      habitsUnsubscribe();
      habitLogsUnsubscribe();
    };
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium animate-pulse">Loading your study plan...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-slate-100 text-center"
        >
          <div className="w-24 h-24 bg-[#0a192f] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-slate-200 overflow-hidden">
            <img 
              src="/logo.png" 
              className="w-full h-full object-cover" 
              alt="CHARANTEJP" 
              onError={(e) => {
                (e.target as HTMLImageElement).src = "https://picsum.photos/seed/study/200/200";
              }}
            />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">CHARANTEJP</h1>
          <p className="text-slate-500 mb-8">Master your syllabus with data-driven study tracking.</p>
          
          <button 
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-white border-2 border-slate-100 rounded-2xl font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-200 transition-all active:scale-95"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 flex">
        {/* Sidebar */}
        <aside className="w-20 lg:w-64 bg-white border-r border-slate-200 flex flex-col">
          <div className="p-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-[#0a192f] rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
              <img 
                src="/logo.png" 
                className="w-full h-full object-cover" 
                alt="Logo" 
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://picsum.photos/seed/study/100/100";
                }}
              />
            </div>
            <span className="hidden lg:block font-bold text-xl text-slate-900">CHARANTEJP</span>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-2">
            <SidebarItem 
              icon={<LayoutDashboard />} 
              label="Dashboard" 
              active={activeTab === 'dashboard'} 
              onClick={() => setActiveTab('dashboard')} 
            />
            <SidebarItem 
              icon={<BookOpen />} 
              label="Subjects" 
              active={activeTab === 'subjects'} 
              onClick={() => setActiveTab('subjects')} 
            />
            <SidebarItem 
              icon={<Clock />} 
              label="Study Timer" 
              active={activeTab === 'timer'} 
              onClick={() => setActiveTab('timer')} 
            />
            <SidebarItem 
              icon={<Activity />} 
              label="Habit Tracker" 
              active={activeTab === 'habits'} 
              onClick={() => setActiveTab('habits')} 
            />
            <SidebarItem 
              icon={<Calendar />} 
              label="Calendar" 
              active={activeTab === 'calendar'} 
              onClick={() => setActiveTab('calendar')} 
            />
          </nav>

          <div className="p-4 border-t border-slate-100">
            <button 
              onClick={logout}
              className="w-full flex items-center gap-3 p-3 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden lg:block font-medium">Logout</span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <header className="h-20 bg-white border-bottom border-slate-200 px-8 flex items-center justify-between sticky top-0 z-10">
            <h2 className="text-xl font-bold text-slate-900 capitalize">{activeTab}</h2>
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-900">{user.displayName}</p>
                <p className="text-xs text-slate-500">{user.email}</p>
              </div>
              <img src={user.photoURL || ''} className="w-10 h-10 rounded-full border-2 border-indigo-100" alt="Avatar" />
            </div>
          </header>

          <div className="p-8 max-w-7xl mx-auto">
            <AnimatePresence mode="wait">
              {activeTab === 'dashboard' && (
                <motion.div 
                  key="dashboard"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <DashboardView 
                    subjects={subjects} 
                    sessions={sessions} 
                    topics={topics}
                    habits={habits}
                    habitLogs={habitLogs}
                    toggleHabit={toggleHabit}
                    user={user} 
                    calendarEvents={calendarEvents}
                    isSyncing={isSyncingCalendar}
                    onSync={fetchCalendarEvents}
                    syncError={calendarSyncError}
                  />
                </motion.div>
              )}
              {activeTab === 'subjects' && (
                <motion.div 
                  key="subjects"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <SubjectsView 
                    subjects={subjects} 
                    topics={topics}
                    selectedSubject={selectedSubject}
                    setSelectedSubject={setSelectedSubject}
                    user={user}
                  />
                </motion.div>
              )}
              {activeTab === 'timer' && (
                <motion.div 
                  key="timer"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <TimerView 
                    subjects={subjects} 
                    topics={topics}
                    sessions={sessions}
                    user={user}
                  />
                </motion.div>
              )}
              {activeTab === 'habits' && (
                <motion.div 
                  key="habits"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <HabitsView 
                    habits={habits}
                    habitLogs={habitLogs}
                    toggleHabit={toggleHabit}
                    user={user}
                  />
                </motion.div>
              )}
              {activeTab === 'calendar' && (
                <motion.div 
                  key="calendar"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <CalendarView 
                    events={calendarEvents}
                    isSyncing={isSyncingCalendar}
                    onSync={fetchCalendarEvents}
                    googleAccessToken={googleAccessToken}
                    onLogin={handleLogin}
                    syncError={calendarSyncError}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
      <AlarmSystem calendarEvents={calendarEvents} topics={topics} />
    </ErrorBoundary>
  );
}

// --- Sub-Views ---

function DashboardView({ subjects, sessions, topics, habits, habitLogs, toggleHabit, user, calendarEvents, isSyncing, onSync, syncError }: { 
  subjects: Subject[], 
  sessions: StudySession[], 
  topics: Topic[], 
  habits: Habit[], 
  habitLogs: HabitLog[], 
  toggleHabit: (id: string, date: string) => void,
  user: User,
  calendarEvents: any[],
  isSyncing: boolean,
  onSync: () => void,
  syncError: string | null
}) {
  const stats = useMemo(() => {
    const totalMinutes = sessions.reduce((acc, s) => acc + s.durationMinutes, 0);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    
    // Last 7 days chart data
    const chartData = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      const dayStr = format(date, 'EEE');
      const dayMins = sessions
        .filter(s => {
          const sessionDate = s.startTime instanceof Timestamp ? s.startTime.toDate() : new Date(s.startTime);
          return format(sessionDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
        })
        .reduce((acc, s) => acc + s.durationMinutes, 0);
      return { name: dayStr, minutes: dayMins };
    });

    const completedTopics = topics.filter(t => t.status === 'completed').length;
    const totalTopics = topics.length;
    const overallProgress = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

    // Habit stats
    const today = format(new Date(), 'yyyy-MM-dd');
    const todayLogs = habitLogs.filter(l => l.date === today && l.completed);
    const habitCompletionRate = habits.length > 0 ? Math.round((todayLogs.length / habits.length) * 100) : 0;
    
    const calculateStreak = (habitId: string) => {
      let streak = 0;
      let checkDate = new Date();
      while (true) {
        const dateStr = format(checkDate, 'yyyy-MM-dd');
        const log = habitLogs.find(l => l.habitId === habitId && l.date === dateStr);
        if (log?.completed) {
          streak++;
          checkDate = subDays(checkDate, 1);
        } else {
          if (dateStr === format(new Date(), 'yyyy-MM-dd')) {
            checkDate = subDays(checkDate, 1);
            continue;
          }
          break;
        }
      }
      return streak;
    };

    const maxStreak = habits.length > 0 ? Math.max(...habits.map(h => calculateStreak(h.id))) : 0;

    return { hours, mins, totalMinutes, chartData, completedTopics, totalTopics, overallProgress, habitCompletionRate, maxStreak };
  }, [sessions, topics, habits, habitLogs]);

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard 
          icon={<Clock className="text-indigo-600" />} 
          label="Total Study Time" 
          value={`${stats.hours}h ${stats.mins}m`} 
          subValue="Keep it up!"
        />
        <StatCard 
          icon={<CheckCircle2 className="text-emerald-600" />} 
          label="Topics Completed" 
          value={`${stats.completedTopics}/${stats.totalTopics}`} 
          subValue={`${stats.overallProgress}% overall progress`}
        />
        <StatCard 
          icon={<Activity className="text-amber-600" />} 
          label="Habit Completion" 
          value={`${stats.habitCompletionRate}%`} 
          subValue="Today's progress"
        />
        <StatCard 
          icon={<Flame className="text-orange-600" />} 
          label="Best Streak" 
          value={`${stats.maxStreak} Days`} 
          subValue="Consistency is key"
        />
      </div>

      {/* Calendar Quick View & Recent Habits */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <Calendar className="w-5 h-5 text-indigo-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Upcoming Events</h2>
            </div>
            <button 
              onClick={onSync}
              disabled={isSyncing}
              className={cn(
                "p-2 rounded-lg transition-all",
                isSyncing ? "bg-slate-100 text-slate-400" : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
              )}
              title="Sync Calendar"
            >
              <RotateCcw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
            </button>
          </div>
          
          <div className="space-y-4">
            {syncError && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-red-900">Sync Error</p>
                  <p className="text-xs text-red-700 mt-1">{syncError}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <button 
                      onClick={onSync}
                      className="text-xs font-bold text-red-600 hover:text-red-700 underline"
                    >
                      Try Again
                    </button>
                    <button 
                      onClick={() => {
                        localStorage.removeItem('google_access_token');
                        window.location.reload();
                      }}
                      className="text-xs font-bold text-red-600 hover:text-red-700 underline"
                    >
                      Re-authorize
                    </button>
                  </div>
                </div>
              </div>
            )}
            {calendarEvents.length > 0 ? (
              calendarEvents.slice(0, 3).map((event: any) => {
                const start = event.start?.dateTime || event.start?.date;
                const isExam = event.summary?.toLowerCase().includes('exam') || 
                              event.summary?.toLowerCase().includes('test');
                
                return (
                  <div key={event.id} className={`p-4 rounded-2xl border ${isExam ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'} flex items-center justify-between`}>
                    <div className="flex-1">
                      <h3 className={`font-semibold ${isExam ? 'text-red-900' : 'text-slate-900'}`}>
                        {event.summary}
                      </h3>
                      <p className="text-sm text-slate-500">
                        {start ? format(new Date(start), 'PPP p') : 'No date set'}
                      </p>
                      {event.hangoutLink && (
                        <a 
                          href={event.hangoutLink} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg transition-colors"
                        >
                          <Video className="w-3 h-3" />
                          Join Google Meet
                        </a>
                      )}
                    </div>
                    {isExam && (
                      <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full uppercase tracking-wider shrink-0 ml-4">
                        Exam
                      </span>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-slate-500">No upcoming events synced.</p>
                <p className="text-xs text-slate-400 mt-1">Check the Calendar tab to sync.</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <Flame className="w-5 h-5 text-emerald-600" />
            </div>
            Recent Habits
          </h2>
          <div className="space-y-4">
            {habits.slice(0, 4).map(habit => {
              const today = format(new Date(), 'yyyy-MM-dd');
              const isDone = habitLogs.some(log => log.habitId === habit.id && log.date === today && log.completed);
              return (
                <div key={habit.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                  <span className="text-slate-700 font-medium">{habit.name}</span>
                  <button
                    onClick={() => toggleHabit(habit.id, today)}
                    className={`p-2 rounded-lg transition-colors ${
                      isDone ? 'bg-emerald-500 text-white' : 'bg-white text-slate-300 border border-slate-200'
                    }`}
                  >
                    <CheckCircle2 className="w-5 h-5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Weekly Activity */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            Weekly Activity
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="minutes" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Today's Habits */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-amber-600" />
            Today's Habits
          </h3>
          <div className="space-y-3">
            {habits.length === 0 ? (
              <p className="text-slate-400 text-center py-12">No habits tracked yet.</p>
            ) : (
              habits.map(habit => {
                const today = format(new Date(), 'yyyy-MM-dd');
                const isCompleted = habitLogs.find(l => l.habitId === habit.id && l.date === today)?.completed;
                return (
                  <div 
                    key={habit.id} 
                    className={cn(
                      "flex items-center justify-between p-3 rounded-2xl transition-all border",
                      isCompleted ? "bg-indigo-50/50 border-indigo-100" : "bg-slate-50 border-slate-100"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${habit.color}15`, color: habit.color }}
                      >
                        {React.cloneElement((HABIT_ICONS_MAP[habit.icon] || <Activity />) as React.ReactElement, { className: "w-4 h-4" })}
                      </div>
                      <span className={cn("text-sm font-semibold", isCompleted ? "text-slate-400 line-through" : "text-slate-700")}>
                        {habit.name}
                      </span>
                    </div>
                    <button 
                      onClick={() => toggleHabit(habit.id, today)}
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                        isCompleted ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-400"
                      )}
                    >
                      {isCompleted ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Subject Breakdown */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            Subject Breakdown
          </h3>
          <div className="space-y-4">
            {subjects.length === 0 ? (
              <p className="text-slate-400 text-center py-12">No data yet. Add a subject to start!</p>
            ) : (
              subjects.map(subject => {
                const subjectMins = sessions
                  .filter(s => s.subjectId === subject.id)
                  .reduce((acc, s) => acc + s.durationMinutes, 0);
                const percentage = stats.totalMinutes > 0 ? (subjectMins / stats.totalMinutes) * 100 : 0;
                
                return (
                  <div key={subject.id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-slate-700">{subject.name}</span>
                      <span className="text-slate-500">{Math.round(subjectMins / 60)}h</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        className="h-full"
                        style={{ backgroundColor: subject.color }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SubjectsView({ subjects, topics, selectedSubject, setSelectedSubject, user }: { 
  subjects: Subject[], 
  topics: Topic[],
  selectedSubject: Subject | null,
  setSelectedSubject: (s: Subject | null) => void,
  user: User 
}) {
  const SUBJECT_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectColor, setNewSubjectColor] = useState(SUBJECT_COLORS[0]);
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicPriority, setNewTopicPriority] = useState<Topic['priority']>('medium');
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const [isAddingTopic, setIsAddingTopic] = useState(false);
  const [newTopicFiles, setNewTopicFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editingTopicName, setEditingTopicName] = useState('');
  const [editingTopicPriority, setEditingTopicPriority] = useState<Topic['priority']>('medium');
  const [editingTopicAttachments, setEditingTopicAttachments] = useState<Topic['attachments']>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | Topic['status']>('all');

  const startEditing = (topic: Topic) => {
    setEditingTopicId(topic.id);
    setEditingTopicName(topic.name);
    setEditingTopicPriority(topic.priority);
    setEditingTopicAttachments(topic.attachments || []);
  };

  const uploadFiles = async (files: File[], topicId: string): Promise<Topic['attachments']> => {
    if (!user || !selectedSubject) return [];
    const uploadedAttachments: Topic['attachments'] = [];
    
    for (const file of files) {
      const storageRef = ref(storage, `users/${user.uid}/subjects/${selectedSubject.id}/topics/${topicId}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      uploadedAttachments.push({
        name: file.name,
        url,
        type: file.type,
        size: file.size,
        createdAt: new Date().toISOString()
      });
    }
    return uploadedAttachments;
  };

  const handleUpdateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTopicName.trim() || !selectedSubject || !editingTopicId) return;
    setIsUploading(true);
    try {
      const newUploaded = await uploadFiles(newTopicFiles, editingTopicId);
      const allAttachments = [...(editingTopicAttachments || []), ...newUploaded];
      
      await updateDoc(doc(db, 'users', user.uid, 'subjects', selectedSubject.id, 'topics', editingTopicId), {
        name: editingTopicName,
        priority: editingTopicPriority,
        attachments: allAttachments,
        updatedAt: serverTimestamp()
      });
      setEditingTopicId(null);
      setNewTopicFiles([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/subjects/${selectedSubject.id}/topics/${editingTopicId}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;
    try {
      await addDoc(collection(db, 'users', user.uid, 'subjects'), {
        name: newSubjectName,
        color: newSubjectColor,
        createdAt: serverTimestamp()
      });
      setNewSubjectName('');
      setNewSubjectColor(SUBJECT_COLORS[Math.floor(Math.random() * SUBJECT_COLORS.length)]);
      setIsAddingSubject(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/subjects`);
    }
  };

  const handleAddTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicName.trim() || !selectedSubject) return;
    setIsUploading(true);
    try {
      // Create the topic first to get an ID (or use a temporary one for storage path)
      const topicRef = await addDoc(collection(db, 'users', user.uid, 'subjects', selectedSubject.id, 'topics'), {
        name: newTopicName,
        status: 'not-started',
        priority: newTopicPriority,
        subjectId: selectedSubject.id,
        uid: user.uid,
        updatedAt: serverTimestamp()
      });

      const uploadedAttachments = await uploadFiles(newTopicFiles, topicRef.id);
      
      if (uploadedAttachments.length > 0) {
        await updateDoc(topicRef, {
          attachments: uploadedAttachments
        });
      }

      setNewTopicName('');
      setNewTopicPriority('medium');
      setNewTopicFiles([]);
      setIsAddingTopic(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/subjects/${selectedSubject.id}/topics`);
    } finally {
      setIsUploading(false);
    }
  };

  const removeAttachment = async (topic: Topic, attachmentUrl: string) => {
    if (!selectedSubject || !user) return;
    try {
      const updatedAttachments = topic.attachments?.filter(a => a.url !== attachmentUrl) || [];
      await updateDoc(doc(db, 'users', user.uid, 'subjects', selectedSubject.id, 'topics', topic.id), {
        attachments: updatedAttachments,
        updatedAt: serverTimestamp()
      });
      
      // Optionally delete from storage too
      // const storageRef = ref(storage, attachmentUrl);
      // await deleteObject(storageRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/subjects/${selectedSubject.id}/topics/${topic.id}`);
    }
  };

  const toggleTopicPriority = async (topic: Topic) => {
    if (!selectedSubject) return;
    const priorities: Topic['priority'][] = ['low', 'medium', 'high'];
    const currentIndex = priorities.indexOf(topic.priority);
    const nextPriority = priorities[(currentIndex + 1) % priorities.length];
    
    try {
      await updateDoc(doc(db, 'users', user.uid, 'subjects', selectedSubject.id, 'topics', topic.id), {
        priority: nextPriority,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/subjects/${selectedSubject.id}/topics/${topic.id}`);
    }
  };

  const toggleTopicStatus = async (topic: Topic) => {
    if (!selectedSubject) return;
    const nextStatus: Record<string, Topic['status']> = {
      'not-started': 'in-progress',
      'in-progress': 'completed',
      'completed': 'not-started'
    };
    try {
      await updateDoc(doc(db, 'users', user.uid, 'subjects', selectedSubject.id, 'topics', topic.id), {
        status: nextStatus[topic.status],
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/subjects/${selectedSubject.id}/topics/${topic.id}`);
    }
  };

  const deleteSubject = async (id: string) => {
    if (!window.confirm('Are you sure? This will delete all topics and sessions for this subject.')) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'subjects', id));
      if (selectedSubject?.id === id) setSelectedSubject(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/subjects/${id}`);
    }
  };

  const statusSummary = useMemo(() => {
    const counts = {
      'not-started': 0,
      'in-progress': 0,
      'completed': 0
    };
    topics.filter(t => t.subjectId === selectedSubject?.id).forEach(t => {
      counts[t.status]++;
    });
    return counts;
  }, [topics, selectedSubject]);

  const filteredTopics = useMemo(() => {
    const subjectTopics = topics.filter(t => t.subjectId === selectedSubject?.id);
    if (statusFilter === 'all') return subjectTopics;
    return subjectTopics.filter(t => t.status === statusFilter);
  }, [topics, statusFilter, selectedSubject]);

  const calculateSubjectProgress = (subjectId: string) => {
    const subjectTopics = topics.filter(t => t.subjectId === subjectId);
    if (subjectTopics.length === 0) return 0;
    const completedTopics = subjectTopics.filter(t => t.status === 'completed').length;
    return Math.round((completedTopics / subjectTopics.length) * 100);
  };

  const formatFileSize = (bytes: number | undefined) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    if (isNaN(i)) return '0 Bytes';
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Subject List */}
      <div className="lg:col-span-1 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Your Subjects</h3>
          <button 
            onClick={() => setIsAddingSubject(true)}
            className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {isAddingSubject && (
          <motion.form 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            onSubmit={handleAddSubject}
            className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm space-y-4"
          >
            <div className="space-y-3">
              <input 
                autoFocus
                type="text" 
                placeholder="Subject Name (e.g. Physics)" 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
              />
              
              <div className="flex flex-wrap gap-2 p-1">
                {SUBJECT_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewSubjectColor(color)}
                    className={cn(
                      "w-6 h-6 rounded-full transition-all hover:scale-110 active:scale-95",
                      newSubjectColor === color ? "ring-2 ring-offset-2 ring-indigo-500 scale-110" : "opacity-60"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-medium">Add</button>
              <button type="button" onClick={() => setIsAddingSubject(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg font-medium">Cancel</button>
            </div>
          </motion.form>
        )}

        <div className="space-y-3">
          {subjects.map(subject => {
            const progress = calculateSubjectProgress(subject.id);
            return (
              <div 
                key={subject.id}
                onClick={() => setSelectedSubject(subject)}
                className={cn(
                  "group p-4 rounded-2xl border transition-all cursor-pointer flex flex-col gap-3",
                  selectedSubject?.id === subject.id 
                    ? "bg-white border-indigo-200 shadow-md ring-1 ring-indigo-100" 
                    : "bg-white border-slate-200 hover:border-indigo-100"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: subject.color }} />
                    <span className="font-semibold text-slate-700">{subject.name}</span>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); deleteSubject(subject.id); }}
                    className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <span>Progress</span>
                    <span className="text-slate-600">{progress}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: subject.color }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Topics List */}
      <div className="lg:col-span-2 space-y-6">
        {selectedSubject ? (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-2xl font-bold text-slate-900">{selectedSubject.name}</h3>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                  <span className="text-xs font-medium text-slate-400">
                    <span className="text-slate-600 font-bold">{statusSummary['not-started']}</span> not started
                  </span>
                  <span className="text-xs font-medium text-slate-400">
                    <span className="text-amber-600 font-bold">{statusSummary['in-progress']}</span> in progress
                  </span>
                  <span className="text-xs font-medium text-slate-400">
                    <span className="text-emerald-600 font-bold">{statusSummary['completed']}</span> completed
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setIsAddingTopic(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
              >
                <Plus className="w-5 h-5" />
                Add Topic
              </button>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {(['all', 'not-started', 'in-progress', 'completed'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap",
                    statusFilter === status 
                      ? "bg-slate-900 text-white shadow-md" 
                      : "bg-white border border-slate-200 text-slate-500 hover:border-slate-300"
                  )}
                >
                  {status.replace('-', ' ')}
                </button>
              ))}
            </div>

            {isAddingTopic && (
              <motion.form 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                onSubmit={handleAddTopic}
                className="bg-white p-6 rounded-3xl border border-indigo-100 shadow-sm space-y-4"
              >
                <div className="space-y-4">
                  <input 
                    autoFocus
                    type="text" 
                    placeholder="Topic Name (e.g. Quantum Mechanics)" 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newTopicName}
                    onChange={(e) => setNewTopicName(e.target.value)}
                  />
                  
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-bold text-slate-400 uppercase">Priority:</span>
                    <div className="flex gap-2">
                      {(['low', 'medium', 'high'] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setNewTopicPriority(p)}
                          className={cn(
                            "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                            newTopicPriority === p 
                              ? p === 'high' ? "bg-red-600 text-white shadow-lg shadow-red-100" :
                                p === 'medium' ? "bg-amber-500 text-white shadow-lg shadow-amber-100" :
                                "bg-slate-600 text-white shadow-lg shadow-slate-100"
                              : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                          )}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-400 uppercase flex items-center gap-2">
                      <Paperclip className="w-4 h-4" />
                      Attachments
                    </label>
                    <div className="flex flex-col gap-2">
                      <input 
                        type="file" 
                        multiple 
                        className="hidden" 
                        id="new-topic-files"
                        onChange={(e) => {
                          if (e.target.files) {
                            setNewTopicFiles(Array.from(e.target.files));
                          }
                        }}
                      />
                      <label 
                        htmlFor="new-topic-files"
                        className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-200 rounded-2xl hover:border-indigo-300 hover:bg-indigo-50 transition-all cursor-pointer"
                      >
                        <Plus className="w-5 h-5 text-slate-400" />
                        <span className="text-sm font-medium text-slate-500">
                          {newTopicFiles.length > 0 ? `${newTopicFiles.length} files selected` : "Add files (PDF, Images, etc.)"}
                        </span>
                      </label>
                      {newTopicFiles.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {newTopicFiles.map((file, idx) => (
                            <div key={idx} className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-lg text-xs font-medium text-slate-600">
                              <File className="w-3 h-3" />
                              {file.name}
                              <button 
                                type="button"
                                onClick={() => setNewTopicFiles(prev => prev.filter((_, i) => i !== idx))}
                                className="hover:text-red-500"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => { setIsAddingTopic(false); setNewTopicFiles([]); }} className="px-6 py-2 text-slate-500 font-medium">Cancel</button>
                  <button 
                    type="submit" 
                    disabled={isUploading}
                    className="px-8 py-2 bg-indigo-600 text-white rounded-xl font-bold flex items-center gap-2 disabled:opacity-50"
                  >
                    {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create Topic"}
                  </button>
                </div>
              </motion.form>
            )}

            <div className="space-y-4">
              {filteredTopics.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
                  <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">
                    {statusFilter === 'all' 
                      ? "No topics added to this subject yet." 
                      : `No topics found with status "${statusFilter.replace('-', ' ')}".`}
                  </p>
                </div>
              ) : (
                filteredTopics.map(topic => (
                  <div 
                    key={topic.id}
                    className="bg-white p-5 rounded-2xl border border-slate-200 group hover:shadow-sm transition-all"
                  >
                    {editingTopicId === topic.id ? (
                      <form onSubmit={handleUpdateTopic} className="space-y-4">
                        <div className="flex flex-col gap-4">
                          <div className="flex gap-4">
                            <input 
                              autoFocus
                              type="text" 
                              className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              value={editingTopicName}
                              onChange={(e) => setEditingTopicName(e.target.value)}
                            />
                            <div className="flex gap-2">
                              {(['low', 'medium', 'high'] as const).map((p) => (
                                <button
                                  key={p}
                                  type="button"
                                  onClick={() => setEditingTopicPriority(p)}
                                  className={cn(
                                    "px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                                    editingTopicPriority === p 
                                      ? p === 'high' ? "bg-red-600 text-white" :
                                        p === 'medium' ? "bg-amber-500 text-white" :
                                        "bg-slate-600 text-white"
                                      : "bg-slate-100 text-slate-400"
                                  )}
                                >
                                  {p}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase">Add More Attachments:</label>
                            <input 
                              type="file" 
                              multiple 
                              className="hidden" 
                              id={`edit-topic-files-${topic.id}`}
                              onChange={(e) => {
                                if (e.target.files) {
                                  setNewTopicFiles(Array.from(e.target.files));
                                }
                              }}
                            />
                            <label 
                              htmlFor={`edit-topic-files-${topic.id}`}
                              className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 transition-all cursor-pointer"
                            >
                              <Plus className="w-4 h-4 text-slate-400" />
                              <span className="text-xs font-medium text-slate-500">
                                {newTopicFiles.length > 0 ? `${newTopicFiles.length} files selected` : "Upload more files"}
                              </span>
                            </label>
                          </div>

                          {editingTopicAttachments && editingTopicAttachments.length > 0 && (
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-400 uppercase">Current Attachments:</label>
                              <div className="flex flex-wrap gap-2">
                                {editingTopicAttachments.map((att, idx) => (
                                  <div key={idx} className="flex items-center gap-2 px-3 py-1 bg-indigo-50 rounded-lg text-xs font-medium text-indigo-600">
                                    <FileText className="w-3 h-3" />
                                    <span className="truncate max-w-[150px]">{att.name}</span>
                                    <button 
                                      type="button"
                                      onClick={() => setEditingTopicAttachments(prev => prev?.filter(a => a.url !== att.url))}
                                      className="hover:text-red-500"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex justify-end gap-2">
                          <button 
                            type="button" 
                            onClick={() => { setEditingTopicId(null); setNewTopicFiles([]); }} 
                            className="px-4 py-1.5 text-slate-500 text-sm font-medium"
                          >
                            Cancel
                          </button>
                          <button 
                            type="submit" 
                            disabled={isUploading}
                            className="px-6 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50"
                          >
                            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <button 
                              onClick={() => toggleTopicStatus(topic)}
                              className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                                topic.status === 'completed' ? "bg-emerald-100 text-emerald-600" :
                                topic.status === 'in-progress' ? "bg-amber-100 text-amber-600" :
                                "bg-slate-100 text-slate-400"
                              )}
                            >
                              {topic.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> : <div className="w-2 h-2 rounded-full bg-current" />}
                            </button>
                            <div>
                              <h4 className={cn("font-semibold", topic.status === 'completed' ? "text-slate-400 line-through" : "text-slate-700")}>
                                {topic.name}
                              </h4>
                              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{topic.status.replace('-', ' ')}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => startEditing(topic)}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => toggleTopicPriority(topic)}
                              className={cn(
                                "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all hover:scale-105 active:scale-95",
                                topic.priority === 'high' ? "bg-red-50 text-red-600 hover:bg-red-100" :
                                topic.priority === 'medium' ? "bg-amber-50 text-amber-600 hover:bg-amber-100" :
                                "bg-slate-50 text-slate-500 hover:bg-slate-100"
                              )}
                            >
                              {topic.priority}
                            </button>
                            <button 
                              onClick={() => {
                                if (window.confirm('Delete this topic?')) {
                                  deleteDoc(doc(db, 'users', user.uid, 'subjects', selectedSubject.id, 'topics', topic.id));
                                }
                              }}
                              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {topic.attachments && topic.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-50">
                            {topic.attachments.map((att, idx) => (
                              <a 
                                key={idx}
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium text-slate-600 hover:bg-indigo-50 hover:border-indigo-100 hover:text-indigo-600 transition-all group/att"
                              >
                                <Paperclip className="w-3 h-3" />
                                <span className="truncate max-w-[120px]">{att.name}</span>
                                <span className="text-[9px] text-slate-400">({formatFileSize(att.size)})</span>
                                <Download className="w-3 h-3 ml-1 opacity-0 group-hover/att:opacity-100" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-white rounded-3xl border border-slate-200">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
              <BookOpen className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Select a Subject</h3>
            <p className="text-slate-500 max-w-xs">Choose a subject from the left to manage its topics and track your progress.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TimerView({ subjects, topics, sessions, user }: { subjects: Subject[], topics: Topic[], sessions: StudySession[], user: User }) {
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionNotes, setEditingSessionNotes] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (saveStatus === 'success' || saveStatus === 'error') {
      const timer = setTimeout(() => setSaveStatus('idle'), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  useEffect(() => {
    let interval: any = null;
    if (isActive) {
      interval = setInterval(() => {
        setSeconds(seconds => seconds + 1);
      }, 1000);
    } else if (!isActive && seconds !== 0) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive, seconds]);

  const formatTime = (s: number) => {
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSaveSession = async () => {
    if (seconds < 60) return;
    if (!selectedTopicId) return;

    setSaveStatus('saving');
    try {
      await addDoc(collection(db, 'users', user.uid, 'sessions'), {
        topicId: selectedTopicId,
        subjectId: selectedSubjectId,
        durationMinutes: Math.floor(seconds / 60),
        startTime: serverTimestamp(),
        notes: sessionNotes
      });
      setSeconds(0);
      setIsActive(false);
      setSessionNotes('');
      setSaveStatus('success');
    } catch (error) {
      setSaveStatus('error');
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/sessions`);
    }
  };

  const handleUpdateSessionNotes = async (sessionId: string) => {
    try {
      await updateDoc(doc(db, 'users', user.uid, 'sessions', sessionId), {
        notes: editingSessionNotes
      });
      setEditingSessionId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/sessions/${sessionId}`);
    }
  };

  const filteredTopics = topics.filter(t => t.subjectId === selectedSubjectId);

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="bg-white p-12 rounded-[40px] border border-slate-200 shadow-xl text-center space-y-8">
        <div className="space-y-2">
          <h3 className="text-slate-500 font-medium uppercase tracking-widest text-sm">Focus Timer</h3>
          <div className="text-7xl font-mono font-bold text-slate-900 tracking-tighter">
            {formatTime(seconds)}
          </div>
        </div>

        <div className="flex items-center justify-center gap-6">
          <button 
            onClick={() => setIsActive(!isActive)}
            className={cn(
              "w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg",
              isActive ? "bg-amber-100 text-amber-600 hover:bg-amber-200" : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200"
            )}
          >
            {isActive ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
          </button>
          <button 
            onClick={() => { setIsActive(false); setSeconds(0); }}
            className="w-14 h-14 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center hover:bg-slate-200 transition-all"
          >
            <RotateCcw className="w-6 h-6" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-8 border-t border-slate-100">
          <div className="space-y-2 text-left">
            <label className="text-xs font-bold text-slate-400 uppercase ml-1">Subject</label>
            <select 
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
            >
              <option value="">Select Subject</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-2 text-left">
            <label className="text-xs font-bold text-slate-400 uppercase ml-1">Topic</label>
            <select 
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={selectedTopicId}
              onChange={(e) => setSelectedTopicId(e.target.value)}
              disabled={!selectedSubjectId}
            >
              <option value="">Select Topic</option>
              {filteredTopics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-2 text-left">
          <label className="text-xs font-bold text-slate-400 uppercase ml-1">Session Notes</label>
          <textarea 
            placeholder="What did you work on during this session?"
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px] resize-none"
            value={sessionNotes}
            onChange={(e) => setSessionNotes(e.target.value)}
          />
        </div>

        <button 
          disabled={seconds < 60 || !selectedTopicId || saveStatus === 'saving'}
          onClick={handleSaveSession}
          className={cn(
            "w-full py-4 rounded-2xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2",
            saveStatus === 'success' ? "bg-emerald-600 text-white" :
            saveStatus === 'error' ? "bg-red-600 text-white" :
            "bg-slate-900 text-white hover:bg-slate-800"
          )}
        >
          {saveStatus === 'saving' ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : saveStatus === 'success' ? (
            <>
              <CheckCircle2 className="w-5 h-5" />
              Session Saved!
            </>
          ) : saveStatus === 'error' ? (
            <>
              <AlertCircle className="w-5 h-5" />
              Error Saving
            </>
          ) : (
            "Save Study Session"
          )}
        </button>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-bold text-slate-900">Recent Sessions</h3>
        <div className="space-y-3">
          {sessions.slice().sort((a, b) => {
            const dateA = a.startTime instanceof Timestamp ? a.startTime.toDate() : new Date(a.startTime);
            const dateB = b.startTime instanceof Timestamp ? b.startTime.toDate() : new Date(b.startTime);
            return dateB.getTime() - dateA.getTime();
          }).slice(0, 5).map(session => (
            <div key={session.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-slate-900">
                    {topics.find(t => t.id === session.topicId)?.name || 'Unknown Topic'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {format(session.startTime instanceof Timestamp ? session.startTime.toDate() : new Date(session.startTime), 'MMM d, h:mm a')} • {session.durationMinutes} mins
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setEditingSessionId(session.id);
                    setEditingSessionNotes(session.notes || '');
                  }}
                  className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>

              {editingSessionId === session.id ? (
                <div className="space-y-3">
                  <textarea 
                    autoFocus
                    placeholder="Add notes about your session..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm min-h-[80px] resize-none"
                    value={editingSessionNotes}
                    onChange={(e) => setEditingSessionNotes(e.target.value)}
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditingSessionId(null)} className="px-4 py-1.5 text-slate-500 text-xs font-bold">Cancel</button>
                    <button onClick={() => handleUpdateSessionNotes(session.id)} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold">Save Changes</button>
                  </div>
                </div>
              ) : (
                <p className={cn("text-sm", session.notes ? "text-slate-600 italic" : "text-slate-400")}>
                  {session.notes ? `"${session.notes}"` : "No notes added for this session."}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-indigo-600 p-8 rounded-[32px] text-white flex items-center gap-6">
        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
          <TrendingUp className="w-8 h-8" />
        </div>
        <div>
          <h4 className="font-bold text-lg">Did you know?</h4>
          <p className="text-indigo-100 text-sm">Studying in 25-minute blocks (Pomodoro) with 5-minute breaks can significantly improve retention and focus.</p>
        </div>
      </div>
    </div>
  );
}

function HabitsView({ habits, habitLogs, toggleHabit, user }: { 
  habits: Habit[], 
  habitLogs: HabitLog[], 
  toggleHabit: (habitId: string, date: string) => void,
  user: User 
}) {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [isAddingHabit, setIsAddingHabit] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitColor, setNewHabitColor] = useState('#4f46e5');
  const [newHabitIcon, setNewHabitIcon] = useState('Activity');

  const HABIT_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1'];
  const HABIT_ICONS = Object.keys(HABIT_ICONS_MAP);

  const monthDays = useMemo(() => {
    const start = startOfMonth(selectedMonth);
    const end = endOfMonth(selectedMonth);
    return eachDayOfInterval({ start, end });
  }, [selectedMonth]);

  const handleAddHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newHabitName.trim()) return;

    try {
      if (editingHabit) {
        await updateDoc(doc(db, 'users', user.uid, 'habits', editingHabit.id), {
          name: newHabitName,
          color: newHabitColor,
          icon: newHabitIcon
        });
      } else {
        await addDoc(collection(db, 'users', user.uid, 'habits'), {
          name: newHabitName,
          color: newHabitColor,
          icon: newHabitIcon,
          uid: user.uid,
          createdAt: serverTimestamp()
        });
      }
      setNewHabitName('');
      setIsAddingHabit(false);
      setEditingHabit(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/habits`);
    }
  };

  const startEditing = (habit: Habit) => {
    setEditingHabit(habit);
    setNewHabitName(habit.name);
    setNewHabitColor(habit.color);
    setNewHabitIcon(habit.icon);
    setIsAddingHabit(true);
  };

  const deleteHabit = async (habitId: string) => {
    if (!user || !window.confirm('Are you sure you want to delete this habit? All history will be lost.')) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'habits', habitId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/habits/${habitId}`);
    }
  };

  const calculateStreak = (habitId: string) => {
    let streak = 0;
    let checkDate = new Date();
    while (true) {
      const dateStr = format(checkDate, 'yyyy-MM-dd');
      const isCompleted = habitLogs.find(l => l.habitId === habitId && l.date === dateStr)?.completed;
      if (isCompleted) {
        streak++;
        checkDate = subDays(checkDate, 1);
      } else {
        if (isToday(checkDate)) {
          checkDate = subDays(checkDate, 1);
          continue;
        }
        break;
      }
    }
    return streak;
  };

  return (
    <div className="max-w-full space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Habit Tracker</h2>
          <p className="text-slate-500">Track your consistency and build better routines.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border border-slate-200 rounded-2xl p-1 shadow-sm">
            <button 
              onClick={() => setSelectedMonth(addMonths(selectedMonth, -1))}
              className="p-2 text-slate-500 hover:bg-slate-50 rounded-xl transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="px-4 font-bold text-slate-900 min-w-[140px] text-center">
              {format(selectedMonth, 'MMMM yyyy')}
            </span>
            <button 
              onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
              className="p-2 text-slate-500 hover:bg-slate-50 rounded-xl transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <button 
            onClick={() => setIsAddingHabit(true)}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            <Plus className="w-5 h-5" />
            New Habit
          </button>
        </div>
      </div>

      {isAddingHabit && (
        <motion.form 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleAddHabit}
          className="bg-white p-8 rounded-[32px] border border-indigo-100 shadow-xl space-y-6 max-w-4xl mx-auto"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase ml-1">Habit Name</label>
                <input 
                  autoFocus
                  type="text" 
                  placeholder="e.g. Morning Meditation" 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={newHabitName}
                  onChange={(e) => setNewHabitName(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase ml-1">Color</label>
                <div className="flex flex-wrap gap-3 p-2">
                  {HABIT_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewHabitColor(c)}
                      className={cn(
                        "w-9 h-9 rounded-full transition-all hover:scale-110",
                        newHabitColor === c ? "ring-2 ring-offset-2 ring-indigo-500 scale-110" : "opacity-40"
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase ml-1">Icon</label>
              <div className="grid grid-cols-5 gap-3 p-2 bg-slate-50 rounded-2xl border border-slate-100">
                {HABIT_ICONS.map(iconName => (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => setNewHabitIcon(iconName)}
                    className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
                      newHabitIcon === iconName 
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-110" 
                        : "text-slate-400 hover:bg-slate-200"
                    )}
                  >
                    {React.cloneElement(HABIT_ICONS_MAP[iconName] as React.ReactElement, { className: "w-6 h-6" })}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button 
              type="button" 
              onClick={() => {
                setIsAddingHabit(false);
                setEditingHabit(null);
                setNewHabitName('');
              }} 
              className="px-6 py-2 text-slate-500 font-bold"
            >
              Cancel
            </button>
            <button type="submit" className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100">
              {editingHabit ? 'Save Changes' : 'Create Habit'}
            </button>
          </div>
        </motion.form>
      )}

      {/* Monthly Grid */}
      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="sticky left-0 z-20 bg-slate-50/50 p-6 text-left border-b border-r border-slate-100 min-w-[240px]">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Habits</span>
                </th>
                {monthDays.map(day => (
                  <th 
                    key={day.toString()} 
                    className={cn(
                      "p-3 border-b border-slate-100 min-w-[44px] text-center",
                      isToday(day) ? "bg-indigo-50/50" : ""
                    )}
                  >
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">{format(day, 'EEE')}</span>
                      <span className={cn(
                        "text-sm font-bold",
                        isToday(day) ? "text-indigo-600" : "text-slate-700"
                      )}>{format(day, 'd')}</span>
                    </div>
                  </th>
                ))}
                <th className="p-6 text-center border-b border-slate-100 min-w-[100px]">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Progress</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {habits.length === 0 ? (
                <tr>
                  <td colSpan={monthDays.length + 2} className="p-20 text-center">
                    <Activity className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-500">No habits tracked yet. Start building your routine!</p>
                  </td>
                </tr>
              ) : (
                habits.map(habit => {
                  const completedDays = monthDays.filter(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    return habitLogs.find(l => l.habitId === habit.id && l.date === dateStr)?.completed;
                  }).length;
                  const progress = Math.round((completedDays / monthDays.length) * 100);
                  const streak = calculateStreak(habit.id);

                  return (
                    <tr key={habit.id} className="group hover:bg-slate-50/50 transition-all">
                      <td className="sticky left-0 z-20 bg-white group-hover:bg-slate-50/50 p-4 border-b border-r border-slate-100">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
                              style={{ backgroundColor: `${habit.color}15`, color: habit.color }}
                            >
                              {React.cloneElement((HABIT_ICONS_MAP[habit.icon] || <Activity />) as React.ReactElement, { className: "w-5 h-5" })}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-sm">{habit.name}</p>
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1 text-amber-600">
                                  <Flame className="w-3 h-3 fill-current" />
                                  <span className="text-[10px] font-bold uppercase">{streak} day streak</span>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400">•</span>
                                <span className="text-[10px] font-bold text-indigo-600 uppercase">{progress}% done</span>
                              </div>
                              <div className="mt-1.5 w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className="h-full transition-all duration-500"
                                  style={{ width: `${progress}%`, backgroundColor: habit.color }}
                                />
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <button 
                              onClick={() => startEditing(habit)}
                              className="p-1.5 text-slate-300 hover:text-indigo-600"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => deleteHabit(habit.id)}
                              className="p-1.5 text-slate-300 hover:text-red-500"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </td>
                      {monthDays.map(day => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const isCompleted = habitLogs.find(l => l.habitId === habit.id && l.date === dateStr)?.completed;
                        return (
                          <td 
                            key={day.toString()} 
                            className={cn(
                              "p-1 border-b border-slate-100 text-center",
                              isToday(day) ? "bg-indigo-50/30" : ""
                            )}
                          >
                            <button
                              onClick={() => toggleHabit(habit.id, dateStr)}
                              className={cn(
                                "w-8 h-8 rounded-lg transition-all flex items-center justify-center mx-auto",
                                isCompleted 
                                  ? "shadow-sm scale-105" 
                                  : "hover:bg-slate-100 border border-transparent"
                              )}
                              style={{ 
                                backgroundColor: isCompleted ? habit.color : 'transparent',
                                color: isCompleted ? 'white' : 'transparent'
                              }}
                            >
                              {isCompleted && <Check className="w-5 h-5 stroke-[3]" />}
                            </button>
                          </td>
                        );
                      })}
                      <td className="p-4 text-center border-b border-slate-100">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-sm font-bold text-slate-900">{progress}%</span>
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full transition-all duration-500"
                              style={{ width: `${progress}%`, backgroundColor: habit.color }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Habits</p>
            <p className="text-2xl font-bold text-slate-900">{habits.length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Avg. Completion</p>
            <p className="text-2xl font-bold text-slate-900">
              {habits.length > 0 
                ? Math.round(habits.reduce((acc, h) => {
                    const completed = monthDays.filter(day => {
                      const dateStr = format(day, 'yyyy-MM-dd');
                      return habitLogs.find(l => l.habitId === h.id && l.date === dateStr)?.completed;
                    }).length;
                    return acc + (completed / monthDays.length);
                  }, 0) / habits.length * 100)
                : 0}%
            </p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Best Streak</p>
            <p className="text-2xl font-bold text-slate-900">
              {habits.length > 0 ? Math.max(...habits.map(h => calculateStreak(h.id))) : 0} Days
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- UI Components ---

function SidebarItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-xl transition-all group",
        active ? "bg-indigo-50 text-indigo-600" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
      )}
    >
      <div className={cn("shrink-0", active ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600")}>
        {React.cloneElement(icon as React.ReactElement, { className: "w-6 h-6" })}
      </div>
      <span className="hidden lg:block font-semibold">{label}</span>
    </button>
  );
}

function StatCard({ icon, label, value, subValue }: { icon: React.ReactNode, label: string, value: string, subValue: string }) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
      <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center">
        {React.cloneElement(icon as React.ReactElement, { className: "w-6 h-6" })}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <h4 className="text-2xl font-bold text-slate-900">{value}</h4>
        <p className="text-xs text-slate-400 mt-1">{subValue}</p>
      </div>
    </div>
  );
}

function CalendarView({ events, isSyncing, onSync, googleAccessToken, onLogin, syncError }: { 
  events: any[], 
  isSyncing: boolean, 
  onSync: () => void,
  googleAccessToken: string | null,
  onLogin: () => void,
  syncError: string | null
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  if (!googleAccessToken) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-slate-100 shadow-sm text-center">
        <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6">
          <Calendar className="w-8 h-8 text-indigo-600" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Connect Google Calendar</h3>
        <p className="text-slate-500 mb-8 max-w-sm mx-auto">
          Synchronize your study schedule and exams directly from your Google Calendar.
        </p>
        <button 
          onClick={onLogin}
          className="flex items-center gap-3 py-3 px-6 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
        >
          Authorize Calendar Access
        </button>
      </div>
    );
  }

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const getEventsForDay = (day: Date) => {
    return events.filter(event => {
      const start = event.start?.dateTime || event.start?.date;
      return start && isSameDay(new Date(start), day);
    });
  };

  return (
    <div className="space-y-6">
      {syncError && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-3xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold text-red-900">Calendar Sync Error</p>
            <p className="text-xs text-red-700 mt-1">{syncError}</p>
            <div className="mt-2 flex items-center gap-3">
              <button 
                onClick={onSync}
                className="text-xs font-bold text-red-600 hover:text-red-700 underline"
              >
                Try Again
              </button>
              <button 
                onClick={() => {
                  localStorage.removeItem('google_access_token');
                  window.location.reload();
                }}
                className="text-xs font-bold text-red-600 hover:text-red-700 underline"
              >
                Re-authorize
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-slate-900">Google Calendar</h3>
          <p className="text-slate-500 text-sm">Manage your entire schedule (Primary calendar only)</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setViewMode('grid')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                viewMode === 'grid' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Grid
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                viewMode === 'list' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              List
            </button>
          </div>

          <button 
            onClick={onSync}
            disabled={isSyncing}
            className={cn(
              "flex items-center gap-2 py-2 px-4 rounded-xl font-medium transition-all",
              isSyncing ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
            )}
          >
            <RotateCcw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h4 className="text-lg font-bold text-slate-900">{format(currentMonth, 'MMMM yyyy')}</h4>
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} className="p-2 hover:bg-slate-50 rounded-lg transition-colors">
                <ChevronLeft className="w-5 h-5 text-slate-600" />
              </button>
              <button onClick={() => setCurrentMonth(new Date())} className="px-3 py-1 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                Today
              </button>
              <button onClick={nextMonth} className="p-2 hover:bg-slate-50 rounded-lg transition-colors">
                <ChevronRight className="w-5 h-5 text-slate-600" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {calendarDays.map((day, idx) => {
              const dayEvents = getEventsForDay(day);
              const isCurrentMonth = isSameDay(startOfMonth(day), monthStart);
              
              return (
                <div 
                  key={day.toString()} 
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    "min-h-[120px] p-2 border-r border-b border-slate-100 transition-colors hover:bg-slate-50/30 cursor-pointer",
                    !isCurrentMonth && "bg-slate-50/50",
                    isSameDay(day, selectedDay || new Date(-1)) && "bg-indigo-50/50 ring-2 ring-inset ring-indigo-500 z-10",
                    idx % 7 === 6 && "border-r-0"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn(
                      "w-7 h-7 flex items-center justify-center text-sm font-bold rounded-full",
                      isToday(day) ? "bg-indigo-600 text-white" : isCurrentMonth ? "text-slate-900" : "text-slate-300"
                    )}>
                      {format(day, 'd')}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map(event => {
                      const isExam = event.summary?.toLowerCase().includes('exam') || event.summary?.toLowerCase().includes('test');
                      return (
                        <div 
                          key={event.id}
                          className={cn(
                            "px-2 py-1 text-[10px] font-medium rounded-md truncate flex items-center gap-1",
                            isExam ? "bg-red-100 text-red-700 border border-red-200" : "bg-indigo-50 text-indigo-700 border border-indigo-100"
                          )}
                          title={event.summary}
                        >
                          {event.hangoutLink && <Video className="w-2 h-2 shrink-0" />}
                          <span className="truncate">{event.summary}</span>
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-slate-400 pl-1 font-medium">
                        + {dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.length === 0 ? (
            <div className="col-span-full p-12 text-center bg-white rounded-3xl border border-slate-100">
              <p className="text-slate-500">No upcoming events found.</p>
            </div>
          ) : (
            events.map((event: any) => {
              const start = event.start?.dateTime || event.start?.date;
              const isExam = event.summary?.toLowerCase().includes('exam') || event.summary?.toLowerCase().includes('test');
              
              return (
                <motion.div 
                  key={event.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn(
                    "p-6 rounded-3xl border bg-white shadow-sm hover:shadow-md transition-all",
                    isExam ? "border-red-100 bg-red-50/30" : "border-slate-100"
                  )}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      isExam ? "bg-red-100 text-red-600" : "bg-indigo-50 text-indigo-600"
                    )}>
                      {isExam ? <AlertCircle className="w-5 h-5" /> : <Calendar className="w-5 h-5" />}
                    </div>
                    {isExam && (
                      <span className="px-2 py-1 bg-red-100 text-red-600 text-[10px] font-bold uppercase tracking-wider rounded-lg">
                        Exam Alert
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-slate-900 mb-1 line-clamp-1">{event.summary}</h4>
                  <p className="text-sm text-slate-500 mb-4">
                    {start ? format(new Date(start), 'PPP p') : 'No date set'}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {event.location && (
                      <p className="text-xs text-slate-400 flex items-center gap-1">
                        <Target className="w-3 h-3" />
                        {event.location}
                      </p>
                    )}
                    {event.hangoutLink && (
                      <a 
                        href={event.hangoutLink} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-lg transition-colors"
                      >
                        <Video className="w-3 h-3" />
                        Google Meet
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {/* Day Detail View */}
      <AnimatePresence>
        {selectedDay && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden mt-8"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-indigo-50/30">
              <div>
                <h4 className="text-lg font-bold text-slate-900">{format(selectedDay, 'PPPP')}</h4>
                <p className="text-sm text-slate-500">{getEventsForDay(selectedDay).length} events scheduled</p>
              </div>
              <button 
                onClick={() => setSelectedDay(null)}
                className="p-2 hover:bg-white rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6 max-h-[400px] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getEventsForDay(selectedDay).length > 0 ? (
                  getEventsForDay(selectedDay).map((event: any) => {
                    const start = event.start?.dateTime || event.start?.date;
                    const isExam = event.summary?.toLowerCase().includes('exam') || event.summary?.toLowerCase().includes('test');
                    
                    return (
                      <div 
                        key={event.id}
                        className={cn(
                          "p-4 rounded-2xl border transition-all",
                          isExam ? "border-red-100 bg-red-50/30" : "border-slate-100 bg-slate-50/30"
                        )}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center",
                            isExam ? "bg-red-100 text-red-600" : "bg-indigo-100 text-indigo-600"
                          )}>
                            {isExam ? <AlertCircle className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
                          </div>
                          {isExam && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold uppercase tracking-wider rounded-md">
                              Exam
                            </span>
                          )}
                        </div>
                        <h5 className="font-bold text-slate-900 mb-1">{event.summary}</h5>
                        <p className="text-xs text-slate-500 mb-3">
                          {start ? format(new Date(start), 'p') : 'All day'}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {event.hangoutLink && (
                            <a 
                              href={event.hangoutLink} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-white border border-indigo-100 px-2 py-1 rounded-md transition-colors"
                            >
                              <Video className="w-3 h-3" />
                              Join Meet
                            </a>
                          )}
                          {event.location && (
                            <div className="text-[10px] text-slate-400 flex items-center gap-1 bg-white border border-slate-100 px-2 py-1 rounded-md">
                              <Target className="w-3 h-3" />
                              <span className="truncate max-w-[100px]">{event.location}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-full py-12 text-center">
                    <p className="text-slate-400 italic">No events scheduled for this day.</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AlarmSystem({ calendarEvents, topics }: { calendarEvents: any[], topics: Topic[] }) {
  const [activeAlarms, setActiveAlarms] = useState<string[]>([]);
  const [lastCompletedTopicId, setLastCompletedTopicId] = useState<string | null>(null);

  // Check for upcoming exams
  useEffect(() => {
    const checkExams = () => {
      const now = new Date();
      calendarEvents.forEach(event => {
        const startStr = event.start?.dateTime || event.start?.date;
        if (!startStr) return;
        const start = new Date(startStr);
        const isExam = event.summary?.toLowerCase().includes('exam') || event.summary?.toLowerCase().includes('test');
        
        // If exam is within next 15 minutes and not already alerted
        const diffMinutes = (start.getTime() - now.getTime()) / (1000 * 60);
        if (isExam && diffMinutes > 0 && diffMinutes <= 15 && !activeAlarms.includes(event.id)) {
          triggerAlarm(`Upcoming Exam: ${event.summary}`, event.id);
        }
      });
    };

    const interval = setInterval(checkExams, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [calendarEvents, activeAlarms]);

  // Check for topic completion
  useEffect(() => {
    const completedTopic = topics.find(t => t.status === 'completed');
    if (completedTopic && completedTopic.id !== lastCompletedTopicId) {
      triggerAlarm(`Topic Completed: ${completedTopic.name}`, `topic-${completedTopic.id}`);
      setLastCompletedTopicId(completedTopic.id);
    }
  }, [topics, lastCompletedTopicId]);

  const triggerAlarm = (message: string, id: string) => {
    if (activeAlarms.includes(id)) return;
    setActiveAlarms(prev => [...prev, id]);
    
    // Play sound
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.play().catch(e => console.log("Audio play failed", e));

    // Show notification if permitted
    if (Notification.permission === 'granted') {
      new Notification('ExamCracker Alarm', { body: message });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  };

  const dismissAlarm = (id: string) => {
    setActiveAlarms(prev => prev.filter(a => a !== id));
  };

  if (activeAlarms.length === 0) return null;

  return (
    <div className="fixed bottom-8 right-8 z-50 space-y-4">
      <AnimatePresence>
        {activeAlarms.map(id => {
          const isTopic = id.startsWith('topic-');
          const event = calendarEvents.find(e => e.id === id);
          const topic = topics.find(t => `topic-${t.id}` === id);
          const message = isTopic ? `Topic Completed: ${topic?.name}` : `Upcoming Exam: ${event?.summary}`;

          return (
            <motion.div
              key={id}
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.9 }}
              className="bg-white border-2 border-indigo-600 p-6 rounded-3xl shadow-2xl flex items-center gap-4 max-w-sm"
            >
              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shrink-0 animate-bounce">
                <AlertCircle className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-slate-900">Alarm Triggered!</h4>
                <p className="text-sm text-slate-600">{message}</p>
              </div>
              <button 
                onClick={() => dismissAlarm(id)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
