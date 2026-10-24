import React from 'react';

export interface BrandLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'custom';
  className?: string;
  alt?: string;
  onClick?: () => void;
  showRing?: boolean;
}

const SIZE_MAP: Record<string, string> = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-14 h-14',
  xl: 'w-20 h-20',
  '2xl': 'w-24 h-24 sm:w-28 sm:h-28',
  custom: '',
};

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  className = '',
  alt = 'SoreAja Logo',
  onClick,
  showRing = true,
}) => {
  const sizeClasses = SIZE_MAP[size] || SIZE_MAP.md;

  return (
    <div
      onClick={onClick}
      className={`relative shrink-0 rounded-full overflow-hidden bg-[#481216] select-none ${
        showRing ? 'ring-2 ring-white/20 shadow-md' : ''
      } ${sizeClasses} ${className}`}
    >
      <img
        src="/assets/logo.webp"
        alt={alt}
        className="w-full h-full object-cover rounded-full"
        loading="eager"
        decoding="async"
        draggable={false}
      />
    </div>
  );
};
