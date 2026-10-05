import { create } from 'zustand';
import { soundEffects } from '../utils/soundEffects';
import { useAnnouncerStore } from './useAnnouncerStore';
import { useBootstrapStore } from '../stores/useBootstrapStore';
import { getDataSource } from '../services/dataSource';
import { onSessionExpired } from '../services/dataSource/apiToken';
import type {
  AccessibilityPreference,
  AttemptSummary,
  UserProfile,
} from '../../shared/types';

export const authBroadcastChannel =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('dristix_auth_sync')
    : null;

if (authBroadcastChannel) {
  authBroadcastChannel.onmessage = (event) => {
    if (event.data === 'LOGIN') {
      void useBootstrapStore.getState().run();
    } else if (event.data === 'LOGOUT') {
      useAuthStore.getState().setSession(null);
    }
  };
}

/**
 * Maps a server AttemptSummary onto the local ExamSubmission shape so every
 * existing consumer — student analytics, admin panel, the voice assistant's
 * context builder — keeps working without knowing which data source it reads.
 */
function toSubmission(
  a: AttemptSummary,
  student?: { name?: string; rollNumber?: string }
): ExamSubmission {
  return {
    id: a.id,
    examId: a.examId,
    examTitle: a.examTitle,
    examCode: a.examCode,
    examType: a.mode,
    studentId: a.student?.rollNumber ?? student?.rollNumber ?? '',
    studentName: a.student?.name ?? student?.name ?? '',
    studentRoll: a.student?.rollNumber ?? student?.rollNumber ?? '',
    score: a.score ?? 0,
    maxScore: a.maxScore ?? 0,
    percentage: a.percentage ?? 0,
    correctCount: a.correctCount ?? 0,
    incorrectCount: a.incorrectCount ?? 0,
    unattemptedCount: a.unattemptedCount ?? 0,
    submittedAt: a.submittedAt ? new Date(a.submittedAt).getTime() : 0,
  };
}

/**
 * The UI-facing student shape. It is the shared `UserProfile` plus the
 * `registeredAt` timestamp the roster views display, made optional because the
 * server only sends it on the admin roster endpoint — a signed-in student's
 * profile does not carry it.
 */
export interface StudentProfile extends Omit<UserProfile, 'accessibilityPreference'> {
  accessibilityPreference: AccessibilityPreference | null;
  registeredAt?: number;
}

export interface ExamSubmission {
  id: string;
  examId: string;
  examTitle: string;
  examCode: string;
  examType: 'exam' | 'practice';
  studentId: string;
  studentName: string;
  studentRoll: string;
  score: number;
  maxScore: number;
  percentage: number;
  correctCount: number;
  incorrectCount: number;
  unattemptedCount: number;
  submittedAt: number;
}


interface AuthState {
  currentStudent: StudentProfile | null;
  students: StudentProfile[];
  submissions: ExamSubmission[];
  isAdminAuthenticated: boolean;

  /**
   * Applies the session resolved during bootstrap. The server is the only
   * authority on who is signed in; nothing is cached in localStorage.
   */
  setSession: (user: StudentProfile | null) => void;

  // Student Actions — all async: the server decides.
  loginStudent: (identifier: string, pass: string) => Promise<boolean>;
  registerStudent: (
    name: string,
    email: string,
    roll: string,
    preference: StudentProfile['accessibilityPreference'],
    pass: string
  ) => Promise<boolean>;
  logoutStudent: () => Promise<void>;

  // Admin Actions
  loginAdmin: (username: string, pass: string) => Promise<boolean>;
  logoutAdmin: () => void;
  fetchStudents: () => Promise<void>;
  deleteStudent: (studentId: string) => Promise<boolean>;

  // Password Reset Actions
  requestPasswordReset: (
    identifier: string,
    portal: 'student' | 'admin'
  ) => Promise<{
    ok: boolean;
    success?: boolean;
    message: string;
    maskedEmail?: string;
    email?: string;
    devCode?: string;
  }>;
  verifyResetCode: (
    email: string,
    code: string
  ) => Promise<{
    ok: boolean;
    success?: boolean;
    resetToken: string;
    message: string;
  }>;
  resetPassword: (
    email: string,
    resetToken: string,
    newPassword: string
  ) => Promise<{
    ok: boolean;
    success?: boolean;
    message: string;
  }>;

