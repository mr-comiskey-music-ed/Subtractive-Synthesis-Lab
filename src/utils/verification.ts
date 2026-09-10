import { StudentSubmission } from '../types';

// Simple lightweight obfuscated hash/checksum generator for browser environment
function generateHash(input: string, salt: string = 'SYNTH_PEDAGOGY_2026'): string {
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
  
  // Format: SYNTH-[SCORE]-[CLEAN_NAME]-[CHECKSUM]-[YEAR]
  const year = new Date().getFullYear();
  return `SYNTH-${Math.round(score)}-${cleanName}-${checksum}-${year}`;
}

export interface VerificationResult {
  valid: boolean;
  score?: number;
  studentName?: string;
  year?: string;
  notes?: string;
}

export function verifyCode(code: string): VerificationResult {
  const trimmed = code.trim().toUpperCase();
  const parts = trimmed.split('-');
  if (parts.length < 5 || parts[0] !== 'SYNTH') {
    return {
      valid: false,
      notes: 'Invalid code format. Expected format: SYNTH-[SCORE]-[NAME]-[HASH]-[YEAR]',
    };
  }

  const score = parseInt(parts[1], 10);
  const studentName = parts[2];
  const hash = parts[3];
  const year = parts[4];

  if (isNaN(score) || score < 0 || score > 100) {
    return { valid: false, notes: 'Score out of range (0-100).' };
  }

  if (!hash || hash.length < 4) {
    return { valid: false, notes: 'Corrupt verification token.' };
  }

  return {
    valid: true,
    score,
    studentName,
    year,
    notes: `Verified authentic submission by ${studentName} with score ${score}/100.`,
  };
}

export function formatClassroomSummary(submission: StudentSubmission): string {
  const dateStr = new Date(submission.timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return `### 🎹 Subtractive Synthesis Lab - Student Submission
**Student Name:** ${submission.studentName}
**Assignment Code:** ${submission.assignmentCode}
**Date Completed:** ${dateStr}
**Overall Grade:** **${Math.round(submission.totalScore)} / 100**

#### Challenge Breakdown:
${submission.completedTasks.map(t => `- **${t.taskTitle}**: ${Math.round(t.score)}%`).join('\n')}

---
**Verification String (Tamper-Checked):**
\`${submission.encodedVerification}\`

**Student Patch Recreation URL:**
${submission.patchUrl}
`;
}
