import { StudentSubmission, SynthParams } from '../types';

// Simple lightweight obfuscated hash/checksum generator for browser environment
function generateHash(input: string, salt: string = 'SYNTH_SECURE_PEDAGOGY_SALT_2026'): string {
  let hash = 0x811c9dc5;
  const str = input + salt;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).toUpperCase().padStart(8, '0');
}

export function generateVerificationCode(
  studentName: string,
  score: number,
  assignmentCode: string,
  tasksCompleted: string[]
): string {
  const cleanName = studentName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || 'STUDENT';
  const timestamp = Math.floor(Date.now() / 1000);
  const taskStr = tasksCompleted.sort().join(',');
  const rawSignature = `${cleanName}:${score}:${assignmentCode}:${taskStr}:${timestamp}`;
  const checksum = generateHash(rawSignature).substring(0, 6);
  
  const year = new Date().getFullYear();
  return `SYNTH-${Math.round(score)}-${cleanName}-${checksum}-${year}`;
}

export function encodeSubmissionReport(submission: StudentSubmission, currentParams?: SynthParams): string {
  const patchJson = currentParams ? JSON.stringify(currentParams) : '';
  const taskStr = submission.completedTasks.map(t => `${t.taskId}:${Math.round(t.score)}`).sort().join(',');
  const rawSignaturePayload = `${submission.studentName.trim().toUpperCase()}:${submission.totalScore}:${submission.assignmentCode}:${taskStr}:${submission.timestamp}`;
  const signature = generateHash(rawSignaturePayload, 'SYNTH_SECURE_PEDAGOGY_SALT_2026');

  const reportData = {
    n: submission.studentName,
    a: submission.assignmentCode,
    t: submission.timestamp,
    s: submission.totalScore,
    tasks: submission.completedTasks,
    p: patchJson,
    sig: signature,
  };

  try {
    return encodeURIComponent(btoa(JSON.stringify(reportData)));
  } catch (e) {
    return '';
  }
}

export function decodeSubmissionReport(encoded: string): {
  valid: boolean;
  submission?: StudentSubmission;
  patchParams?: SynthParams;
  error?: string;
} {
  try {
    const jsonStr = atob(decodeURIComponent(encoded));
    const data = JSON.parse(jsonStr);

    if (!data || typeof data !== 'object' || !data.n || data.s === undefined || !data.sig) {
      return { valid: false, error: 'Invalid report payload structure.' };
    }

    const completedTasks = Array.isArray(data.tasks) ? data.tasks : [];
    const taskStr = completedTasks.map((t: any) => `${t.taskId}:${Math.round(t.score)}`).sort().join(',');
    const rawSignaturePayload = `${data.n.trim().toUpperCase()}:${data.s}:${data.a || 'SYNTH_LAB_01'}:${taskStr}:${data.t}`;
    const expectedSig = generateHash(rawSignaturePayload, 'SYNTH_SECURE_PEDAGOGY_SALT_2026');

    if (data.sig !== expectedSig) {
      return { valid: false, error: '⚠️ TAMPER DETECTED: Submission signature checksum mismatch! Grades have been modified.' };
    }

    let patchParams: SynthParams | undefined;
    if (data.p) {
      try {
        patchParams = JSON.parse(data.p);
      } catch (e) {}
    }

    const submission: StudentSubmission = {
      studentName: data.n,
      assignmentCode: data.a || 'SYNTH_LAB_01',
      timestamp: data.t || Date.now(),
      totalScore: data.s,
      completedTasks,
      encodedVerification: data.sig,
      patchUrl: window.location.href,
    };

    return { valid: true, submission, patchParams };
  } catch (e) {
    return { valid: false, error: 'Failed to decode report payload.' };
  }
}

export function formatClassroomSummary(submission: StudentSubmission): string {
  const dateStr = new Date(submission.timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return `### 🎹 Subtractive Synthesis Lab - Tamper-Proof Student Report
**Student Name:** ${submission.studentName}
**Assignment Code:** ${submission.assignmentCode}
**Date Completed:** ${dateStr}
**Overall Grade:** **${Math.round(submission.totalScore)} / 100**

#### Challenge Breakdown:
${submission.completedTasks.map(t => `- **${t.taskTitle}**: ${Math.round(t.score)}%`).join('\n')}

---
**Secure Cryptographic Checksum:**
\`${submission.encodedVerification}\`
`;
}

export function getBaseReportUrl(): string {
  const hostname = window.location.hostname || '';
  const isAppsScript = hostname.includes('googleusercontent.com') || hostname.includes('script.google.com') || !!(window as any).google?.script;
  if (isAppsScript) {
    return "https://script.google.com/macros/s/AKfycbz5mCjB0x4A2EesLkxDxVifjteKBg-wjTztFehvEtfot2ytr5wMb5dbF2W2J-qJtuee/exec";
  }
  return `${window.location.origin}${window.location.pathname}`;
}

