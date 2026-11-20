import * as React from 'react';
import { BookOpen } from 'lucide-react';
import { cn } from '../../utils/cn';

interface BookCoverImageProps {
  src: string;
  alt: string;
  title?: string;
  className?: string;
}

export function BookCoverImage({ src, alt, title, className }: BookCoverImageProps) {
  const [failed, setFailed] = React.useState(false);

  if (failed || !src) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-elevated to-sidebar text-secondary p-3 text-center',
          className
        )}
      >
        <BookOpen className="h-6 w-6 text-accent" />
        {title && <span className="text-xs font-medium line-clamp-2">{title}</span>}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cn('object-cover', className)}
    />
  );
}
