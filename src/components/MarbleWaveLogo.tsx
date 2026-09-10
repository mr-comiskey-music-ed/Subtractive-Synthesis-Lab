/// <reference types="vite/client" />
import React, { useState } from 'react';

interface MarbleWaveLogoProps {
  className?: string;
  size?: number;
}

export const MarbleWaveLogo: React.FC<MarbleWaveLogoProps> = ({ className = "w-8 h-8", size = 32 }) => {
  const [imgError, setImgError] = useState(false);
  const logoSrc = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/logo.png`;

  if (!imgError) {
    return (
      <div className={`relative flex items-center justify-center shrink-0 rounded-xl overflow-hidden bg-slate-900 border border-slate-700/60 shadow-md ${className}`} style={{ width: size, height: size }}>
        <img
          src={logoSrc}
          alt="Subtractive Synthesis Lab Logo"
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div className={`relative flex items-center justify-center shrink-0 rounded-xl overflow-hidden bg-slate-900 border border-slate-700/60 shadow-md ${className}`} style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full p-0.5"
      >
        <rect width="512" height="512" rx="96" fill="#1e293b" />
        <path d="M120 310L180 140L230 230L120 310Z" fill="#cbd5e1" />
        <path d="M180 140L215 70L250 170L180 140Z" fill="#f8fafc" />
        <path d="M215 70L275 120L230 330L120 310L215 70Z" fill="#e2e8f0" />
        <path d="M215 70L275 120L255 240L215 70Z" fill="#f8fafc" />
        <path d="M275 120L340 160L300 350L230 330L275 120Z" fill="#cbd5e1" />
        <path d="M275 120L320 90L340 160L275 120Z" fill="#f1f5f9" />
        <path
          d="M40 330C80 330 100 240 140 240C180 240 200 420 256 420C312 420 332 230 372 230C412 230 430 330 472 330"
          fill="none"
          stroke="#2dd4bf"
          strokeWidth="36"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M40 330C80 330 100 240 140 240C180 240 200 420 256 420C312 420 332 230 372 230C412 230 430 330 472 330"
          fill="none"
          stroke="#99f6e4"
          strokeWidth="12"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <g transform="translate(320, 150) rotate(35)">
          <path d="M0 20L40 0L45 10L10 30L0 20Z" fill="#14b8a6" />
          <path d="M10 30L45 10L50 20L15 40L10 30Z" fill="#0d9488" />
          <rect x="40" y="5" width="25" height="35" rx="4" fill="#64748b" />
          <line x1="45" y1="5" x2="45" y2="40" stroke="#475569" strokeWidth="3" />
          <path d="M65 2L130 15C138 17 143 25 140 33C138 38 133 42 127 42L65 30V2Z" fill="#2dd4bf" />
          <path d="M65 15L130 25" stroke="#0f766e" strokeWidth="4" />
        </g>
        <polygon points="310,230 325,220 320,240" fill="#f8fafc" />
        <polygon points="295,190 310,185 305,205" fill="#e2e8f0" />
        <polygon points="345,260 360,250 355,270" fill="#cbd5e1" />
        <polygon points="330,290 340,285 335,300" fill="#94a3b8" />
      </svg>
    </div>
  );
};
