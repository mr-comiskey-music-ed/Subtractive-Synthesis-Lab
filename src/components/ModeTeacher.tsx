import React, { useState, useEffect } from 'react';
import { SynthParams, StudentSubmission } from '../types';
import {
  generateVerificationCode,
  encodeSubmissionReport,
  decodeSubmissionReport,
  getBaseReportUrl,
} from '../utils/verification';
import {
  GraduationCap,
  Check,
  ShieldCheck,
  Share2,
  X,
  Award,
  AlertTriangle,
  Copy,
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
  const [manualReportInput, setManualReportInput] = useState<string>('');
  const [rawReportCode, setRawReportCode] = useState<string>(
    sharedReport?.submission ? encodeSubmissionReport(sharedReport.submission, currentParams) : ''
  );
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [verificationError, setVerificationError] = useState<string | null>(sharedReport?.error || null);

  // Reactive update when sharedReport changes asynchronously
  useEffect(() => {
    if (sharedReport) {
      if (sharedReport.submission) {
        setSubmission(sharedReport.submission);
        const encodedReport = encodeSubmissionReport(sharedReport.submission, currentParams);
        setRawReportCode(encodedReport);
        setSecureReportUrl(`${getBaseReportUrl()}?report=${encodedReport}`);
      }
      if (sharedReport.valid) {
        setShowReportModal(true);
      } else if (sharedReport.error) {
        setVerificationError(sharedReport.error);
      }
    }
  }, [sharedReport, currentParams]);

  const handleManualLoadReport = () => {
    if (!manualReportInput.trim()) return;
    setVerificationError(null);
    let param = manualReportInput.trim();
    try {
      if (param.includes('report=')) {
        const urlObj = new URL(param.startsWith('http') ? param : `https://dummy.com?${param}`);
        const rep = urlObj.searchParams.get('report');
        if (rep) param = rep;
      }
    } catch (e) {
      const match = param.match(/report=([^&]+)/);
      if (match && match[1]) {
        param = match[1];
      }
    }

    const decoded = decodeSubmissionReport(param);
    if (decoded.valid && decoded.submission) {
      setSubmission(decoded.submission);
      setRawReportCode(param);
      const encodedReport = encodeSubmissionReport(decoded.submission, currentParams);
      setSecureReportUrl(`${getBaseReportUrl()}?report=${encodedReport}`);
      setShowReportModal(true);
      setManualReportInput('');
    } else {
      setVerificationError(decoded.error || '⚠️ TAMPER DETECTED: Invalid submission code or signature checksum mismatch.');
    }
  };

  // Calculate student score proportional to 30 total tasks
  const totalScore =
    sharedReport?.submission?.totalScore ??
    (completedTasks.length > 0
      ? Math.round(
          completedTasks.reduce((acc, curr) => acc + curr.score, 0) / 30
        )
      : 0);

  // Lock and generate secure tamper-proof report code
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
    const url = `${getBaseReportUrl()}?report=${encodedReport}`;

    setSubmission(newSub);
    setRawReportCode(encodedReport);
    setSecureReportUrl(url);
  };

  const handleCopyLink = () => {
    const urlToCopy = secureReportUrl || (submission ? `${getBaseReportUrl()}?report=${encodeSubmissionReport(submission, currentParams)}` : window.location.href);
    navigator.clipboard.writeText(urlToCopy);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopySubmissionCode = () => {
    if (!rawReportCode) return;
    navigator.clipboard.writeText(rawReportCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
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

        {/* Name input & Lock & Generate Code button */}
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
              Lock & Generate Code
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

            {/* Google Classroom Submission Code Box */}
            <div className="space-y-3 pt-3 border-t border-white/10">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono text-emerald-300 font-bold uppercase tracking-wider">
                  Student Submission Code for Google Classroom:
                </label>
                <span className="text-[10px] font-mono text-slate-400">
                  Select & copy code below
                </span>
              </div>

              <div className="relative">
                <textarea
                  readOnly
                  rows={3}
                  value={rawReportCode}
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                  className="w-full px-3 py-2 rounded-lg bg-black/90 text-emerald-400 font-mono text-xs border border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-400 select-all"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <p className="text-xs font-mono text-slate-300 max-w-md flex-1">
                  Copy this code and paste it into your Google Classroom assignment or send it to your teacher.
                </p>

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
                    onClick={handleCopySubmissionCode}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs uppercase flex items-center justify-center gap-2 shadow-[0_0_12px_rgba(16,185,129,0.3)] active:scale-95 transition-all flex-shrink-0"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-4 h-4" />
                        Code Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy Code
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Compact Teacher Code Check at the bottom */}
        <div className="mt-6 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center gap-2">
          <span className="text-xs font-mono text-amber-400 font-bold whitespace-nowrap">
            Teacher Code Check:
          </span>
          <input
            type="text"
            placeholder="Paste student submission code or URL..."
            value={manualReportInput}
            onChange={(e) => {
              setManualReportInput(e.target.value);
              setVerificationError(null);
            }}
            className="flex-1 px-3 py-1.5 rounded bg-black/70 text-slate-100 font-mono text-xs border border-amber-500/30 focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
          <button
            type="button"
            onClick={handleManualLoadReport}
            className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-black font-mono font-bold text-xs uppercase flex items-center gap-1 flex-shrink-0"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Verify
          </button>
        </div>
        {verificationError && (
          <div className="mt-2 p-2 rounded bg-red-950/80 border border-red-500/60 text-red-200 text-xs font-mono flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
            <span>{verificationError}</span>
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


          </div>
        </div>
      )}
    </div>
  );
};