  // Submissions Actions
  /**
   * Reloads the submission history from the active data source.
   *
   * In api mode the Attempt documents on the server ARE the submissions, so
   * this replaces whatever the store had. Admins get every student's results;
   * a student gets only their own. In offline mode it is a no-op because the
   * history already lives in localStorage.
   */
  syncSubmissions: () => Promise<void>;
  addSubmission: (
    sub: Omit<ExamSubmission, 'id' | 'submittedAt' | 'studentId' | 'studentName' | 'studentRoll'>
  ) => void;
  deleteSubmission: (submissionId: string) => void;
}

/**
 * Submissions are a server-side projection of the Attempt documents, but the
 * admin panel can still delete one locally, so the trimmed list is cached to
 * avoid refetching on every render. It is a cache, never a source of truth.
 */
const SUBMISSIONS_CACHE = 'dristix_submissions_cache';

const saveStored = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota errors
  }
};

export const useAuthStore = create<AuthState>((set, get) => {
  // Nothing is read from localStorage any more.
  //
  // The session is owned by the server: an httpOnly refresh cookie plus a
  // short-lived access token held in memory. A previous version cached
  // `currentStudent` in localStorage and read it at module scope, which meant a
  // browser left over from offline mode rendered the full portal while every
  // API call 401'd — the app looked signed in but was not.
  const initialAdminAuth = sessionStorage.getItem('dristix_admin_auth') === 'true';

  return {
    currentStudent: null,
    students: [],
    submissions: [],
    isAdminAuthenticated: initialAdminAuth,

    /**
     * Applies a session resolved by the bootstrap flow, or clears it on sign
     * out. This is the only way `currentStudent` is set from outside.
     */
    setSession: (user: StudentProfile | null) => set({ currentStudent: user }),

    loginStudent: async (identifier: string, pass: string) => {
      try {
        const { user } = await getDataSource().auth.login(identifier, pass);
        set({ currentStudent: user });
        authBroadcastChannel?.postMessage('LOGIN');
        soundEffects.playSuccess();
        useAnnouncerStore
          .getState()
          .announce(
            `Welcome ${user.name}. Logged in successfully with Roll Number ${user.rollNumber}.`,
            'assertive',
            true
          );
        return true;
      } catch {
        soundEffects.playSelect();
        useAnnouncerStore
          .getState()
          .announce('Invalid student credentials. Please check your Roll Number, Email and password.', 'assertive', true);
        return false;
      }
    },

    registerStudent: async (name, email, roll, preference, pass) => {
      try {
        const { user } = await getDataSource().auth.register({
          name,
          email,
          rollNumber: roll,
          password: pass,
          accessibilityPreference: preference ?? undefined,
        });
        set({ currentStudent: user });
        authBroadcastChannel?.postMessage('LOGIN');
        // Keep the roster fresh so admin views and the demo list stay accurate.
        void getDataSource().auth
          .listStudents()
          .then((students) => set({ students }))
          .catch(() => undefined);

        soundEffects.playSuccess();
        useAnnouncerStore
          .getState()
          .announce(`Registration successful! Welcome to DristiX, ${user.name}.`, 'assertive', true);
        return true;
      } catch {
        useAnnouncerStore
          .getState()
          .announce(
            'Registration failed. That Email or Roll Number may already be registered.',
            'assertive',
            true
          );
        return false;
      }
    },

    logoutStudent: async () => {
      try {
        await getDataSource().auth.logout();
      } catch {
        // Clearing local state matters more than the server round trip.
      }
      set({ currentStudent: null, submissions: [], students: [] });
      authBroadcastChannel?.postMessage('LOGOUT');
      soundEffects.playNavigate();
      useAnnouncerStore.getState().announce('Signed out of student account.', 'polite', true);
    },

    loginAdmin: async (username: string, pass: string) => {
      try {
        await getDataSource().auth.adminLogin(username, pass);
        set({ isAdminAuthenticated: true });
        sessionStorage.setItem('dristix_admin_auth', 'true');
        soundEffects.playSuccess();
        useAnnouncerStore
          .getState()
          .announce('Admin authentication successful. Welcome to DristiX Admin Studio.', 'assertive', true);
        return true;
      } catch {
        useAnnouncerStore
          .getState()
          .announce('Authentication failed. Invalid administrator username or password.', 'assertive', true);
        return false;
      }
    },

    logoutAdmin: () => {
      set({ isAdminAuthenticated: false });
      sessionStorage.removeItem('dristix_admin_auth');
      soundEffects.playNavigate();
      useAnnouncerStore.getState().announce('Logged out of Admin Studio.', 'polite', true);
    },

    fetchStudents: async () => {
      try {
        const students = await getDataSource().auth.listStudents();
        set({ students });
      } catch (err) {
        console.error('[dristix] fetchStudents error', err);
      }
    },

    deleteStudent: async (studentId: string) => {
      try {
        await getDataSource().auth.deleteStudent(studentId);
        set((state) => ({
          students: state.students.filter((s) => s.id !== studentId),
        }));
        soundEffects.playSuccess();
        useAnnouncerStore.getState().announce('Student account successfully removed.', 'assertive', true);
        return true;
      } catch (err) {
        console.error('[dristix] deleteStudent error', err);
        useAnnouncerStore.getState().announce('Could not delete student account.', 'assertive', true);
        return false;
      }
    },

    requestPasswordReset: async (identifier: string, portal: 'student' | 'admin' = 'student') => {
      return getDataSource().auth.requestPasswordReset(identifier, portal);
    },

    verifyResetCode: async (email: string, code: string) => {
      return getDataSource().auth.verifyResetCode(email, code);
    },

    resetPassword: async (email: string, resetToken: string, newPassword: string) => {
      const res = await getDataSource().auth.resetPassword(email, resetToken, newPassword);
      if (res.ok || res.success) {
        soundEffects.playSuccess();
      }
      return res;
    },

    syncSubmissions: async () => {
      // Single data source: always refresh from the backend.
      try {
        const source = getDataSource();
        // Admins see the whole cohort; a student only their own attempts.
        const rows = get().isAdminAuthenticated
          ? (await source.exams.listAllSubmissions()).map((a) => toSubmission(a, a.student))
          : (await source.exams.listAttempts()).map((a) => {
              const me = get().currentStudent;
              return toSubmission(a, me ? { name: me.name, rollNumber: me.rollNumber } : undefined);
            });

        // Only completed attempts belong in a result history.
        set({ submissions: rows.filter((r) => r.submittedAt > 0) });
      } catch {
        // Keep whatever we already have; a failed refresh is not worth a
        // disruptive empty state.
      }
    },

    addSubmission: (sub) => {
      // In api mode the server already recorded this when the attempt was
      // submitted, so writing a second local copy would create a duplicate the
      // next refresh would contradict. Refresh from the server instead.
      const student = get().currentStudent || {
        id: 'std-guest',
        name: 'Guest Candidate',
        rollNumber: 'DX-GUEST',
      };

      const newSub: ExamSubmission = {
        ...sub,
        id: `sub-${Date.now().toString().slice(-6)}`,
        studentId: student.id,
        studentName: student.name,
        studentRoll: student.rollNumber,
        submittedAt: Date.now(),
      };

      const updated = [newSub, ...get().submissions];
      set({ submissions: updated });
      saveStored(SUBMISSIONS_CACHE, updated);
    },

    deleteSubmission: (submissionId: string) => {
      const updated = get().submissions.filter((s) => s.id !== submissionId);
      set({ submissions: updated });
      saveStored(SUBMISSIONS_CACHE, updated);
      soundEffects.playSelect();
      useAnnouncerStore.getState().announce('Submission record deleted.', 'polite', true);
    },
  };
});

// Automatically reset student session when API token refresh fails/expires
onSessionExpired(() => {
  if (useAuthStore.getState().currentStudent) {
    useAuthStore.getState().setSession(null);
    useAnnouncerStore.getState().announce('Your session has expired. Please sign in again.', 'assertive', true);
  }
});
