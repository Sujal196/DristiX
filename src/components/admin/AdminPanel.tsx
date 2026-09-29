import React, { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useExamStore } from '../../store/useExamStore';
import { useAnnouncerStore } from '../../store/useAnnouncerStore';
import { soundEffects } from '../../utils/soundEffects';
import { getDataSource } from '../../services/dataSource';
import { verbalizeMath } from '../../utils/mathVerbalizer';
import { renderGeometrySvg, verbalizeGeometryDiagram } from '../../utils/geometryGenerator';
import { extractQuestionsFromFile } from '../../utils/docxImport';
import { MathEquation } from '../common/MathEquation';
import { AdminGraphBuilder } from './AdminGraphBuilder';
import { InteractiveSonificationGraph } from '../sonification/InteractiveSonificationGraph';
import type { Exam, QuestionItem } from '../../../shared/types';
import type { ExamCategory } from '../../data/examCategories';
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
  Sparkles,
  Image,
  Loader2,
  Edit3,
  Eye,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

/**
 * The sample item the creator form opens with. The first Word import replaces
 * it wholesale so an examiner never has to delete it by hand.
 */
const STARTER_QUESTION_TEXT = 'What is the sum of angles in a triangle?';

interface AdminPanelProps {
  onReturnToStudent: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onReturnToStudent }) => {
  const {
    students,
    submissions,
    logoutAdmin,
    deleteSubmission,
    syncSubmissions,
    fetchStudents,
    deleteStudent,
  } = useAuthStore();

  const {
    availableExams,
    availablePracticeDrills,
    addNewExam,
    updateExistingExam,
    loadExamForEdit,
    deleteCustomExam,
    selectExam,
  } = useExamStore();
  const { announce } = useAnnouncerStore();

  const [activeAdminTab, setActiveAdminTab] = useState<'analytics' | 'students' | 'manage' | 'create'>('analytics');

  // Refresh the cohort's results & student roster from the server on mount / tab change
  useEffect(() => {
    void syncSubmissions();
    void fetchStudents();
  }, [syncSubmissions, fetchStudents, activeAdminTab]);

  const [submissionSearch, setSubmissionSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedExamFilter, setSelectedExamFilter] = useState('All');
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(null);

  // Exam Creator / Editor Form State
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [isLoadingExamForEdit, setIsLoadingExamForEdit] = useState<boolean>(false);
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
      questionText: STARTER_QUESTION_TEXT,
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
  const [generatingDiagramAi, setGeneratingDiagramAi] = useState<Record<number, boolean>>({});
  const [previewingQuestionIdx, setPreviewingQuestionIdx] = useState<number | null>(null);
  /** Hidden Word picker, opened by the "Import from Word" button. */
  const wordFileRef = useRef<HTMLInputElement | null>(null);

  const convertImageUrlToBase64 = async (url: string): Promise<string> => {
    if (!url || !url.trim() || url.startsWith('data:')) return url;
    try {
      const response = await fetch(url);
      if (response.ok) {
        const blob = await response.blob();
        return await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string) || url);
          reader.onerror = () => resolve(url);
          reader.readAsDataURL(blob);
        });
      }
    } catch (err) {
      console.warn('[dristix] client image conversion failed, passing original URL:', err);
    }
    return url;
  };

  const handleGenerateAiDiagramExplanation = async (qIdx: number) => {
    const q = questions[qIdx];
    if (!q.questionText.trim()) {
      setFormError(`Please enter Question ${qIdx + 1} text before generating AI Diagram explanation.`);
      return;
    }
    setFormError('');
    setGeneratingDiagramAi((prev) => ({ ...prev, [qIdx]: true }));

    try {
      let payloadUrl = q.diagramUrl;
      if (payloadUrl && (payloadUrl.startsWith('http://') || payloadUrl.startsWith('https://'))) {
        payloadUrl = await convertImageUrlToBase64(payloadUrl);
      }

      const data = await getDataSource().ai.explainDiagram({
        questionText: q.questionText,
        mathLatex: q.mathLatex,
        diagramUrl: payloadUrl,
        diagramType: q.diagramType || 'geometry',
        diagramDescription: q.diagramDescription,
      });

      handleUpdateQuestion(qIdx, 'diagramAiExplanation', data);
      soundEffects.playSuccess();
      announce(`AI Diagram Explanation generated successfully for Question ${q.questionNumber}.`, 'assertive', true);
    } catch (err: any) {
      console.error('[dristix] explainDiagram error', err);
      // Check if session expired / unauthorized
      if (err.status === 401 || err.code === 'unauthorized') {
        setFormError('Your admin session has expired. Please log in again to generate AI explanations.');
        useAuthStore.getState().logoutAdmin();
        return;
      }

      // Fail loudly. This used to write a canned non-AI paragraph into the
      // question and play the success chime, so a broken provider looked like
      // it had worked — the admin only noticed the useless text later.
      const detail = typeof err?.message === 'string' ? err.message : '';
      setFormError(
        `AI Vision could not analyze the image for Question ${q.questionNumber}.` +
          `${detail ? ` (${detail})` : ''} ` +
          'Check that the image link opens in a browser, or pick the image file directly, then try again.'
      );
    } finally {
      setGeneratingDiagramAi((prev) => ({ ...prev, [qIdx]: false }));
    }
  };

  const handleApplyGeometryPreset = (qIdx: number, type: 'triangle_60_30' | 'triangle_right' | 'circle' | 'motion') => {
    let spec: any;
    if (type === 'triangle_60_30') {
      spec = {
        type: 'triangle',
        vertexTop: 'C',
        vertexLeft: 'A',
        vertexRight: 'B',
        baseLabel: '5.8 cm',
        angleLeftLabel: '60°',
        angleRightLabel: '30°',
      };
    } else if (type === 'triangle_right') {
      spec = {
        type: 'triangle',
        vertexTop: 'C',
        vertexLeft: 'A',
        vertexRight: 'B',
        baseLabel: '8 cm',
        sideLeftLabel: '6 cm',
        angleLeftLabel: '90°',
        isRightAngle: true,
      };
    } else if (type === 'circle') {
      spec = {
        type: 'circle',
        centerLabel: 'O',
        radiusLabel: 'r = 7 cm',
        chordLabel: 'AB = 10 cm',
      };
    } else {
      spec = {
        type: 'motion',
        object1Label: 'Train (L metres)',
        object2Label: 'Platform (250 m)',
        speedLabel: 'v = 72 km/h (20 m/s)',
        timeLabel: 't = 26s',
      };
    }

    const svgUrl = renderGeometrySvg(spec);
    const { description, aiExplanation } = verbalizeGeometryDiagram(spec);

    const updated = [...questions];
    updated[qIdx] = {
      ...updated[qIdx],
      diagramType: 'geometry',
      diagramUrl: svgUrl,
      diagramDescription: description,
      diagramAiExplanation: aiExplanation,
    };
    setQuestions(updated);
    soundEffects.playSuccess();
    announce(`Applied ${type} geometry diagram preset to Question ${qIdx + 1}.`, 'assertive', true);
  };

  /**
   * Re-encodes a picked image at a bounded size.
   *
   * Uploaded pictures travel to the server as base64 data URLs; an unbounded
   * phone photo is several megabytes, which used to blow past the body limit
   * and quietly replace the real AI analysis with a canned fallback. Scaling
   * to 1280px and re-encoding keeps the payload small and the stored exam
   * document light. Anything that cannot be decoded as a raster image (an
   * SVG, say) is passed through untouched.
   */
  const readAndCompressImage = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read the selected file.'));
      reader.onload = () => {
        const src = reader.result as string;
        // `window.Image`, not bare `Image`: the lucide `Image` icon imported at
        // the top of this file shadows the DOM constructor.
        const img = new window.Image();
        img.onerror = () => resolve(src);
        img.onload = () => {
          const MAX_EDGE = 1280;
          const longest = Math.max(img.width, img.height);
          const scale = Math.min(1, MAX_EDGE / longest);
          if (scale === 1 && file.size < 400_000) {
            resolve(src);
            return;
          }
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(src);
            return;
          }
          // JPEG has no alpha; matting onto white keeps a transparent diagram's
          // background white instead of the black a naive export would give.
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          try {
            resolve(canvas.toDataURL('image/jpeg', 0.85));
          } catch {
            resolve(src);
          }
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
    });

  const handleImageFileUpload = async (qIdx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so picking the same file twice still fires a change event.
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFormError('Only image files can be attached to a question.');
      return;
    }

    try {
      const result = await readAndCompressImage(file);
      const updated = [...questions];
      updated[qIdx] = {
        ...updated[qIdx],
        diagramUrl: result,
        diagramType: 'image',
      };
      setQuestions(updated);
      setFormError('');
      soundEffects.playSuccess();
      announce(`Uploaded diagram image file for Question ${qIdx + 1}.`, 'polite', true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not read that image file.');
    }
  };

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

  // Submissions Pagination (5 per page)
  const SUBMISSIONS_PER_PAGE = 5;
  const [submissionPage, setSubmissionPage] = useState(1);

  useEffect(() => {
    setSubmissionPage(1);
  }, [submissionSearch, selectedExamFilter]);

  const totalSubmissionPages = Math.max(1, Math.ceil(filteredSubmissions.length / SUBMISSIONS_PER_PAGE));
  const paginatedAdminSubmissions = filteredSubmissions.slice(
    (submissionPage - 1) * SUBMISSIONS_PER_PAGE,
    submissionPage * SUBMISSIONS_PER_PAGE
  );

  // Filtered Registered Students
  const filteredStudents = students.filter((std) => {
    if (!studentSearch.trim()) return true;
    const q = studentSearch.toLowerCase();
    return (
      std.name.toLowerCase().includes(q) ||
      std.rollNumber.toLowerCase().includes(q) ||
      std.email.toLowerCase().includes(q)
    );
  });

  const handleDeleteStudent = async (studentId: string, studentName: string) => {
    if (
      window.confirm(
        `Are you sure you want to remove student "${studentName}"? All their test attempts will also be permanently deleted.`
      )
    ) {
      setDeletingStudentId(studentId);
      await deleteStudent(studentId);
      setDeletingStudentId(null);
    }
  };

  const handleStartEditExam = async (examId: string) => {
    setFormError('');
    setFormSuccess('');
    setIsLoadingExamForEdit(true);

    try {
      const fullExam = await loadExamForEdit(examId);
      if (!fullExam) {
        setFormError('Could not load examination details for editing.');
        return;
      }

      setEditingExamId(fullExam.id);
      setTitle(fullExam.title);
      setCode(fullExam.code);
      setDescription(fullExam.description || '');
      setCategory((fullExam.category as ExamCategory) || 'Staff Selection');
      setDurationMinutes(fullExam.durationMinutes);
      setTotalMarks(fullExam.totalMarks);
      const isPractice = fullExam.negativeMarking.startsWith('No negative');
      setExamType(isPractice ? 'practice' : 'exam');
      setNegativeMarking(fullExam.negativeMarking);
      setDifficulty(fullExam.difficulty || 'Moderate');

      if (fullExam.questions && fullExam.questions.length > 0) {
        setQuestions(fullExam.questions);
      }

      setActiveAdminTab('create');
      soundEffects.playSelect();
      announce(`Loaded examination ${fullExam.code} for editing.`, 'assertive', true);
    } catch {
      setFormError('Failed to load examination for editing.');
    } finally {
      setIsLoadingExamForEdit(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingExamId(null);
    setTitle('');
    setCode('');
    setDescription('');
    setActiveAdminTab('manage');
  };

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

  /**
   * Bulk-authoring: read a Word (.docx) paper and drop every recognised
   * question into the form — statement, options, correct answer, section,
   * solution and hint — so an examiner reviews instead of retyping.
   */
  const handleImportWordFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so re-picking the same file still fires a change event.
    e.target.value = '';
    if (!file) return;

    setFormError('');
    setFormSuccess('');

    try {
      const result = await extractQuestionsFromFile(file);

      if (result.questions.length === 0) {
        setFormError(
          `No questions were recognised in "${file.name}". Each question needs a number such as ` +
            '"1." or "Q1.", options such as "a)" or "(a)", and ideally an answer line like "Ans: b".'
        );
        return;
      }

      const stamp = Date.now();
      const imported: QuestionItem[] = result.questions.map((q, i) => {
        const optionTexts = q.options.length > 0 ? q.options : ['', '', '', ''];
        return {
          id: `imported-q-${stamp}-${i}`,
          section: q.section || 'General',
          questionNumber: 0, // assigned by the merge below
          questionText: q.questionText,
          questionType: 'MCQ' as const,
          options: optionTexts.map((text, oi) => ({
            id: `opt_${stamp}_${i}_${oi + 1}`,
            number: oi + 1,
            text,
          })),
          // 0 means "the file carried no answer": the radio stays unselected
          // so the gap is visible, and publishing refuses to proceed.
          correctOption:
            q.correctOption >= 1 && q.correctOption <= optionTexts.length ? q.correctOption : 0,
          explanation: q.explanation,
          hint: q.hint,
        };
      });

      const replaceStarter =
        !editingExamId && questions.length === 1 && questions[0].questionText === STARTER_QUESTION_TEXT;
      const base = replaceStarter ? [] : questions;
      const merged = [...base, ...imported].map((q, idx) => ({ ...q, questionNumber: idx + 1 }));
      setQuestions(merged);

      const missingAnswers = imported.filter((q) => !q.correctOption).length;
      const shortOptions = imported.filter((q) => q.options.length < 4).length;

      setFormSuccess(
        `Imported ${imported.length} question${imported.length === 1 ? '' : 's'} from "${file.name}"` +
          `${replaceStarter ? ' (starter question replaced)' : ''} — ${merged.length} in this paper now.` +
          (missingAnswers
            ? ` ${missingAnswers} had no answer in the file: mark the correct option for those before publishing.`
            : '') +
          (shortOptions ? ` ${shortOptions} have fewer than 4 options.` : '')
      );
      announce(`Imported ${imported.length} questions from ${file.name}.`, 'assertive', true);
      soundEffects.playSuccess();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : `Could not read "${file.name}".`);
    }
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

  const handlePublishExam = async (e: React.FormEvent) => {
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
      // An imported question whose answer was missing from the file leaves the
      // radio unselected; grading would otherwise mark every student wrong.
      if (!q.correctOption || !q.options.some((o) => o.number === q.correctOption)) {
        setFormError(`Question ${i + 1} has no correct option selected. Mark the right answer.`);
        return;
      }
    }

    const examPayload: Exam = {
      id: editingExamId || `exam-${Date.now()}`,
      code: code.trim().toUpperCase(),
      title: title.trim(),
      description: description.trim(),
      category: category === 'All' ? 'Staff Selection' : category,
      durationMinutes: Number(durationMinutes),
      totalMarks: Number(totalMarks),
      negativeMarking: examType === 'practice' ? 'No negative marking (Practice)' : negativeMarking,
      difficulty,
      sections: Array.from(new Set(questions.map((q) => q.section))),
      questionCount: questions.length,
      questions,
    };

    let result: { ok: boolean; message?: string };
    if (editingExamId) {
      result = await updateExistingExam(editingExamId, examPayload, examType);
    } else {
      result = await addNewExam(examPayload, examType);
    }

    if (!result.ok) {
      setFormError(
        result.message ?? 'Could not save the examination. Please try again.'
      );
      return;
    }

    setFormSuccess(
      editingExamId
        ? `"${examPayload.title}" was updated successfully!`
        : `"${examPayload.title}" was published successfully! Students can now take it.`
    );
    soundEffects.playSuccess();

    // Reset creator form and exit edit mode
    setEditingExamId(null);
    setTitle('');
    setCode('');
    setDescription('');
    setActiveAdminTab('manage');
  };

  const handleTestAsStudent = (exam: Exam, type: 'exam' | 'practice') => {
    void selectExam(exam.id, type);
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
          className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition focus:ring-4 focus:ring-theme-focus ${
            activeAdminTab === 'analytics'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-theme-text hover:bg-theme-border/30'
          }`}
        >
          <Award className="w-5 h-5" aria-hidden="true" />
          <span>Submissions & Results ({totalSubmissions})</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeAdminTab === 'students'}
          onClick={() => {
            setActiveAdminTab('students');
            soundEffects.playSelect();
          }}
          className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition focus:ring-4 focus:ring-theme-focus ${
            activeAdminTab === 'students'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-theme-text hover:bg-theme-border/30'
          }`}
        >
          <Users className="w-5 h-5" aria-hidden="true" />
          <span>Registered Students ({students.length})</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeAdminTab === 'manage'}
          onClick={() => {
            setActiveAdminTab('manage');
            soundEffects.playSelect();
          }}
          className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition focus:ring-4 focus:ring-theme-focus ${
            activeAdminTab === 'manage'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-theme-text hover:bg-theme-border/30'
          }`}
        >
          <FileText className="w-5 h-5" aria-hidden="true" />
          <span>Manage Tests ({availableExams.length + availablePracticeDrills.length})</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeAdminTab === 'create'}
          onClick={() => {
            setActiveAdminTab('create');
            soundEffects.playSelect();
          }}
          className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition focus:ring-4 focus:ring-theme-focus ${
            activeAdminTab === 'create'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-theme-text hover:bg-theme-border/30'
          }`}
        >
          {editingExamId ? (
            <Edit3 className="w-5 h-5" aria-hidden="true" />
          ) : (
            <PlusCircle className="w-5 h-5" aria-hidden="true" />
          )}
          <span>{editingExamId ? 'Edit Test' : 'Create New Test'}</span>
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

          {/* Data Sonification Feature Section Card */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-900/20 via-purple-900/10 to-indigo-900/20 border-2 border-indigo-500/40 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl p-2.5 rounded-xl bg-indigo-600 text-white shadow">
                  🎧
                </span>
                <div>
                  <h3 className="text-lg font-black text-theme-text flex items-center gap-2">
                    <span>Data Sonification Questions</span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      Live Production Feature
                    </span>
                  </h3>
                  <p className="text-xs text-theme-text/70 mt-0.5">
                    Real-time Web Audio pitch modulation (250Hz - 900Hz), Stereo spatial audio, trend detection, and tactile haptic feedback for visually impaired candidates.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveAdminTab('create');
                    soundEffects.playSelect();
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-extrabold text-xs flex items-center gap-1.5 shadow hover:bg-indigo-700 transition"
                >
                  <PlusCircle className="w-4 h-4" aria-hidden="true" />
                  <span>Create DI Question</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveAdminTab('manage');
                    soundEffects.playSelect();
                  }}
                  className="px-4 py-2 rounded-xl border border-theme-border bg-theme-surface hover:bg-theme-border/40 font-bold text-xs transition"
                >
                  Manage Questions
                </button>
              </div>
            </div>

            {/* Quick Metrics */}
            {(() => {
              const allQs = [...availableExams, ...availablePracticeDrills].flatMap((e) => e.questions || []);
              const sonifiedQs = allQs.filter((q) => q.graph && q.graph.enabled && q.graph.sonification?.enabled);
              const barCount = sonifiedQs.filter((q) => q.graph?.type === 'bar').length;
              const lineCount = sonifiedQs.filter((q) => q.graph?.type === 'line').length;
              const pieCount = sonifiedQs.filter((q) => q.graph?.type === 'pie').length;

              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-indigo-500/20 text-xs">
                  <div className="p-2.5 rounded-xl bg-theme-surface/60 border border-theme-border">
                    <span className="text-theme-text/60 block text-[11px] font-bold uppercase">Sonified Questions</span>
                    <span className="text-lg font-black text-indigo-500">{sonifiedQs.length} active</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-theme-surface/60 border border-theme-border">
                    <span className="text-theme-text/60 block text-[11px] font-bold uppercase">Bar Charts</span>
                    <span className="text-lg font-black text-theme-text">{barCount}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-theme-surface/60 border border-theme-border">
                    <span className="text-theme-text/60 block text-[11px] font-bold uppercase">Line Charts</span>
                    <span className="text-lg font-black text-theme-text">{lineCount}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-theme-surface/60 border border-theme-border">
                    <span className="text-theme-text/60 block text-[11px] font-bold uppercase">Pie Charts</span>
                    <span className="text-lg font-black text-theme-text">{pieCount}</span>
                  </div>
                </div>
              );
            })()}
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
                  {paginatedAdminSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-theme-text/60">
                        No examination submissions match the current query.
                      </td>
                    </tr>
                  ) : (
                    paginatedAdminSubmissions.map((sub) => (
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
                          {Number(sub.score.toFixed(2))} / {sub.maxScore} pts
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

            {/* Admin Submissions Pagination */}
            {filteredSubmissions.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-theme-border">
                <div className="text-xs text-theme-text/70 font-medium">
                  Showing <span className="font-bold text-theme-text">{Math.min((submissionPage - 1) * SUBMISSIONS_PER_PAGE + 1, filteredSubmissions.length)}</span> to{' '}
                  <span className="font-bold text-theme-text">{Math.min(submissionPage * SUBMISSIONS_PER_PAGE, filteredSubmissions.length)}</span> of{' '}
                  <span className="font-bold text-theme-text">{filteredSubmissions.length}</span> submissions
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={submissionPage === 1}
                    onClick={() => setSubmissionPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-lg border-2 border-theme-border bg-theme-bg text-theme-text font-bold text-xs hover:border-theme-primary hover:text-theme-primary disabled:opacity-40 disabled:hover:border-theme-border disabled:hover:text-theme-text transition flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Previous</span>
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalSubmissionPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setSubmissionPage(page)}
                        className={`w-8 h-8 rounded-lg font-bold text-xs transition border-2 ${
                          submissionPage === page
                            ? 'bg-theme-primary text-white border-theme-primary shadow-xs'
                            : 'bg-theme-bg border-theme-border text-theme-text hover:border-theme-primary'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    disabled={submissionPage === totalSubmissionPages}
                    onClick={() => setSubmissionPage((p) => Math.min(totalSubmissionPages, p + 1))}
                    className="px-3 py-1.5 rounded-lg border-2 border-theme-border bg-theme-bg text-theme-text font-bold text-xs hover:border-theme-primary hover:text-theme-primary disabled:opacity-40 disabled:hover:border-theme-border disabled:hover:text-theme-text transition flex items-center gap-1"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* TAB 2: REGISTERED STUDENTS ROSTER */}
      {activeAdminTab === 'students' && (
        <section aria-labelledby="students-roster-heading" className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-theme-surface border-2 border-theme-border shadow-sm">
            <div>
              <h2 id="students-roster-heading" className="text-xl font-bold text-theme-text flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-500" aria-hidden="true" />
                Registered Students Directory ({students.length} Candidates)
              </h2>
              <p className="text-xs text-theme-text/60 mt-0.5">
                View all candidates registered on DristiX, monitor their roll numbers and accessibility options, or remove candidate accounts.
              </p>
            </div>

            <div className="w-full sm:w-80 relative">
              <Search className="w-4 h-4 text-theme-text/40 absolute left-3 top-3" aria-hidden="true" />
              <input
                type="text"
                placeholder="Search name, roll number, or email..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-3 rounded-xl border-2 border-theme-border bg-theme-bg text-sm text-theme-text focus:outline-none focus:ring-4 focus:ring-theme-focus-ring"
              />
            </div>
          </div>

          {filteredStudents.length === 0 ? (
            <div className="p-10 text-center rounded-2xl bg-theme-surface border-2 border-theme-border">
              <p className="text-base font-bold text-theme-text">No registered candidates match your search query.</p>
              <p className="text-xs text-theme-text/60 mt-1">Try clearing the search box to view all registered students.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border-2 border-theme-border bg-theme-surface shadow-sm">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-theme-border bg-theme-bg/60 text-xs font-black uppercase text-theme-text/70">
                    <th className="py-3.5 px-4">Student Name</th>
                    <th className="py-3.5 px-4">Roll Number / ID</th>
                    <th className="py-3.5 px-4">Email Address</th>
                    <th className="py-3.5 px-4">Accessibility Preference</th>
                    <th className="py-3.5 px-4 text-center">Tests Attempted</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border">
                  {filteredStudents.map((std) => {
                    const stdSubs = submissions.filter((s) => s.studentId === std.id || s.studentRoll === std.rollNumber);
                    const isDeleting = deletingStudentId === std.id;

                    return (
                      <tr key={std.id} className="hover:bg-theme-bg/40 transition">
                        <td className="py-3.5 px-4 font-bold text-theme-text">
                          <div className="flex items-center gap-2.5">
                            <span className="w-8 h-8 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                              {std.name.charAt(0).toUpperCase()}
                            </span>
                            <span className="truncate">{std.name}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                          {std.rollNumber}
                        </td>
                        <td className="py-3.5 px-4 text-theme-text/80">{std.email}</td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-theme-border/50 text-theme-text">
                            {std.accessibilityPreference || 'Standard'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-theme-text">
                          {stdSubs.length}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => handleDeleteStudent(std.id, std.name)}
                            className="px-3.5 py-1.5 rounded-lg border-2 border-red-500/40 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white font-bold text-xs flex items-center gap-1.5 transition ml-auto focus:ring-4 focus:ring-red-500/30 disabled:opacity-50"
                          >
                            {isDeleting ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            )}
                            <span>Remove Account</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
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
                  <div className="flex flex-wrap gap-3 text-xs text-theme-text/80 mb-4 font-medium items-center">
                    <span>⏱️ {exam.durationMinutes} min</span>
                    <span>•</span>
                    <span>❓ {exam.questions.length} questions</span>
                    <span>•</span>
                    <span>🏆 {exam.totalMarks} marks</span>
                    {exam.questions.some((q) => q.graph && q.graph.enabled) && (
                      <>
                        <span>•</span>
                        <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold">
                          🎧 Audio Graph DI
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-3 border-t border-theme-border flex-wrap">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleTestAsStudent(exam, 'exam')}
                      className="px-3 py-1.5 rounded-lg bg-theme-primary text-white text-xs font-bold flex items-center gap-1.5 hover:brightness-110 transition"
                    >
                      <Play className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Test as Student</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleStartEditExam(exam.id)}
                      className="px-3 py-1.5 rounded-lg border-2 border-indigo-500/40 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white text-xs font-bold flex items-center gap-1.5 transition"
                    >
                      <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Edit Test</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => void deleteCustomExam(exam.id)}
                    className="p-1.5 rounded-lg border border-theme-border hover:border-red-500 text-theme-text/60 hover:text-red-500 text-xs transition ml-auto"
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

                <div className="flex items-center justify-between gap-2 pt-3 border-t border-theme-border flex-wrap">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleTestAsStudent(drill, 'practice')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 hover:brightness-110 transition"
                    >
                      <Play className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Test as Student</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleStartEditExam(drill.id)}
                      className="px-3 py-1.5 rounded-lg border-2 border-indigo-500/40 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white text-xs font-bold flex items-center gap-1.5 transition"
                    >
                      <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Edit Drill</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => void deleteCustomExam(drill.id)}
                    className="p-1.5 rounded-lg border border-theme-border hover:border-red-500 text-theme-text/60 hover:text-red-500 text-xs transition ml-auto"
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

            {/* Editing has no other exit — without this an examiner who opened
                the wrong paper had to publish it to get out. */}
            {editingExamId && (
              <div className="flex flex-wrap items-center gap-3 mt-3">
                <span className="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs font-black uppercase tracking-wider">
                  {isLoadingExamForEdit ? 'Loading exam…' : 'Editing existing paper'}
                </span>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-3 py-1.5 rounded-lg border border-theme-border bg-theme-surface text-theme-text font-bold text-xs hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/40 transition"
                >
                  Cancel edit
                </button>
              </div>
            )}
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

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => wordFileRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 shadow"
                    title="Read questions out of a .docx file — statement, options, answer, solution and section land in their fields automatically"
                  >
                    <FileText className="w-4 h-4" aria-hidden="true" />
                    <span>Import from Word</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center gap-1.5 shadow"
                  >
                    <PlusCircle className="w-4 h-4" aria-hidden="true" />
                    <span>Add Another Question</span>
                  </button>

                  <input
                    ref={wordFileRef}
                    type="file"
                    accept=".docx,.txt,.md"
                    onChange={handleImportWordFile}
                    className="hidden"
                    aria-label="Choose a Word document to import questions from"
                  />
                </div>
              </div>

              {/* Individual Question Cards */}
              {questions.map((q, qIdx) => (
                <div key={q.id} className="p-6 rounded-2xl bg-theme-bg border-2 border-theme-border space-y-4">
                  <div className="flex flex-wrap items-center justify-between border-b border-theme-border pb-3 gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center font-mono">
                        Q{q.questionNumber}
                      </span>
                      <span className="text-sm font-bold text-theme-text">Question {q.questionNumber}</span>
                      {q.questionType === 'DI' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/40">
                          📊 DI Sonification
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Preview as Student button */}
                      <button
                        type="button"
                        onClick={() => setPreviewingQuestionIdx(qIdx)}
                        className="px-2.5 py-1 rounded-lg border border-indigo-500/40 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white font-bold text-xs flex items-center gap-1 transition"
                      >
                        <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Preview as Student</span>
                      </button>

                      {questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveQuestion(qIdx)}
                          className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Question Format & Type Selector */}
                  <div className="p-3 rounded-xl bg-theme-surface border border-theme-border flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-bold uppercase text-theme-text/70">
                        Question Format:
                      </label>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-theme-text">
                          <input
                            type="radio"
                            name={`q_type_${qIdx}`}
                            checked={q.questionType !== 'DI'}
                            onChange={() => {
                              handleUpdateQuestion(qIdx, 'questionType', 'MCQ');
                              if (q.graph) {
                                handleUpdateQuestion(qIdx, 'graph', {
                                  ...q.graph,
                                  enabled: false,
                                });
                              }
                            }}
                            className="accent-indigo-600"
                          />
                          <span>Standard MCQ</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-indigo-600 dark:text-indigo-400">
                          <input
                            type="radio"
                            name={`q_type_${qIdx}`}
                            checked={q.questionType === 'DI'}
                            onChange={() => {
                              handleUpdateQuestion(qIdx, 'questionType', 'DI');
                              const existingGraph = q.graph || {
                                enabled: true,
                                type: 'bar',
                                title: 'Data Interpretation Graph',
                                xAxisLabel: 'Category',
                                yAxisLabel: 'Value',
                                unit: '',
                                data: [
                                  { id: '1', label: 'Item A', value: 30 },
                                  { id: '2', label: 'Item B', value: 65 },
                                  { id: '3', label: 'Item C', value: 90 },
                                ],
                                sonification: {
                                  enabled: true,
                                  spatialAudio: true,
                                  trendDetection: true,
                                  peakDetection: true,
                                  haptic: true,
                                  voiceDetail: 'standard',
                                  minFrequency: 250,
                                  maxFrequency: 900,
                                },
                              };
                              handleUpdateQuestion(qIdx, 'graph', {
                                ...existingGraph,
                                enabled: true,
                              });
                            }}
                            className="accent-indigo-600"
                          />
                          <span>DI / Data Interpretation (Audio Sonification)</span>
                        </label>
                      </div>
                    </div>

                    {q.questionType === 'DI' && (
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-theme-text">
                        <span>Interactive Sonification:</span>
                        <input
                          type="checkbox"
                          checked={q.graph?.enabled ?? true}
                          onChange={(e) => {
                            if (q.graph) {
                              handleUpdateQuestion(qIdx, 'graph', {
                                ...q.graph,
                                enabled: e.target.checked,
                              });
                            }
                          }}
                          className="w-4 h-4 accent-indigo-600"
                        />
                        <span className={q.graph?.enabled ? 'text-emerald-500' : 'text-theme-text/60'}>
                          {q.graph?.enabled ? 'ENABLED' : 'DISABLED'}
                        </span>
                      </label>
                    )}
                  </div>

                  {/* If DI Question & Graph Enabled, Render Real AdminGraphBuilder */}
                  {q.questionType === 'DI' && q.graph && q.graph.enabled && (
                    <AdminGraphBuilder
                      graph={q.graph}
                      onChange={(updatedGraph) => handleUpdateQuestion(qIdx, 'graph', updatedGraph)}
                    />
                  )}

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

                  {/* AI Diagram & Visual Asset Authoring (Multimodal Vision AI) */}
                  <div className="p-4 rounded-xl border-2 border-purple-500/30 bg-purple-500/5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Image className="w-4 h-4 text-purple-500" aria-hidden="true" />
                        <label className="text-xs font-extrabold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                          🖼️ AI Multimodal Vision Diagram (Attach Any Image / Diagram)
                        </label>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleGenerateAiDiagramExplanation(qIdx)}
                        disabled={generatingDiagramAi[qIdx]}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:brightness-110 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md transition disabled:opacity-50"
                      >
                        {generatingDiagramAi[qIdx] ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                            <span>AI Vision Analyzing Image...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" aria-hidden="true" />
                            <span>✨ Analyze Image & Generate AI Explanation</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Image Source Inputs: URL vs Local File Upload */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-theme-text/70 mb-1">Diagram Type</label>
                        <select
                          value={q.diagramType || 'image'}
                          onChange={(e) => handleUpdateQuestion(qIdx, 'diagramType', e.target.value)}
                          className="w-full p-2.5 rounded-lg bg-theme-surface border border-theme-border text-xs text-theme-text font-bold outline-none"
                        >
                          <option value="image">🖼️ Image (URL / File)</option>
                          <option value="geometry">📐 Geometry / Vector Figure</option>
                          <option value="chart">📊 Chart / Data Graph</option>
                          <option value="svg">⚡ SVG Code / Data URL</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-theme-text/70 mb-1">
                          Image URL / Online Link
                        </label>
                        <input
                          type="text"
                          value={q.diagramUrl || ''}
                          onChange={(e) => handleUpdateQuestion(qIdx, 'diagramUrl', e.target.value)}
                          placeholder="Paste image link e.g. https://storage.googleapis.com/.../diagram.png"
                          className="w-full p-2.5 rounded-lg bg-theme-surface border border-theme-border text-xs font-mono text-theme-text outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-theme-text/70 mb-1">
                          Upload Image File
                        </label>
                        <label className="w-full p-2 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 font-bold text-xs border border-indigo-500/30 flex items-center justify-center gap-1.5 cursor-pointer transition">
                          <span>📁 Pick Image</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleImageFileUpload(qIdx, e)}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>

                    {/* Geometry presets — the handler existed but was never
                        rendered, so "Geometry / Vector Figure" produced
                        nothing an examiner could click. */}
                    {q.diagramType === 'geometry' && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold text-theme-text/70">Quick presets:</span>
                        {(
                          [
                            ['triangle_60_30', '📐 60°-30° Triangle'],
                            ['triangle_right', '📏 Right Triangle'],
                            ['circle', '⭕ Circle'],
                            ['motion', '🚄 Motion Diagram'],
                          ] as const
                        ).map(([preset, label]) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => handleApplyGeometryPreset(qIdx, preset)}
                            className="px-3 py-1.5 rounded-lg border border-indigo-500/40 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white font-bold text-[11px] transition"
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Live Image Preview if diagramUrl present */}
                    {q.diagramUrl && (
                      <div className="p-3 rounded-xl bg-theme-surface border border-theme-border flex flex-col sm:flex-row items-center gap-4">
                        <img
                          src={q.diagramUrl}
                          alt="Diagram Preview"
                          className="h-24 max-w-xs object-contain rounded-lg border border-theme-border shadow-sm bg-white"
                        />
                        <div className="text-xs text-theme-text/80 space-y-1">
                          <div className="font-bold text-purple-500">Live Attached Image Preview</div>
                          <div className="text-[11px] text-theme-text/60 line-clamp-2 font-mono">
                            Source: {q.diagramUrl.slice(0, 80)}...
                          </div>
                          <button
                            type="button"
                            onClick={() => handleUpdateQuestion(qIdx, 'diagramUrl', '')}
                            className="text-[11px] text-red-500 font-bold hover:underline"
                          >
                            Remove Image
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Diagram Caption / Description */}
                    <div>
                      <label className="block text-[11px] font-bold text-theme-text/70 mb-1">
                        Optional Diagram Caption (AI Vision auto-understands the image content, no caption required!)
                      </label>
                      <input
                        type="text"
                        value={q.diagramDescription || ''}
                        onChange={(e) => handleUpdateQuestion(qIdx, 'diagramDescription', e.target.value)}
                        placeholder="Optional manual notes (Leave blank to let AI Vision inspect the image automatically)"
                        className="w-full p-2 rounded-lg bg-theme-surface border border-theme-border text-xs text-theme-text outline-none"
                      />
                    </div>

                    {q.diagramAiExplanation && (
                      <div className="p-4 rounded-xl bg-theme-surface border-2 border-purple-500/30 text-xs space-y-2.5">
                        <div className="flex items-center gap-1.5 font-extrabold text-purple-600 dark:text-purple-400 text-sm">
                          <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" aria-hidden="true" />
                          <span>Generated Multimodal AI Diagram Breakdown:</span>
                        </div>
                        <p className="text-theme-text font-medium text-xs leading-relaxed">
                          {q.diagramAiExplanation.educationalContext}
                        </p>
                        <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                          🔊 TTS Audio Voice Narration: "{q.diagramAiExplanation.audioNarration}"
                        </div>
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

      {/* STUDENT PREVIEW MODAL */}
      {previewingQuestionIdx !== null && questions[previewingQuestionIdx] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="student-preview-modal-title"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-theme-surface border-2 border-theme-border rounded-3xl max-w-3xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-theme-border pb-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider bg-emerald-600 text-white">
                  Student-Side Experience Preview
                </span>
                <span className="text-xs text-theme-text/70">
                  Exact component and auditory accessibility logic
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewingQuestionIdx(null)}
                className="p-1.5 rounded-lg border border-theme-border hover:bg-theme-border text-theme-text font-bold text-xs"
              >
                ✕ Close Preview
              </button>
            </div>

            {/* Simulated Question Card */}
            {(() => {
              const previewQ = questions[previewingQuestionIdx];
              return (
                <div className="space-y-4">
                  <h3
                    id="student-preview-modal-title"
                    className="text-xl font-bold text-theme-text flex items-center gap-2"
                  >
                    <span className="text-indigo-600 font-black">Q{previewQ.questionNumber}.</span>
                    <span>{previewQ.questionText || 'Question statement...'}</span>
                  </h3>

                  {previewQ.mathLatex && (
                    <div className="p-3 rounded-xl bg-theme-bg border border-theme-border inline-block">
                      <MathEquation latex={previewQ.mathLatex} displayMode={true} />
                    </div>
                  )}

                  {/* Sonification Graph if enabled */}
                  {previewQ.graph && previewQ.graph.enabled && (
                    <InteractiveSonificationGraph graph={previewQ.graph} isStudentMode={true} />
                  )}

                  {/* 4 Options Grid */}
                  <div className="space-y-2 pt-2">
                    <label className="text-xs font-bold uppercase text-theme-text/60">
                      Options Preview:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {previewQ.options.map((opt) => (
                        <div
                          key={opt.number}
                          className={`p-3 rounded-xl border-2 flex items-center gap-3 ${
                            previewQ.correctOption === opt.number
                              ? 'border-emerald-500 bg-emerald-500/10'
                              : 'border-theme-border bg-theme-bg'
                          }`}
                        >
                          <span className="w-6 h-6 rounded-full bg-theme-border font-bold text-xs flex items-center justify-center">
                            {opt.number}
                          </span>
                          <span className="text-xs font-medium text-theme-text">{opt.text || `Option ${opt.number}`}</span>
                          {previewQ.correctOption === opt.number && (
                            <span className="ml-auto text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              ✓ Correct Answer
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {previewQ.explanation && (
                    <div className="p-3 rounded-xl bg-theme-bg border border-theme-border text-xs text-theme-text/80">
                      <strong>Solution Explanation:</strong> {previewQ.explanation}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
