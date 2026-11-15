'use client';

import { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

export default function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > Math.max(800, window.innerHeight * 1.5)) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <>
      {isVisible && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-40 flex h-10 w-10 md:h-11 md:w-11 items-center justify-center rounded-full bg-white/95 text-gray-700 border border-gray-200 shadow-md backdrop-blur hover:bg-white hover:text-purple-700 transition-colors print:hidden"
          aria-label="Scroll to top"
        >
          <ArrowUp className="h-[18px] w-[18px]" />
        </button>
      )}
    </>
  );
}

