import React, { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useExamStore } from '../../store/useExamStore';
import { useAnnouncerStore } from '../../store/useAnnouncerStore';
import { soundEffects } from '../../utils/soundEffects';
import { verbalizeMath } from '../../utils/mathVerbalizer';
import { MathEquation } from '../common/MathEquation';
import type { Exam, ExamCategory } from '../../data/exams';
import type { QuestionItem } from '../../data/questions';
import {
  Users,
  FileText,
  PlusCircle,
  LogOut,
  ArrowLeft,
  Volume2,
  Trash2,
  Play,
  CheckCircle,
  Award,
  TrendingUp,
} from 'lucide-react';

interface AdminPanelProps {
  onReturnToStudent: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onReturnToStudent }) => {
  const { students, submissions, logoutAdmin, deleteSubmission } = useAuthStore();
  const {
    availableExams,
    availablePracticeDrills,
    addNewExam,
    deleteCustomExam,
    selectExam,
  } = useExamStore();
  const { announce } = useAnnouncerStore();

  const [activeAdminTab, setActiveAdminTab] = useState<'analytics' | 'manage' | 'create'>('analytics');
  const [submissionSearch, setSubmissionSearch] = useState('');
  const [selectedExamFilter, setSelectedExamFilter] = useState('All');

  // Exam Creator Form State
  const [examType, setExamType] = useState<'exam' | 'practice'>('exam');
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState<ExamCategory>('Staff Selection');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [totalMarks, setTotalMarks] = useState(50);
  const [negativeMarking, setNegativeMarking] = useState('-0.25 marks');
  const [difficulty, setDifficulty] = useState<'Easy' | 'Moderate' | 'Challenging'>('Moderate');
  const [description, setDescription] = useState('');

  // Questions Authoring
  const [questions, setQuestions] = useState<QuestionItem[]>([
    {
      id: `custom-q-1`,
      section: 'Quantitative Aptitude',
      questionNumber: 1,
      questionText: 'What is the sum of angles in a triangle?',
      mathLatex: 'A + B + C = 180^\\circ',
      options: [
        { id: 'opt_1', number: 1, text: '90 degrees' },
        { id: 'opt_2', number: 2, text: '180 degrees' },
        { id: 'opt_3', number: 3, text: '270 degrees' },
        { id: 'opt_4', number: 4, text: '360 degrees' },
      ],
      correctOption: 2,
      explanation: 'The sum of all three interior angles in any Euclidean triangle is always 180 degrees.',
      hint: 'Recall the angle sum property of plane geometry.',
    },
  ]);

  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Calculations for KPI Cards
  const totalSubmissions = submissions.length;
  const avgScore =
    totalSubmissions > 0
      ? Math.round(submissions.reduce((acc, s) => acc + s.percentage, 0) / totalSubmissions)
      : 0;

  // Filtered Submissions
  const filteredSubmissions = submissions.filter((sub) => {
    const matchesSearch =
      submissionSearch.trim() === '' ||
      sub.studentName.toLowerCase().includes(submissionSearch.toLowerCase()) ||
      sub.studentRoll.toLowerCase().includes(submissionSearch.toLowerCase()) ||
      sub.examTitle.toLowerCase().includes(submissionSearch.toLowerCase()) ||
      sub.examCode.toLowerCase().includes(submissionSearch.toLowerCase());

    const matchesExam =
      selectedExamFilter === 'All' || sub.examCode === selectedExamFilter;

    return matchesSearch && matchesExam;
  });

  const handleSpeakResult = (sub: (typeof submissions)[0]) => {
    soundEffects.playSelect();
    const msg = `Candidate ${sub.studentName}, Roll Number ${sub.studentRoll}, completed ${sub.examTitle} on ${new Date(
      sub.submittedAt
    ).toLocaleDateString()}. Score: ${sub.score} out of ${sub.maxScore} points, accuracy ${sub.percentage} percent.`;
    announce(msg, 'assertive', true);
  };

  const handleAddQuestion = () => {
    const nextNum = questions.length + 1;
    const newQ: QuestionItem = {
      id: `custom-q-${Date.now()}-${nextNum}`,
      section: questions[0]?.section || 'General',
      questionNumber: nextNum,
      questionText: '',
      mathLatex: '',
      options: [
        { id: `opt_${nextNum}_1`, number: 1, text: '' },
        { id: `opt_${nextNum}_2`, number: 2, text: '' },
        { id: `opt_${nextNum}_3`, number: 3, text: '' },
        { id: `opt_${nextNum}_4`, number: 4, text: '' },
      ],
      correctOption: 1,
      explanation: '',
      hint: '',
    };
    setQuestions([...questions, newQ]);
    soundEffects.playNavigate();
  };

  const handleRemoveQuestion = (idx: number) => {
    if (questions.length <= 1) return;
    const updated = questions.filter((_, i) => i !== idx).map((q, i) => ({ ...q, questionNumber: i + 1 }));
    setQuestions(updated);
  };

  const handleUpdateQuestion = (idx: number, field: keyof QuestionItem, val: any) => {
    const updated = [...questions];
    updated[idx] = { ...updated[idx], [field]: val };
    setQuestions(updated);
  };

  const handleUpdateOption = (qIdx: number, optNum: number, text: string) => {
    const updated = [...questions];
    const opts = updated[qIdx].options.map((o) => (o.number === optNum ? { ...o, text } : o));
    updated[qIdx] = { ...updated[qIdx], options: opts };
    setQuestions(updated);
  };

  const handlePublishExam = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!title.trim() || !code.trim() || !description.trim()) {
      setFormError('Please fill in Exam Title, Code, and Description.');
      return;
    }

    // Verify all questions have text and options
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText.trim()) {
        setFormError(`Question ${i + 1} is missing its question text.`);
        return;
      }
      for (const opt of q.options) {
        if (!opt.text.trim()) {
          setFormError(`Question ${i + 1}, Option ${opt.number} cannot be empty.`);
          return;
        }
      }
    }

    const newExam: Exam = {
      id: `exam-${Date.now()}`,
      code: code.trim().toUpperCase(),
      title: title.trim(),
      description: description.trim(),
      category: category === 'All' ? 'Staff Selection' : category,
      durationMinutes: Number(durationMinutes),
      totalMarks: Number(totalMarks),
      negativeMarking: examType === 'practice' ? 'No negative marking (Practice)' : negativeMarking,
      difficulty,
      sections: Array.from(new Set(questions.map((q) => q.section))),
      questions,
    };

    addNewExam(newExam, examType);
    setFormSuccess(`"${newExam.title}" was published successfully! Students can now take it.`);
    soundEffects.playSuccess();

    // Reset creator form
    setTitle('');
    setCode('');
    setDescription('');
  };

  const handleTestAsStudent = (exam: Exam, type: 'exam' | 'practice') => {
    selectExam(exam.id, type);
    onReturnToStudent();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Admin Navigation Header */}
      <header className="mb-6 p-4 sm:p-6 rounded-2xl bg-theme-surface border-2 border-theme-border shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase bg-indigo-600 text-white tracking-wider">
              Admin Studio
            </span>
            <span className="text-xs text-theme-text/60">• Examiner & Analytics Workspace</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-theme-text">
            DristiX Examination Administration
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            type="button"
            onClick={onReturnToStudent}
            className="flex-1 md:flex-none px-4 py-2.5 rounded-xl border-2 border-theme-border bg-theme-bg hover:border-theme-primary text-theme-text font-bold text-sm flex items-center justify-center gap-2 transition focus:ring-4 focus:ring-theme-focus"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Student Portal</span>
          </button>

          <button
            type="button"
            onClick={logoutAdmin}
            className="flex-1 md:flex-none px-4 py-2.5 rounded-xl border-2 border-red-500/40 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white font-bold text-sm flex items-center justify-center gap-2 transition focus:ring-4 focus:ring-red-500/30"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Admin Tabs */}
      <nav
        role="tablist"
        aria-label="Admin Studio Sections"
        className="mb-8 p-1.5 rounded-2xl bg-theme-surface border-2 border-theme-border flex flex-col sm:flex-row gap-2 shadow-sm"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeAdminTab === 'analytics'}
          onClick={() => {
            setActiveAdminTab('analytics');
            soundEffects.playSelect();
          }}
          className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition focus:ring-4 focus:ring-theme-focus ${
            activeAdminTab === 'analytics'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-theme-text hover:bg-theme-border/30'
          }`}
        >
          <Users className="w-5 h-5" aria-hidden="true" />
          <span>Students & Exam Submissions ({totalSubmissions})</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeAdminTab === 'manage'}
          onClick={() => {
            setActiveAdminTab('manage');
            soundEffects.playSelect();
          }}
          className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition focus:ring-4 focus:ring-theme-focus ${
            activeAdminTab === 'manage'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-theme-text hover:bg-theme-border/30'
          }`}
        >
          <FileText className="w-5 h-5" aria-hidden="true" />
          <span>Manage Tests & Drills ({availableExams.length + availablePracticeDrills.length})</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeAdminTab === 'create'}
          onClick={() => {
            setActiveAdminTab('create');
            soundEffects.playSelect();
          }}
          className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition focus:ring-4 focus:ring-theme-focus ${
            activeAdminTab === 'create'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-theme-text hover:bg-theme-border/30'
          }`}
        >
          <PlusCircle className="w-5 h-5" aria-hidden="true" />
          <span>Create New Test / Drill</span>
        </button>
      </nav>

      {/* TAB 1: STUDENTS & SUBMISSIONS ANALYTICS */}
      {activeAdminTab === 'analytics' && (
        <section aria-labelledby="submissions-heading" className="space-y-8">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-theme-surface border-2 border-theme-border shadow-sm">
              <span className="text-xs uppercase font-bold text-theme-text/60 block">
                Total Registered Students
              </span>
              <div className="text-3xl font-black text-theme-text mt-1 flex items-center gap-2">
                <Users className="w-6 h-6 text-indigo-500" aria-hidden="true" />
                <span>{students.length} Candidates</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-theme-surface border-2 border-theme-border shadow-sm">
              <span className="text-xs uppercase font-bold text-theme-text/60 block">
                Total Tests Completed
              </span>
              <div className="text-3xl font-black text-theme-text mt-1 flex items-center gap-2">
                <FileText className="w-6 h-6 text-emerald-500" aria-hidden="true" />
                <span>{totalSubmissions} Submissions</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-theme-surface border-2 border-theme-border shadow-sm">
              <span className="text-xs uppercase font-bold text-theme-text/60 block">
                Average Accuracy
              </span>
              <div className="text-3xl font-black text-theme-primary mt-1 flex items-center gap-2">
                <TrendingUp className="w-6 h-6" aria-hidden="true" />
                <span>{avgScore}%</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-theme-surface border-2 border-theme-border shadow-sm">
              <span className="text-xs uppercase font-bold text-theme-text/60 block">
                Top Candidate
              </span>
              <div className="text-xl font-bold text-theme-text mt-2 flex items-center gap-2 truncate">
                <Award className="w-6 h-6 text-amber-500 shrink-0" aria-hidden="true" />
                <span className="truncate">{students[0]?.name || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Submissions Filter & Table */}
          <div className="p-6 rounded-2xl bg-theme-surface border-2 border-theme-border shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div>
                <h2 id="submissions-heading" className="text-xl font-bold text-theme-text">
                  Student Examination Activity Log
                </h2>
                <p className="text-xs text-theme-text/70 mt-0.5">
                  Detailed record of students, tests taken, scores, and completion timestamps.
                </p>
              </div>

              {/* Search and Exam Filter */}
              <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                <select
                  value={selectedExamFilter}
                  onChange={(e) => setSelectedExamFilter(e.target.value)}
                  className="w-full sm:w-48 px-3 py-2 rounded-xl bg-theme-bg border-2 border-theme-border text-theme-text text-xs focus:ring-4 focus:ring-theme-focus outline-none"
                  aria-label="Filter by test"
                >
                  <option value="All">All Tests & Drills</option>
                  {[...new Set(submissions.map((s) => s.examCode))].map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>

                <div className="w-full sm:w-64">
                  <input
                    type="search"
                    value={submissionSearch}
                    onChange={(e) => setSubmissionSearch(e.target.value)}
                    placeholder="Search candidate name or roll..."
                    className="w-full px-3.5 py-2 rounded-xl bg-theme-bg border-2 border-theme-border text-theme-text text-xs focus:ring-4 focus:ring-theme-focus outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-theme-border text-xs uppercase font-bold text-theme-text/70">
                    <th scope="col" className="p-3">Student Name & Roll</th>
                    <th scope="col" className="p-3">Examination / Drill</th>
                    <th scope="col" className="p-3">Date & Time</th>
                    <th scope="col" className="p-3">Score Achieved</th>
                    <th scope="col" className="p-3">Accuracy</th>
                    <th scope="col" className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border">
                  {filteredSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-theme-text/60">
                        No examination submissions match the current query.
                      </td>
                    </tr>
                  ) : (
                    filteredSubmissions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-theme-bg/60 transition-colors">
                        <td className="p-3 font-semibold text-theme-text">
                          <div className="font-bold">{sub.studentName}</div>
                          <span className="text-xs font-mono text-theme-primary">{sub.studentRoll}</span>
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-theme-text max-w-xs truncate" title={sub.examTitle}>
                            {sub.examTitle}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-theme-text/60 mt-0.5">
                            <span className="font-mono">{sub.examCode}</span>
                            <span>•</span>
                            <span className={sub.examType === 'practice' ? 'text-emerald-500 font-bold' : 'text-blue-500'}>
                              {sub.examType === 'practice' ? 'Practice Drill' : 'Timed Exam'}
                            </span>
                          </div>
                        </td>
                        <td className="p-3 text-xs text-theme-text/80 whitespace-nowrap">
                          {new Date(sub.submittedAt).toLocaleDateString()}{' '}
                          <span className="text-theme-text/50">
                            {new Date(sub.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-theme-text whitespace-nowrap">
                          {sub.score} / {sub.maxScore} pts
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                              sub.percentage >= 80
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                : sub.percentage >= 60
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                            }`}
                          >
                            {sub.percentage}%
                          </span>
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleSpeakResult(sub)}
                              title="Listen to student performance summary via speech"
                              aria-label={`Read result for ${sub.studentName}`}
                              className="p-1.5 rounded-lg border border-theme-border bg-theme-bg hover:border-theme-primary text-theme-text transition"
                            >
                              <Volume2 className="w-4 h-4 text-theme-primary" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteSubmission(sub.id)}
                              title="Delete submission record"
                              aria-label={`Delete submission for ${sub.studentName}`}
                              className="p-1.5 rounded-lg border border-theme-border bg-theme-bg hover:border-red-500 text-theme-text/60 hover:text-red-500 transition"
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Registered Students Directory */}
          <div className="p-6 rounded-2xl bg-theme-surface border-2 border-theme-border shadow-sm space-y-4">
            <h2 className="text-xl font-bold text-theme-text">Registered Candidates Directory</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {students.map((std) => {
                const stdSubs = submissions.filter((s) => s.studentId === std.id);
                return (
                  <div key={std.id} className="p-4 rounded-xl border-2 border-theme-border bg-theme-bg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-theme-primary">{std.rollNumber}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-theme-border text-theme-text font-medium">
                        {std.accessibilityPreference}
                      </span>
                    </div>
                    <div className="font-bold text-theme-text text-base">{std.name}</div>
                    <div className="text-xs text-theme-text/60">{std.email}</div>
                    <div className="pt-2 border-t border-theme-border text-xs flex justify-between font-medium">
                      <span>Exams Attempted:</span>
                      <strong className="text-theme-text">{stdSubs.length}</strong>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* TAB 2: MANAGE TESTS & DRILLS */}
      {activeAdminTab === 'manage' && (
        <section aria-label="Existing Examinations and Practice Modules" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-theme-text">Available Test Series & Practice Modules</h2>
            <button
              type="button"
              onClick={() => setActiveAdminTab('create')}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center gap-1.5 shadow"
            >
              <PlusCircle className="w-4 h-4" aria-hidden="true" />
              <span>Create Another Test</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Mock Exams List */}
            {availableExams.map((exam) => (
              <div
                key={exam.id}
                className="p-6 rounded-2xl bg-theme-surface border-2 border-theme-border shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-theme-border text-theme-text">
                      {exam.code}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-500 border border-blue-500/30">
                      🏆 Timed Exam
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-theme-text mb-1">{exam.title}</h3>
                  <p className="text-xs text-theme-text/70 mb-4 line-clamp-2">{exam.description}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-theme-text/80 mb-4 font-medium">
                    <span>⏱️ {exam.durationMinutes} min</span>
                    <span>•</span>
                    <span>❓ {exam.questions.length} questions</span>
                    <span>•</span>
                    <span>🏆 {exam.totalMarks} marks</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-theme-border">
                  <button
                    type="button"
                    onClick={() => handleTestAsStudent(exam, 'exam')}
                    className="px-3.5 py-1.5 rounded-lg bg-theme-primary text-white text-xs font-bold flex items-center gap-1.5 hover:brightness-110 transition"
                  >
                    <Play className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Test as Student</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteCustomExam(exam.id)}
                    className="p-1.5 rounded-lg border border-theme-border hover:border-red-500 text-theme-text/60 hover:text-red-500 text-xs transition"
                    title="Delete Exam"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}

            {/* Practice Drills List */}
            {availablePracticeDrills.map((drill) => (
              <div
                key={drill.id}
                className="p-6 rounded-2xl bg-theme-surface border-2 border-emerald-500/30 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-theme-border text-theme-text">
                      {drill.code}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      💡 Practice Drill
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-theme-text mb-1">{drill.title}</h3>
                  <p className="text-xs text-theme-text/70 mb-4 line-clamp-2">{drill.description}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-theme-text/80 mb-4 font-medium">
                    <span>⏱️ {drill.durationMinutes} min</span>
                    <span>•</span>
                    <span>❓ {drill.questions.length} questions</span>
                    <span>•</span>
                    <span>💡 Hints & Solutions</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-theme-border">
                  <button
                    type="button"
                    onClick={() => handleTestAsStudent(drill, 'practice')}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 hover:brightness-110 transition"
                  >
                    <Play className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Test as Student</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteCustomExam(drill.id)}
                    className="p-1.5 rounded-lg border border-theme-border hover:border-red-500 text-theme-text/60 hover:text-red-500 text-xs transition"
                    title="Delete Practice Drill"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TAB 3: CREATE NEW TEST / DRILL */}
      {activeAdminTab === 'create' && (
        <section aria-labelledby="create-heading" className="p-6 sm:p-8 rounded-3xl bg-theme-surface border-2 border-theme-border shadow-md">
          <div className="mb-6">
            <h2 id="create-heading" className="text-2xl font-black text-theme-text">
              Author New Examination or Practice Drill
            </h2>
            <p className="text-sm text-theme-text/80 mt-1">
              Construct high-accessibility test papers with LaTeX math equations, 4 options, hints, and explanations.
            </p>
          </div>

          <form onSubmit={handlePublishExam} className="space-y-6">
            {formError && (
              <div role="alert" className="p-4 rounded-xl bg-red-500/10 border-2 border-red-500 text-red-500 text-sm font-bold">
                ⚠️ {formError}
              </div>
            )}
            {formSuccess && (
              <div role="status" className="p-4 rounded-xl bg-emerald-500/10 border-2 border-emerald-500 text-emerald-600 dark:text-emerald-400 text-sm font-bold flex items-center gap-2">
                <CheckCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span>{formSuccess}</span>
              </div>
            )}

            {/* Test Type & Category Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-theme-text/70 mb-1.5">
                  Module Format <span className="text-red-500">*</span>
                </label>
                <select
                  value={examType}
                  onChange={(e) => setExamType(e.target.value as 'exam' | 'practice')}
                  className="w-full p-3 rounded-xl bg-theme-bg border-2 border-theme-border text-theme-text font-bold text-sm focus:ring-4 focus:ring-theme-focus outline-none"
                >
                  <option value="exam">🏆 Mock Examination (Timed with Negative Marking)</option>
                  <option value="practice">💡 Practice Drill (Untimed with Hints & Solutions)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-theme-text/70 mb-1.5">
                  Category / Stream <span className="text-red-500">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ExamCategory)}
                  className="w-full p-3 rounded-xl bg-theme-bg border-2 border-theme-border text-theme-text font-bold text-sm focus:ring-4 focus:ring-theme-focus outline-none"
                >
                  <option value="Staff Selection">Staff Selection Commission (SSC)</option>
                  <option value="Banking & Insurance">Banking & Insurance (IBPS/SBI)</option>
                  <option value="Civil Services">Civil Services (UPSC CSAT)</option>
                  <option value="Railways">Railways (RRB NTPC)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-theme-text/70 mb-1.5">
                  Difficulty Level
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as any)}
                  className="w-full p-3 rounded-xl bg-theme-bg border-2 border-theme-border text-theme-text font-bold text-sm focus:ring-4 focus:ring-theme-focus outline-none"
                >
                  <option value="Easy">Easy</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Challenging">Challenging</option>
                </select>
              </div>
            </div>

            {/* Title & Code */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="sm:col-span-3">
                <label className="block text-xs font-bold uppercase text-theme-text/70 mb-1.5">
                  Test Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. IBPS Clerk 2026 Quantitative Speed Test"
                  required
                  className="w-full p-3 rounded-xl bg-theme-bg border-2 border-theme-border text-theme-text text-sm font-semibold focus:ring-4 focus:ring-theme-focus outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-theme-text/70 mb-1.5">
                  Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. IBPS-CLK-05"
                  required
                  className="w-full p-3 rounded-xl bg-theme-bg border-2 border-theme-border text-theme-text text-sm font-mono font-bold focus:ring-4 focus:ring-theme-focus outline-none"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold uppercase text-theme-text/70 mb-1.5">
                Overview & Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Brief summary of syllabus, target exam, and learning objectives..."
                required
                className="w-full p-3 rounded-xl bg-theme-bg border-2 border-theme-border text-theme-text text-sm focus:ring-4 focus:ring-theme-focus outline-none"
              />
            </div>

            {/* Duration & Marks */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-theme-text/70 mb-1.5">
                  Duration (Minutes)
                </label>
                <input
                  type="number"
                  min={5}
                  max={180}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full p-3 rounded-xl bg-theme-bg border-2 border-theme-border text-theme-text font-bold text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-theme-text/70 mb-1.5">
                  Total Marks
                </label>
                <input
                  type="number"
                  min={5}
                  max={300}
                  value={totalMarks}
                  onChange={(e) => setTotalMarks(Number(e.target.value))}
                  className="w-full p-3 rounded-xl bg-theme-bg border-2 border-theme-border text-theme-text font-bold text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-theme-text/70 mb-1.5">
                  Negative Marking
                </label>
                <input
                  type="text"
                  value={negativeMarking}
                  onChange={(e) => setNegativeMarking(e.target.value)}
                  placeholder="-0.25 marks"
                  disabled={examType === 'practice'}
                  className="w-full p-3 rounded-xl bg-theme-bg border-2 border-theme-border text-theme-text text-sm font-semibold disabled:opacity-50"
                />
              </div>
            </div>

            {/* QUESTIONS BUILDER SECTION */}
            <div className="pt-6 border-t-2 border-theme-border space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-theme-text">Questions List ({questions.length})</h3>
                  <p className="text-xs text-theme-text/60">
                    Add questions, options, KaTeX math formulas, hints, and step-by-step solutions.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAddQuestion}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center gap-1.5 shadow"
                >
                  <PlusCircle className="w-4 h-4" aria-hidden="true" />
                  <span>Add Another Question</span>
                </button>
              </div>

              {/* Individual Question Cards */}
              {questions.map((q, qIdx) => (
                <div key={q.id} className="p-6 rounded-2xl bg-theme-bg border-2 border-theme-border space-y-4">
                  <div className="flex items-center justify-between border-b border-theme-border pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center font-mono">
                        Q{q.questionNumber}
                      </span>
                      <span className="text-sm font-bold text-theme-text">Question {q.questionNumber}</span>
                    </div>

                    {questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveQuestion(qIdx)}
                        className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                        <span>Remove Question</span>
                      </button>
                    )}
                  </div>

                  {/* Section name & Question Text */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-theme-text/70 mb-1">Section</label>
                      <input
                        type="text"
                        value={q.section}
                        onChange={(e) => handleUpdateQuestion(qIdx, 'section', e.target.value)}
                        placeholder="e.g. Quantitative Aptitude"
                        className="w-full p-2.5 rounded-lg bg-theme-surface border border-theme-border text-xs text-theme-text font-semibold"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-bold text-theme-text/70 mb-1">
                        Question Text <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={q.questionText}
                        onChange={(e) => handleUpdateQuestion(qIdx, 'questionText', e.target.value)}
                        rows={2}
                        placeholder="Enter the full question statement..."
                        required
                        className="w-full p-2.5 rounded-lg bg-theme-surface border border-theme-border text-xs text-theme-text font-medium"
                      />
                    </div>
                  </div>

                  {/* Math Formula Input + Live Preview */}
                  <div className="p-3.5 rounded-xl border border-indigo-500/30 bg-indigo-500/5 space-y-2">
                    <label className="block text-xs font-bold text-indigo-500">
                      Optional Mathematical Equation (LaTeX)
                    </label>
                    <input
                      type="text"
                      value={q.mathLatex || ''}
                      onChange={(e) => handleUpdateQuestion(qIdx, 'mathLatex', e.target.value)}
                      placeholder="e.g. v = 72 \times \frac{5}{18} = 20 \text{ m/s}"
                      className="w-full p-2 rounded-lg bg-theme-surface border border-theme-border font-mono text-xs text-theme-text"
                    />

                    {q.mathLatex && (
                      <div className="pt-2 text-xs flex flex-wrap items-center gap-3">
                        <span className="text-theme-text/60">Live Rendered Math:</span>
                        <MathEquation latex={q.mathLatex} className="font-mono text-base" />
                        <span className="text-theme-text/40">•</span>
                        <span className="text-xs text-emerald-600 dark:text-emerald-400">
                          🔊 Voice will speak: "{verbalizeMath(q.mathLatex)}"
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 4 Options Grid */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase text-theme-text/70">
                      Options (Select the radio button for the correct answer) <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {q.options.map((opt) => (
                        <div
                          key={opt.number}
                          className={`p-3 rounded-xl border-2 flex items-center gap-3 transition-colors ${
                            q.correctOption === opt.number
                              ? 'border-emerald-500 bg-emerald-500/10'
                              : 'border-theme-border bg-theme-surface'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`correct_q_${qIdx}`}
                            checked={q.correctOption === opt.number}
                            onChange={() => handleUpdateQuestion(qIdx, 'correctOption', opt.number)}
                            className="w-4 h-4 accent-emerald-600 cursor-pointer"
                            aria-label={`Mark Option ${opt.number} as correct`}
                          />
                          <span className="text-xs font-bold font-mono">Opt {opt.number}:</span>
                          <input
                            type="text"
                            value={opt.text}
                            onChange={(e) => handleUpdateOption(qIdx, opt.number, e.target.value)}
                            placeholder={`Option ${opt.number} text...`}
                            required
                            className="flex-1 p-1.5 rounded bg-transparent border-b border-theme-border text-xs text-theme-text outline-none focus:border-theme-primary font-medium"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Hint & Explanation */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-xs font-bold text-amber-600 dark:text-amber-400 mb-1">
                        💡 Helpful Hint (For students in Practice Mode)
                      </label>
                      <input
                        type="text"
                        value={q.hint}
                        onChange={(e) => handleUpdateQuestion(qIdx, 'hint', e.target.value)}
                        placeholder="Clue or formula to help solve the question..."
                        className="w-full p-2.5 rounded-lg bg-theme-surface border border-theme-border text-xs text-theme-text"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                        🔍 Step-by-Step Explanation
                      </label>
                      <textarea
                        value={q.explanation}
                        onChange={(e) => handleUpdateQuestion(qIdx, 'explanation', e.target.value)}
                        rows={1}
                        placeholder="Step-by-step mathematical or logical solution..."
                        className="w-full p-2.5 rounded-lg bg-theme-surface border border-theme-border text-xs text-theme-text"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Publish Button */}
            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-base shadow-lg transition flex items-center justify-center gap-2 focus:ring-4 focus:ring-indigo-500/50"
              >
                <span>💾</span>
                <span>Publish Test to Student Catalog</span>
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
};
