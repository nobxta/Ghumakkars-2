'use client';

import { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

export default function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.pageYOffset > 300) {
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
          className="fixed bottom-6 md:bottom-8 right-6 md:right-8 z-50 bg-purple-600 text-white p-3 md:p-4 rounded-full shadow-xl hover:shadow-2xl hover:bg-purple-700 transition-all duration-300 transform hover:scale-110 group"
          aria-label="Scroll to top"
        >
          <ArrowUp className="h-5 w-5 md:h-6 md:w-6 group-hover:-translate-y-1 transition-transform" />
          <div className="absolute inset-0 bg-purple-400 rounded-full opacity-0 group-hover:opacity-20 animate-ping"></div>
        </button>
      )}
    </>
  );
}

