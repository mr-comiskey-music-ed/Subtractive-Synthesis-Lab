import React from 'react';
import { WaveformType } from '../types';

interface WaveformIconProps {
  type: WaveformType;
  className?: string;
  size?: number;
}

export const WaveformIcon: React.FC<WaveformIconProps> = ({ type, className = "w-4 h-4", size = 16 }) => {
  switch (type) {
    case 'sawtooth':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter" className={className}>
          <path d="M3 19 L12 5 L12 19 L21 5" />
        </svg>
      );
    case 'square':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter" className={className}>
          <path d="M3 19 L3 5 L12 5 L12 19 L21 19 L21 5" />
        </svg>
      );
    case 'triangle':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter" className={className}>
          <path d="M3 19 L12 5 L21 19" />
        </svg>
      );
    case 'sine':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M3 12 C6 5, 9 5, 12 12 C15 19, 18 19, 21 12" />
        </svg>
      );
    case 'noise':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M2 14 L5 6 L8 18 L11 5 L14 17 L17 7 L20 16 L22 10" />
        </svg>
      );
    default:
      return null;
  }
};
