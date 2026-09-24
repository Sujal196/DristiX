import { create } from 'zustand';
import { soundEffects } from '../utils/soundEffects';
import { useAnnouncerStore } from './useAnnouncerStore';

export interface StudentProfile {
  id: string;
  name: string;
  email: string;
  rollNumber: string;
  accessibilityPreference: 'Screen Reader' | 'High Contrast' | 'Low Vision' | 'Standard';
  registeredAt: number;
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

const SEED_STUDENTS: StudentProfile[] = [
  {
    id: 'std-101',
    name: 'Rohit Sharma',
    email: 'rohit@dristix.edu',
    rollNumber: 'DX-101',
    accessibilityPreference: 'Screen Reader',
    registeredAt: Date.now() - 7 * 86400000,
  },
  {
    id: 'std-102',
    name: 'Ananya Verma',
    email: 'ananya@dristix.edu',
    rollNumber: 'DX-102',
    accessibilityPreference: 'High Contrast',
    registeredAt: Date.now() - 5 * 86400000,
  },
  {
    id: 'std-103',
    name: 'Vikram Singh',
    email: 'vikram@dristix.edu',
    rollNumber: 'DX-103',
    accessibilityPreference: 'Low Vision',
    registeredAt: Date.now() - 3 * 86400000,
  },
];

const SEED_SUBMISSIONS: ExamSubmission[] = [
  {
    id: 'sub-001',
    examId: 'ssc-cgl-tier1-full',
    examTitle: 'SSC CGL Tier-1 Comprehensive Mock Test',
    examCode: 'SSC-CGL-01',
    examType: 'exam',
    studentId: 'std-101',
    studentName: 'Rohit Sharma',
    studentRoll: 'DX-101',
    score: 16.5,
    maxScore: 20,
    percentage: 85,
    correctCount: 9,
    incorrectCount: 1,
    unattemptedCount: 0,
    submittedAt: Date.now() - 2 * 86400000 + 3600000,
  },
  {
    id: 'sub-002',
    examId: 'ibps-po-quant-speed',
    examTitle: 'IBPS PO Quantitative Aptitude Speed Drill',
    examCode: 'IBPS-PO-02',
    examType: 'exam',
    studentId: 'std-102',
    studentName: 'Ananya Verma',
    studentRoll: 'DX-102',
    score: 8,
    maxScore: 10,
    percentage: 80,
    correctCount: 4,
    incorrectCount: 1,
    unattemptedCount: 0,
    submittedAt: Date.now() - 1 * 86400000 + 7200000,
  },
  {
    id: 'sub-003',
    examId: 'practice-quant-arithmetic',
    examTitle: 'Quantitative Aptitude: Arithmetic & Algebra Practice Drill',
    examCode: 'PRACTICE-QA-01',
    examType: 'practice',
    studentId: 'std-101',
    studentName: 'Rohit Sharma',
    studentRoll: 'DX-101',
    score: 10,
    maxScore: 10,
    percentage: 100,
    correctCount: 5,
    incorrectCount: 0,
    unattemptedCount: 0,
    submittedAt: Date.now() - 12 * 3600000,
  },
  {
    id: 'sub-004',
    examId: 'upsc-csat-paper2',
    examTitle: 'UPSC Civil Services CSAT Paper-II Practice Test',
    examCode: 'CSAT-P2-01',
    examType: 'exam',
    studentId: 'std-103',
    studentName: 'Vikram Singh',
    studentRoll: 'DX-103',
    score: 6.5,
    maxScore: 10,
    percentage: 70,
    correctCount: 4,
    incorrectCount: 1,
    unattemptedCount: 0,
    submittedAt: Date.now() - 5 * 3600000,
  },
];

interface AuthState {
  currentStudent: StudentProfile | null;
  students: StudentProfile[];
  submissions: ExamSubmission[];
  isAdminAuthenticated: boolean;

  // Student Actions
  loginStudent: (identifier: string, pass: string) => boolean;
  quickLoginStudent: (studentId: string) => void;
  registerStudent: (
    name: string,
    email: string,
    roll: string,
    preference: StudentProfile['accessibilityPreference'],
    pass: string
  ) => boolean;
  logoutStudent: () => void;

  // Admin Actions
  loginAdmin: (username: string, pass: string) => boolean;
  logoutAdmin: () => void;

  // Submissions Actions
  addSubmission: (
    sub: Omit<ExamSubmission, 'id' | 'submittedAt' | 'studentId' | 'studentName' | 'studentRoll'>
  ) => void;
  deleteSubmission: (submissionId: string) => void;
}

const loadStored = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const saveStored = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota errors
  }
};

