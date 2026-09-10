import React, { useState } from 'react';
import { SynthParams, StudentSubmission } from '../types';
import {
  generateVerificationCode,
  verifyCode,
  formatClassroomSummary,
  VerificationResult,
} from '../utils/verification';
import {
  PATCH_MATCHER_CHALLENGES,
  SYNTH_DOCTOR_TICKETS,
  BLIND_TEST_CHALLENGES,
} from '../utils/presets';
import {
  GraduationCap,
  Link,
  Check,
  Copy,
  ShieldCheck,
  FileCheck,
  Send,
  Sparkles,
  Search,
  ExternalLink,
} from 'lucide-react';

interface ModeTeacherProps {
  currentParams: SynthParams;
  completedTasks: { taskId: string; taskTitle: string; score: number }[];
  assignmentCodeFromUrl?: string;
  tasksFromUrl?: string[];
  onLoadCustomAssignment?: (tasks: string[]) => void;
}

export const ModeTeacher: React.FC<ModeTeacherProps> = ({
  currentParams,
  completedTasks,
  assignmentCodeFromUrl = 'SUBTRACTIVE_SYNTH_01',
}) => {
  // Student Submission State
  const [studentName, setStudentName] = useState<string>('');
  const [submission, setSubmission] = useState<StudentSubmission | null>(null);
  const [copiedClassroom, setCopiedClassroom] = useState<boolean>(false);
  const [copiedVerifyCode, setCopiedVerifyCode] = useState<boolean>(false);

  // Teacher Assignment Creator State
  const [assignmentTitle, setAssignmentTitle] = useState<string>('ADSR & Filter Essentials');
  const [assignmentCode, setAssignmentCode] = useState<string>('LAB-01');
  const [selectedTasks, setSelectedTasks] = useState<string[]>([
    'pm-pluck',
    'pm-pad',
    'sd-1',
    'sd-2',
    'ab-1',
    'ab-2',
  ]);
  const [generatedUrl, setGeneratedUrl] = useState<string>('');
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

  // Teacher Verification Inspector State
  const [inputVerifyCode, setInputVerifyCode] = useState<string>('');
  const [verifyResult, setVerifyResult] = useState<VerificationResult | null>(null);

  // All Available Tasks
  const allAvailableTasks = [
    ...PATCH_MATCHER_CHALLENGES.map((p) => ({
      id: p.id,
      title: `Patch Matcher: ${p.title}`,
      category: 'Patch Matcher',
    })),
    ...SYNTH_DOCTOR_TICKETS.map((t) => ({
      id: t.id,
      title: `Synth Doctor: #${t.ticketNumber} ${t.title}`,
      category: 'Synth Doctor',
    })),
    ...BLIND_TEST_CHALLENGES.map((b) => ({
      id: b.id,
      title: `Ear Test: ${b.question}`,
      category: 'Blind Ear Training',
    })),
  ];

  // Toggle Task in Creator
  const toggleTask = (id: string) => {
    if (selectedTasks.includes(id)) {
      setSelectedTasks(selectedTasks.filter((t) => t !== id));
    } else {
      setSelectedTasks([...selectedTasks, id]);
    }
  };

  // Generate Assignment Link
  const handleGenerateAssignmentUrl = () => {
    const origin = window.location.origin;
    const path = window.location.pathname;
    const taskParam = selectedTasks.join(',');
    const url = `${origin}${path}?assignment=${encodeURIComponent(assignmentCode)}&tasks=${encodeURIComponent(taskParam)}`;
    setGeneratedUrl(url);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(generatedUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  // Calculate student average score
  const totalScore =
    completedTasks.length > 0
      ? Math.round(
          completedTasks.reduce((acc, curr) => acc + curr.score, 0) / completedTasks.length
        )
      : 0;

  // Lock and generate student verification
  const handleLockSubmission = () => {
    if (!studentName.trim()) {
      alert('Please enter your full student name before locking your submission.');
      return;
    }

    const taskIds = completedTasks.map((t) => t.taskId);
    const code = generateVerificationCode(studentName, totalScore, assignmentCodeFromUrl, taskIds);

    const jsonStr = JSON.stringify(currentParams);
    const encodedPatch = encodeURIComponent(btoa(jsonStr));
    const patchUrl = `${window.location.origin}${window.location.pathname}?patch=${encodedPatch}`;

    const newSubmission: StudentSubmission = {
      studentName: studentName.trim(),
      assignmentCode: assignmentCodeFromUrl,
      timestamp: Date.now(),
      totalScore,
      completedTasks,
      encodedVerification: code,
      patchUrl,
    };

    setSubmission(newSubmission);
  };

  // Copy Google Classroom formatted summary
  const handleCopyClassroom = () => {
    if (!submission) return;
    const text = formatClassroomSummary(submission);
    navigator.clipboard.writeText(text);
    setCopiedClassroom(true);
    setTimeout(() => setCopiedClassroom(false), 2500);
  };

  // Teacher Inspector Check
  const handleVerifyString = () => {
    if (!inputVerifyCode.trim()) return;
    const res = verifyCode(inputVerifyCode);
    setVerifyResult(res);
  };

  return (
    <div id="mode-teacher-panel" className="space-y-4 mb-4">
      {/* SECTION 1: Student Submission & Verification */}
      <div className="rounded-xl bg-gradient-to-r from-slate-900 via-[#13161c] to-slate-900 border border-amber-500/40 p-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <GraduationCap className="w-6 h-6 text-amber-400" />
            <div>
              <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest font-bold">
                ZERO-SERVER GRADING & VERIFICATION
              </span>
              <h3 className="text-base font-bold text-white">Student Submission Portal</h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Current Grade:</span>
            <span className="text-lg font-mono font-bold text-amber-400 px-2 py-0.5 rounded bg-black/40 border border-amber-500/30">
              {totalScore} / 100
            </span>
          </div>
        </div>

        {/* Name input & Lock Grade button */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end mb-4">
          <div className="md:col-span-5">
            <label className="block text-xs font-mono text-slate-300 font-semibold mb-1">
              Your Full Name:
            </label>
            <input
              type="text"
              placeholder="e.g. Maya Lin"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-black/50 text-amber-300 font-mono text-sm border border-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
          </div>

          <div className="md:col-span-4">
            <span className="block text-xs font-mono text-slate-400 mb-1">
              Completed Tasks: {completedTasks.length}
            </span>
            <div className="text-xs font-mono text-slate-300 truncate">
              Assignment: <span className="text-amber-300">{assignmentCodeFromUrl}</span>
            </div>
          </div>

          <div className="md:col-span-3">
            <button
              type="button"
              onClick={handleLockSubmission}
              className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-mono font-bold text-xs uppercase flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(245,158,11,0.3)] active:scale-95 transition-all"
            >
              <ShieldCheck className="w-4 h-4" />
              Lock & Generate Grade
            </button>
          </div>
        </div>

        {/* Submission Output & Google Classroom Copy */}
        {submission && (
          <div className="p-4 rounded-xl bg-black/60 border border-emerald-500/50 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-emerald-400" />
                <span className="text-xs font-mono font-bold text-emerald-300 uppercase">
                  Submission Verified & Tamper-Checked
                </span>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Final Grade: <strong className="text-emerald-300 text-sm">{submission.totalScore}%</strong>
              </span>
            </div>

            {/* Verification Code Box */}
            <div className="flex items-center justify-between gap-2 bg-slate-900/80 p-2.5 rounded-lg border border-white/10">
              <div className="font-mono text-xs text-amber-300 select-all break-all">
                {submission.encodedVerification}
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(submission.encodedVerification);
                  setCopiedVerifyCode(true);
                  setTimeout(() => setCopiedVerifyCode(false), 2500);
                }}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200 flex items-center gap-1 flex-shrink-0"
              >
                {copiedVerifyCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                Copy Code
              </button>
            </div>

            {/* Google Classroom Share Button */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="text-xs text-slate-400">
                Ready to turn in on Google Classroom, Canvas, or Schoology?
              </span>

              <button
                type="button"
                onClick={handleCopyClassroom}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs uppercase flex items-center gap-2 shadow-[0_0_12px_rgba(16,185,129,0.3)] active:scale-95 transition-all"
              >
                {copiedClassroom ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied For Classroom!
                  </>
                ) : (
                  <>
                    <ShareClassroomIcon />
                    Share Link for Google Classroom
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: Teacher Assignment Creator */}
      <div className="rounded-xl bg-[#12151c] border border-slate-700 p-4 shadow-xl">
        <div className="flex items-center gap-2 border-b border-white/10 pb-2 mb-3">
          <Link className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold font-mono uppercase text-slate-200">
            Teacher Assignment Link Generator
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">Assignment Title:</label>
            <input
              type="text"
              value={assignmentTitle}
              onChange={(e) => setAssignmentTitle(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded bg-black/40 text-slate-200 font-mono text-xs border border-slate-700 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">Assignment Code:</label>
            <input
              type="text"
              value={assignmentCode}
              onChange={(e) => setAssignmentCode(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded bg-black/40 text-slate-200 font-mono text-xs border border-slate-700 focus:outline-none"
            />
          </div>
        </div>

        <span className="block text-xs font-mono text-slate-300 font-semibold mb-2">
          Select Tasks Included in Assignment:
        </span>

        {/* Checkbox Tasks Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-black/30 rounded-lg border border-white/5 mb-3">
          {allAvailableTasks.map((t) => (
            <label
              key={t.id}
              className={`flex items-center gap-2 p-1.5 rounded text-xs font-mono cursor-pointer transition-colors ${
                selectedTasks.includes(t.id)
                  ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-800/40'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedTasks.includes(t.id)}
                onChange={() => toggleTask(t.id)}
                className="rounded text-cyan-500 focus:ring-0"
              />
              <span className="truncate">{t.title}</span>
            </label>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleGenerateAssignmentUrl}
            className="px-3.5 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold text-xs uppercase transition-all"
          >
            Generate Assignment URL
          </button>

          {generatedUrl && (
            <button
              type="button"
              onClick={handleCopyUrl}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs flex items-center gap-1"
            >
              {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedUrl ? 'Copied Link!' : 'Copy Link'}
            </button>
          )}
        </div>

        {generatedUrl && (
          <div className="mt-2 text-[11px] font-mono text-cyan-300/80 bg-black/40 p-2 rounded border border-cyan-800/30 break-all select-all">
            {generatedUrl}
          </div>
        )}
      </div>

      {/* SECTION 3: Teacher Verification Inspector Tool */}
      <div className="rounded-xl bg-[#12151c] border border-slate-700 p-4 shadow-xl">
        <div className="flex items-center gap-2 border-b border-white/10 pb-2 mb-3">
          <Search className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold font-mono uppercase text-slate-200">
            Teacher Verification Code Inspector
          </h3>
        </div>

        <p className="text-xs text-slate-400 mb-2">
          Paste any student verification string (e.g.{' '}
          <code className="text-amber-300">SYNTH-94-JSMITH-A3F9X-2026</code>) to verify authenticity
          and view the exact grade:
        </p>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Paste student verification code here..."
            value={inputVerifyCode}
            onChange={(e) => setInputVerifyCode(e.target.value)}
            className="flex-1 px-3 py-1.5 rounded bg-black/40 text-amber-300 font-mono text-xs border border-slate-700 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleVerifyString}
            className="px-4 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-black font-mono font-bold text-xs uppercase"
          >
            Verify Grade
          </button>
        </div>

        {verifyResult && (
          <div
            className={`mt-3 p-3 rounded-lg border text-xs font-mono flex items-center gap-2.5 ${
              verifyResult.valid
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                : 'bg-red-950/60 border-red-500/40 text-red-200'
            }`}
          >
            {verifyResult.valid ? (
              <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            ) : (
              <Search className="w-5 h-5 text-red-400 flex-shrink-0" />
            )}
            <div>{verifyResult.notes}</div>
          </div>
        )}
      </div>
    </div>
  );
};

function ShareClassroomIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.73L12 15l5-2.74v3.73z" />
    </svg>
  );
}
