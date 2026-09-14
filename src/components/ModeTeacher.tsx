import React, { useState } from 'react';
import { SynthParams, StudentSubmission } from '../types';
import {
  generateVerificationCode,
  encodeSubmissionReport,
} from '../utils/verification';
import {
  GraduationCap,
  Check,
  ShieldCheck,
  Share2,
  X,
  Award,
  AlertTriangle,
} from 'lucide-react';

interface ModeTeacherProps {
  currentParams: SynthParams;
  completedTasks: { taskId: string; taskTitle: string; score: number }[];
  assignmentCodeFromUrl?: string;
  sharedReport?: { valid: boolean; submission?: StudentSubmission; error?: string } | null;
}

export const ModeTeacher: React.FC<ModeTeacherProps> = ({
  currentParams,
  completedTasks,
  assignmentCodeFromUrl = 'SYNTH_LAB_01',
  sharedReport = null,
}) => {
  const [studentName, setStudentName] = useState<string>('');
  const [submission, setSubmission] = useState<StudentSubmission | null>(sharedReport?.submission || null);
  const [secureReportUrl, setSecureReportUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [showReportModal, setShowReportModal] = useState<boolean>(!!sharedReport);

  // Calculate student average score
  const totalScore =
    sharedReport?.submission?.totalScore ??
    (completedTasks.length > 0
      ? Math.round(
          completedTasks.reduce((acc, curr) => acc + curr.score, 0) / completedTasks.length
        )
      : 0);

  // Lock and generate secure tamper-proof report link
  const handleLockSubmission = () => {
    if (!studentName.trim()) {
      alert('Please enter your full student name before locking your submission.');
      return;
    }

    const taskIds = completedTasks.map((t) => t.taskId);
    const code = generateVerificationCode(studentName, totalScore, assignmentCodeFromUrl, taskIds);

    const newSub: StudentSubmission = {
      studentName: studentName.trim(),
      assignmentCode: assignmentCodeFromUrl,
      timestamp: Date.now(),
      totalScore,
      completedTasks,
      encodedVerification: code,
      patchUrl: window.location.href,
    };

    const encodedReport = encodeSubmissionReport(newSub, currentParams);
    const url = `${window.location.origin}${window.location.pathname}?report=${encodedReport}`;

    setSubmission(newSub);
    setSecureReportUrl(url);
    setShowReportModal(true);
  };

  const handleCopyLink = () => {
    const urlToCopy = secureReportUrl || window.location.href;
    navigator.clipboard.writeText(urlToCopy);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div id="mode-teacher-panel" className="space-y-4 mb-4 max-w-4xl mx-auto">
      <div className="rounded-xl bg-gradient-to-r from-slate-900 via-[#13161c] to-slate-900 border border-amber-500/40 p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-7 h-7 text-amber-400" />
            <div>
              <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest font-bold">
                STUDENT GRADE REPORT & SUBMISSION
              </span>
              <h3 className="text-lg font-bold text-white">Grade Report & Teacher Share Link</h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Overall Grade:</span>
            <span className="text-lg font-mono font-bold text-amber-400 px-3 py-1 rounded bg-black/40 border border-amber-500/30">
              {totalScore} / 100
            </span>
          </div>
        </div>

        {/* Name input & Lock & Generate Link button */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end mb-6">
          <div className="md:col-span-5">
            <label className="block text-xs font-mono text-slate-300 font-semibold mb-1.5">
              Your Full Name:
            </label>
            <input
              type="text"
              placeholder="e.g. Maya Lin"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-black/50 text-amber-300 font-mono text-sm border border-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
          </div>

          <div className="md:col-span-4">
            <span className="block text-xs font-mono text-slate-300 font-semibold mb-1.5">
              Completed Tasks: {completedTasks.length}/30
            </span>
            <div className="text-xs font-mono text-slate-400 py-2">
              All finished quests and scores are tracked below.
            </div>
          </div>

          <div className="md:col-span-3">
            <button
              type="button"
              onClick={handleLockSubmission}
              className="w-full py-2.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-mono font-bold text-xs uppercase flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(245,158,11,0.3)] active:scale-95 transition-all"
            >
              <ShieldCheck className="w-4 h-4" />
              Lock & Generate Link
            </button>
          </div>
        </div>

        {/* Submission Report & Share Link */}
        {submission && (
          <div className="p-5 rounded-xl bg-black/70 border border-emerald-500/50 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-emerald-400" />
                <span className="text-xs font-mono font-bold text-emerald-300 uppercase tracking-wide">
                  Tamper-Proof Grade Report Generated & Locked
                </span>
              </div>
              <span className="text-xs font-mono text-slate-300">
                Final Grade: <strong className="text-emerald-300 text-sm font-bold">{submission.totalScore}/100</strong>
              </span>
            </div>

            {/* Detailed Quest Breakdown */}
            <div className="space-y-2">
              <span className="block text-xs font-mono text-slate-400 uppercase tracking-wider font-semibold">
                Quests & Challenges Completed ({submission.completedTasks.length}):
              </span>
              {submission.completedTasks.length === 0 ? (
                <div className="text-xs font-mono text-slate-500 italic p-2 bg-slate-900/40 rounded">
                  No quests completed yet. Complete challenges in the Learn or Challenges tabs to record scores.
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {submission.completedTasks.map((task, idx) => (
                    <div
                      key={task.taskId || idx}
                      className="flex items-center justify-between p-2 rounded bg-slate-900/80 border border-white/5 text-xs font-mono"
                    >
                      <span className="text-slate-200">{task.taskTitle}</span>
                      <span className="text-emerald-400 font-bold">{Math.round(task.score)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Share Link for Teacher */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-white/10">
              <span className="text-xs font-mono text-slate-300">
                Open or copy secure tamper-proof report popup link for your teacher:
              </span>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setShowReportModal(true)}
                  className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-mono font-bold text-xs uppercase flex items-center justify-center gap-1.5 border border-amber-500/30 flex-shrink-0"
                >
                  <Award className="w-4 h-4" />
                  View Report
                </button>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs uppercase flex items-center justify-center gap-2 shadow-[0_0_12px_rgba(16,185,129,0.3)] active:scale-95 transition-all flex-shrink-0"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-4 h-4" />
                      Link Copied!
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4" />
                      Copy Link
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Grade Report Pop-up Modal Overlay */}
      {showReportModal && submission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl rounded-2xl bg-slate-950 border-2 border-amber-500/50 p-6 shadow-2xl text-slate-100 space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest font-bold">
                    OFFICIAL VERIFIED GRADE REPORT
                  </span>
                  <h3 className="text-lg font-bold text-white">Subtractive Synthesis Lab</h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-900/80 border border-white/10 font-mono text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Student Name:</span>
                <strong className="text-amber-300 text-sm">{submission.studentName}</strong>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Overall Grade:</span>
                <strong className="text-emerald-400 text-base">{submission.totalScore} / 100</strong>
              </div>
            </div>

            <div className="space-y-2">
              <span className="block text-xs font-mono text-slate-400 uppercase tracking-wider font-semibold">
                Challenging Quests Breakdown ({submission.completedTasks.length}):
              </span>
              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                {submission.completedTasks.map((t, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-white/5 font-mono text-xs"
                  >
                    <span className="text-slate-200">{t.taskTitle}</span>
                    <span className="text-emerald-400 font-bold">{Math.round(t.score)}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-white/10">
              <span className="text-xs font-mono text-slate-400 truncate max-w-md">
                Secure Link: <code className="text-amber-300">{secureReportUrl || window.location.href}</code>
              </span>

              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full sm:w-auto px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-mono font-bold text-xs uppercase flex items-center justify-center gap-1.5 flex-shrink-0"
              >
                {copiedLink ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                {copiedLink ? 'Link Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