export const useAuthStore = create<AuthState>((set, get) => {
  const initialStudents = loadStored<StudentProfile[]>('dristix_students', SEED_STUDENTS);
  const initialSubmissions = loadStored<ExamSubmission[]>('dristix_submissions', SEED_SUBMISSIONS);
  const initialCurrentStudent = loadStored<StudentProfile | null>(
    'dristix_current_student',
    initialStudents[0] // Default to Rohit Sharma for seamless evaluation
  );
  const initialAdminAuth = sessionStorage.getItem('dristix_admin_auth') === 'true';

  return {
    currentStudent: initialCurrentStudent,
    students: initialStudents,
    submissions: initialSubmissions,
    isAdminAuthenticated: initialAdminAuth,

    loginStudent: (identifier: string, _pass: string) => {
      const clean = identifier.trim().toLowerCase();
      const student = get().students.find(
        (s) => s.email.toLowerCase() === clean || s.rollNumber.toLowerCase() === clean
      );

      if (student) {
        set({ currentStudent: student });
        saveStored('dristix_current_student', student);
        soundEffects.playSuccess();
        useAnnouncerStore
          .getState()
          .announce(
            `Welcome ${student.name}. Logged in successfully with Roll Number ${student.rollNumber}.`,
            'assertive',
            true
          );
        return true;
      }

      soundEffects.playSelect();
      useAnnouncerStore
        .getState()
        .announce('Invalid student credentials. Please check your Roll Number or Email.', 'assertive', true);
      return false;
    },

    quickLoginStudent: (studentId: string) => {
      const student = get().students.find((s) => s.id === studentId);
      if (student) {
        set({ currentStudent: student });
        saveStored('dristix_current_student', student);
        soundEffects.playSuccess();
        useAnnouncerStore
          .getState()
          .announce(`Logged in as demo candidate: ${student.name}, Roll Number ${student.rollNumber}.`, 'assertive', true);
      }
    },

    registerStudent: (name, email, roll, preference, _pass) => {
      const existing = get().students.find(
        (s) => s.email.toLowerCase() === email.trim().toLowerCase() || s.rollNumber.toLowerCase() === roll.trim().toLowerCase()
      );
      if (existing) {
        useAnnouncerStore
          .getState()
          .announce('A candidate with this Email or Roll Number is already registered.', 'assertive', true);
        return false;
      }

      const newStudent: StudentProfile = {
        id: `std-${Date.now().toString().slice(-4)}`,
        name: name.trim(),
        email: email.trim(),
        rollNumber: roll.trim(),
        accessibilityPreference: preference,
        registeredAt: Date.now(),
      };

      const updated = [newStudent, ...get().students];
      set({ students: updated, currentStudent: newStudent });
      saveStored('dristix_students', updated);
      saveStored('dristix_current_student', newStudent);

      soundEffects.playSuccess();
      useAnnouncerStore
        .getState()
        .announce(`Registration successful! Welcome to DristiX, ${newStudent.name}.`, 'assertive', true);
      return true;
    },

    logoutStudent: () => {
      set({ currentStudent: null });
      localStorage.removeItem('dristix_current_student');
      soundEffects.playNavigate();
      useAnnouncerStore.getState().announce('Signed out of student account.', 'polite', true);
    },

    loginAdmin: (username: string, pass: string) => {
      if (username.trim().toLowerCase() === 'admin' && pass === 'admin123') {
        set({ isAdminAuthenticated: true });
        sessionStorage.setItem('dristix_admin_auth', 'true');
        soundEffects.playSuccess();
        useAnnouncerStore
          .getState()
          .announce('Admin authentication successful. Welcome to DristiX Admin Studio.', 'assertive', true);
        return true;
      }

      useAnnouncerStore
        .getState()
        .announce('Authentication failed. Invalid administrator username or password.', 'assertive', true);
      return false;
    },

    logoutAdmin: () => {
      set({ isAdminAuthenticated: false });
      sessionStorage.removeItem('dristix_admin_auth');
      soundEffects.playNavigate();
      useAnnouncerStore.getState().announce('Logged out of Admin Studio.', 'polite', true);
    },

    addSubmission: (sub) => {
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
      saveStored('dristix_submissions', updated);
    },

    deleteSubmission: (submissionId: string) => {
      const updated = get().submissions.filter((s) => s.id !== submissionId);
      set({ submissions: updated });
      saveStored('dristix_submissions', updated);
      soundEffects.playSelect();
      useAnnouncerStore.getState().announce('Submission record deleted.', 'polite', true);
    },
  };
});
