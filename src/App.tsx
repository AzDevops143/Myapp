/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
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
  OperationType
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
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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
import { format, subDays, startOfDay, isWithinInterval } from 'date-fns';
import { cn } from './lib/utils';

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
          <p className="text-gray-600 mb-6">
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
    <div onError={(e) => { setHasError(true); setError(e); }}>
      {children}
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'subjects' | 'timer'>('dashboard');
  
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const [isAddingTopic, setIsAddingTopic] = useState(false);

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
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

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

    return () => {
      subjectsUnsubscribe();
      sessionsUnsubscribe();
      topicsUnsubscribe();
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
          <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-200">
            <Target className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">ExamCracker</h1>
          <p className="text-slate-500 mb-8">Master your syllabus with data-driven study tracking.</p>
          
          <button 
            onClick={signInWithGoogle}
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
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0">
              <Target className="w-6 h-6 text-white" />
            </div>
            <span className="hidden lg:block font-bold text-xl text-slate-900">ExamCracker</span>
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
                    user={user} 
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
            </AnimatePresence>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}

// --- Sub-Views ---

function DashboardView({ subjects, sessions, topics, user }: { subjects: Subject[], sessions: StudySession[], topics: Topic[], user: User }) {
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

    return { hours, mins, totalMinutes, chartData, completedTopics, totalTopics, overallProgress };
  }, [sessions, topics]);

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
          icon={<BookOpen className="text-emerald-600" />} 
          label="Subjects Tracked" 
          value={subjects.length.toString()} 
          subValue="Active subjects"
        />
        <StatCard 
          icon={<CheckCircle2 className="text-amber-600" />} 
          label="Topics Completed" 
          value={`${stats.completedTopics}/${stats.totalTopics}`} 
          subValue={`${stats.overallProgress}% overall progress`}
        />
        <StatCard 
          icon={<TrendingUp className="text-indigo-600" />} 
          label="Sessions Logged" 
          value={sessions.length.toString()} 
          subValue="Last 30 days"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editingTopicName, setEditingTopicName] = useState('');
  const [editingTopicPriority, setEditingTopicPriority] = useState<Topic['priority']>('medium');
  const [statusFilter, setStatusFilter] = useState<'all' | Topic['status']>('all');

  const startEditing = (topic: Topic) => {
    setEditingTopicId(topic.id);
    setEditingTopicName(topic.name);
    setEditingTopicPriority(topic.priority);
  };

  const handleUpdateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTopicName.trim() || !selectedSubject || !editingTopicId) return;
    try {
      await updateDoc(doc(db, 'users', user.uid, 'subjects', selectedSubject.id, 'topics', editingTopicId), {
        name: editingTopicName,
        priority: editingTopicPriority,
        updatedAt: serverTimestamp()
      });
      setEditingTopicId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/subjects/${selectedSubject.id}/topics/${editingTopicId}`);
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
    try {
      await addDoc(collection(db, 'users', user.uid, 'subjects', selectedSubject.id, 'topics'), {
        name: newTopicName,
        status: 'not-started',
        priority: newTopicPriority,
        subjectId: selectedSubject.id,
        uid: user.uid,
        updatedAt: serverTimestamp()
      });
      setNewTopicName('');
      setNewTopicPriority('medium');
      setIsAddingTopic(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/subjects/${selectedSubject.id}/topics`);
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
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setIsAddingTopic(false)} className="px-6 py-2 text-slate-500 font-medium">Cancel</button>
                  <button type="submit" className="px-8 py-2 bg-indigo-600 text-white rounded-xl font-bold">Create Topic</button>
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
                        <div className="flex justify-end gap-2">
                          <button 
                            type="button" 
                            onClick={() => setEditingTopicId(null)}
                            className="px-4 py-1.5 text-slate-500 text-sm font-medium"
                          >
                            Cancel
                          </button>
                          <button 
                            type="submit"
                            className="px-6 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-bold"
                          >
                            Save Changes
                          </button>
                        </div>
                      </form>
                    ) : (
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
                        </div>
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
