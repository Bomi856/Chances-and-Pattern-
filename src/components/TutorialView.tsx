import { useEffect, useMemo, useRef, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  BookOpen,
  CheckCircle2,
  Circle,
  Lock,
  LogIn,
  LogOut,
  Play,
  Plus,
  Save,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { TUTORIAL_CURRICULUM } from '../data/tutorialCurriculum';
import {
  OWNER_EMAIL,
  OperationType,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
} from '../firebase';
import { SketchMode } from '../types/studio';

interface FirestoreLessonRecord {
  lessonId: string;
  ownerId: string;
  ownerEmail: string;
  orderIndex: number;
  title: string;
  summary: string;
  notes: string;
  completed: boolean;
}

interface TutorialViewProps {
  onLoadLessonInStudio: (title: string, mode: SketchMode, code: string) => void;
}

export function TutorialView({ onLoadLessonInStudio }: TutorialViewProps) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const [records, setRecords] = useState<FirestoreLessonRecord[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [activeLessonId, setActiveLessonId] = useState<string>(
    TUTORIAL_CURRICULUM[0].lessonId
  );

  const [draftNotes, setDraftNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSavedNotice, setNotesSavedNotice] = useState(false);

  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSummary, setNewSummary] = useState('');
  const [creatingCustom, setCreatingCustom] = useState(false);

  const seededRef = useRef(false);

  const isAuthorizedOwner = Boolean(
    user && user.email === OWNER_EMAIL && user.emailVerified
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      seededRef.current = false;
    });
    return () => unsub();
  }, []);

  // Attach Firestore listener ONLY when verified owner is authenticated
  useEffect(() => {
    if (!authReady || !isAuthorizedOwner || !user) {
      setRecords([]);
      return;
    }

    setLoadingLessons(true);
    const colPath = 'tutorialLessons';
    const q = query(
      collection(db, colPath),
      where('ownerEmail', '==', OWNER_EMAIL)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const docs: FirestoreLessonRecord[] = snapshot.docs.map((d) => {
          const data = d.data() as FirestoreLessonRecord;
          return {
            lessonId: data.lessonId,
            ownerId: data.ownerId,
            ownerEmail: data.ownerEmail,
            orderIndex: data.orderIndex,
            title: data.title,
            summary: data.summary,
            notes: data.notes || '',
            completed: Boolean(data.completed),
          };
        });

        docs.sort((a, b) => a.orderIndex - b.orderIndex);
        setRecords(docs);
        setLoadingLessons(false);

        // Seed built-in curriculum on first login if empty
        if (docs.length === 0 && !seededRef.current) {
          seededRef.current = true;
          void (async () => {
            for (const lesson of TUTORIAL_CURRICULUM) {
              try {
                await setDoc(doc(db, colPath, lesson.lessonId), {
                  lessonId: lesson.lessonId,
                  ownerId: user.uid,
                  ownerEmail: OWNER_EMAIL,
                  orderIndex: lesson.orderIndex,
                  title: lesson.title.slice(0, 160),
                  summary: lesson.summary.slice(0, 400),
                  notes: '',
                  completed: false,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
              } catch (err) {
                handleFirestoreError(
                  err,
                  OperationType.CREATE,
                  `${colPath}/${lesson.lessonId}`
                );
              }
            }
          })();
        }
      },
      (error) => {
        setLoadingLessons(false);
        handleFirestoreError(error, OperationType.GET, colPath);
      }
    );

    return () => unsub();
  }, [authReady, isAuthorizedOwner, user]);

  const activeRecord = useMemo(
    () => records.find((r) => r.lessonId === activeLessonId) || records[0],
    [activeLessonId, records]
  );

  const activeCurriculum = useMemo(
    () =>
      TUTORIAL_CURRICULUM.find(
        (c) => c.lessonId === (activeRecord?.lessonId || activeLessonId)
      ),
    [activeLessonId, activeRecord]
  );

  useEffect(() => {
    if (activeRecord) {
      setDraftNotes(activeRecord.notes || '');
      setNotesSavedNotice(false);
    }
  }, [activeRecord?.lessonId, activeRecord?.notes]);

  const completedCount = useMemo(
    () => records.filter((r) => r.completed).length,
    [records]
  );

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setAuthError(msg);
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    setAuthError(null);
    await signOut(auth);
  };

  const handleToggleCompleted = async (rec: FirestoreLessonRecord) => {
    const path = `tutorialLessons/${rec.lessonId}`;
    try {
      await updateDoc(doc(db, 'tutorialLessons', rec.lessonId), {
        completed: !rec.completed,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleSaveNotes = async () => {
    if (!activeRecord) return;
    setSavingNotes(true);
    const trimmed = draftNotes.slice(0, 8000);
    const path = `tutorialLessons/${activeRecord.lessonId}`;
    try {
      await updateDoc(doc(db, 'tutorialLessons', activeRecord.lessonId), {
        notes: trimmed,
        updatedAt: serverTimestamp(),
      });
      setNotesSavedNotice(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    } finally {
      setSavingNotes(false);
    }
  };

  const handleCreateCustomLesson = async () => {
    if (!user || !isAuthorizedOwner) return;
    const title = newTitle.trim().slice(0, 160);
    const summary = newSummary.trim().slice(0, 400);
    if (!title || !summary) return;

    setCreatingCustom(true);
    const lessonId = `note-${Date.now()}`;
    const maxOrder = records.reduce(
      (max, r) => Math.max(max, r.orderIndex),
      TUTORIAL_CURRICULUM.length
    );

    try {
      await setDoc(doc(db, 'tutorialLessons', lessonId), {
        lessonId,
        ownerId: user.uid,
        ownerEmail: OWNER_EMAIL,
        orderIndex: maxOrder + 1,
        title,
        summary,
        notes: '',
        completed: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewTitle('');
      setNewSummary('');
      setShowNewForm(false);
      setActiveLessonId(lessonId);
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.CREATE,
        `tutorialLessons/${lessonId}`
      );
    } finally {
      setCreatingCustom(false);
    }
  };

  const handleDeleteCustomLesson = async (lessonId: string) => {
    if (TUTORIAL_CURRICULUM.some((c) => c.lessonId === lessonId)) return;
    const path = `tutorialLessons/${lessonId}`;
    try {
      await deleteDoc(doc(db, 'tutorialLessons', lessonId));
      if (activeLessonId === lessonId) {
        setActiveLessonId(TUTORIAL_CURRICULUM[0].lessonId);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  // Auth loading state
  if (!authReady) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-xs font-mono text-zinc-400">
          Verifying session...
        </div>
      </div>
    );
  }

  // Unauthenticated Sign-In Gate
  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full border border-zinc-800 rounded-xl bg-[#111114] p-7 space-y-5">
          <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
            <Lock className="w-5 h-5 text-amber-400" aria-hidden="true" />
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-xl font-semibold text-zinc-100">
              Private Generative Pattern Tutorial
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed">
              This curriculum and personal study notebook is restricted exclusively to the owner account. Sign in with Google to unlock your lessons.
            </p>
          </div>

          {authError && (
            <div
              role="alert"
              className="border border-red-900/70 bg-red-950/40 rounded-lg p-3 text-xs text-red-200 font-mono break-words"
            >
              {authError}
            </div>
          )}

          <button
            type="button"
            disabled={signingIn}
            onClick={handleGoogleSignIn}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 text-sm font-semibold transition-colors"
          >
            <LogIn className="w-4 h-4" aria-hidden="true" />
            <span>{signingIn ? 'Signing in...' : 'Sign in with Google'}</span>
          </button>
        </div>
      </div>
    );
  }

  // Wrong Account Gate
  if (!isAuthorizedOwner) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full border border-zinc-800 rounded-xl bg-[#111114] p-7 space-y-5">
          <div className="w-10 h-10 rounded-lg bg-red-950/60 border border-red-900/70 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-red-400" aria-hidden="true" />
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-xl font-semibold text-zinc-100">
              Access Restricted
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Signed in as <span className="text-zinc-200 font-mono text-xs">{user.email}</span>. Only the verified owner account has permission to access this private tutorial.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-sm font-medium transition-colors"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    );
  }

  // Authorized Owner View
  return (
    <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-[300px_1fr] max-w-[1440px] w-full mx-auto">
      {/* Left Sidebar: Lesson Navigation */}
      <aside className="border-b lg:border-b-0 lg:border-r border-zinc-800 bg-[#0D0D10] flex flex-col min-h-0">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between gap-2">
          <div>
            <div className="text-xs font-medium text-zinc-200">
              Your Curriculum
            </div>
            <div className="text-[11px] font-mono tabular-nums text-zinc-400 mt-0.5">
              {completedCount} / {records.length} completed
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowNewForm((s) => !s)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-200 transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Add Topic</span>
          </button>
        </div>

        {showNewForm && (
          <div className="p-3 border-b border-zinc-800 bg-[#111114] space-y-2.5">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Lesson or study topic title"
              maxLength={160}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <input
              type="text"
              value={newSummary}
              onChange={(e) => setNewSummary(e.target.value)}
              placeholder="Short summary of what to practice"
              maxLength={400}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewForm(false)}
                className="px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={creatingCustom || !newTitle.trim() || !newSummary.trim()}
                onClick={handleCreateCustomLesson}
                className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-zinc-950 text-xs font-semibold"
              >
                {creatingCustom ? 'Saving...' : 'Create'}
              </button>
            </div>
          </div>
        )}

        <nav
          aria-label="Tutorial lessons"
          className="flex-1 overflow-y-auto divide-y divide-zinc-800/60"
        >
          {loadingLessons && records.length === 0 ? (
            <div className="p-4 text-xs text-zinc-500 font-mono">
              Loading private lessons...
            </div>
          ) : (
            records.map((rec) => {
              const isSelected = activeRecord?.lessonId === rec.lessonId;
              const isCustom = !TUTORIAL_CURRICULUM.some(
                (c) => c.lessonId === rec.lessonId
              );
              return (
                <div
                  key={rec.lessonId}
                  className={`flex items-start gap-2.5 px-4 py-3 transition-colors ${
                    isSelected ? 'bg-zinc-900/90' : 'hover:bg-zinc-900/40'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleToggleCompleted(rec)}
                    className="mt-0.5 text-zinc-400 hover:text-amber-400 transition-colors shrink-0"
                    aria-label={
                      rec.completed
                        ? `Mark ${rec.title} incomplete`
                        : `Mark ${rec.title} complete`
                    }
                  >
                    {rec.completed ? (
                      <CheckCircle2
                        className="w-4 h-4 text-amber-400"
                        aria-hidden="true"
                      />
                    ) : (
                      <Circle className="w-4 h-4" aria-hidden="true" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveLessonId(rec.lessonId)}
                    className="flex-1 text-left min-w-0"
                  >
                    <div
                      className={`text-xs font-medium leading-snug ${
                        isSelected ? 'text-zinc-100' : 'text-zinc-300'
                      }`}
                    >
                      {rec.title}
                    </div>
                  </button>

                  {isCustom && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCustomLesson(rec.lessonId)}
                      className="p-1 text-zinc-500 hover:text-red-400 shrink-0"
                      aria-label={`Delete ${rec.title}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </nav>

        <div className="p-3.5 border-t border-zinc-800 flex items-center justify-between gap-2 bg-[#09090B]">
          <span className="text-[11px] font-mono text-zinc-400 truncate">
            {user.email}
          </span>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-100 whitespace-nowrap shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Lesson Content */}
      <div className="flex-1 overflow-y-auto p-6 lg:p-10">
        {activeRecord ? (
          <div className="max-w-3xl space-y-8">
            <header className="pb-6 border-b border-zinc-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
                  <BookOpen className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                  <span>Private Study Guide</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {activeRecord.completed ? 'Completed' : 'In Progress'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleCompleted(activeRecord)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeRecord.completed
                      ? 'bg-zinc-800 text-amber-400 border border-zinc-700'
                      : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800'
                  }`}
                >
                  {activeRecord.completed ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Completed</span>
                    </>
                  ) : (
                    <>
                      <Circle className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Mark Complete</span>
                    </>
                  )}
                </button>
              </div>

              <h1 className="font-display text-2xl font-semibold tracking-tight text-zinc-100">
                {activeRecord.title}
              </h1>
              <p className="text-sm text-zinc-300 leading-relaxed">
                {activeRecord.summary}
              </p>
            </header>

            {activeCurriculum && (
              <>
                <section className="space-y-5">
                  {activeCurriculum.sections.map((sec) => (
                    <div key={sec.heading} className="space-y-1.5">
                      <h2 className="font-display text-base font-semibold text-zinc-100">
                        {sec.heading}
                      </h2>
                      <p className="text-sm text-zinc-300 leading-relaxed">
                        {sec.body}
                      </p>
                    </div>
                  ))}
                </section>

                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="font-display text-base font-semibold text-zinc-100">
                      Interactive Lesson Code
                    </h2>
                    <button
                      type="button"
                      onClick={() =>
                        onLoadLessonInStudio(
                          activeRecord.title,
                          activeCurriculum.mode,
                          activeCurriculum.codeExample
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold transition-colors whitespace-nowrap"
                    >
                      <Play className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Try in Studio</span>
                    </button>
                  </div>

                  <pre className="border border-zinc-800 rounded-xl bg-[#111114] p-4 overflow-x-auto font-mono text-xs leading-relaxed text-zinc-200">
                    <code>{activeCurriculum.codeExample}</code>
                  </pre>
                </section>

                <section className="space-y-2.5">
                  <h2 className="font-display text-base font-semibold text-zinc-100">
                    Experiments to Try Yourself
                  </h2>
                  <ul className="space-y-2 text-sm text-zinc-300 list-disc pl-5">
                    {activeCurriculum.experiments.map((exp, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {exp}
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            )}

            {/* Personal Study Notes (Persisted in Firestore for owner only) */}
            <section className="pt-6 border-t border-zinc-800 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-base font-semibold text-zinc-100">
                    Personal Study Notes
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Saved privately to your account in Firestore.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {notesSavedNotice && (
                    <span className="text-xs font-mono text-amber-400">
                      Saved
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={savingNotes}
                    onClick={handleSaveNotes}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-100 text-xs font-medium transition-colors whitespace-nowrap"
                  >
                    <Save className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{savingNotes ? 'Saving...' : 'Save Notes'}</span>
                  </button>
                </div>
              </div>

              <textarea
                value={draftNotes}
                onChange={(e) => {
                  setDraftNotes(e.target.value);
                  setNotesSavedNotice(false);
                }}
                maxLength={8000}
                rows={6}
                placeholder="Write down parameter values, palette constants, or math reminders..."
                aria-label="Personal study notes"
                className="w-full rounded-xl border border-zinc-800 bg-[#111114] p-3.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </section>
          </div>
        ) : (
          <div className="text-xs text-zinc-500 font-mono">
            Select a lesson from the sidebar.
          </div>
        )}
      </div>
    </div>
  );
}
