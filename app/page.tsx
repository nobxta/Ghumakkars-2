import Hero from '@/components/Hero';
import Trips from '@/components/Trips';
import Features from '@/components/Features';
import FAQ from '@/components/FAQ';
import Stats from '@/components/Stats';
import Testimonials from '@/components/Testimonials';
import About from '@/components/About';
import Newsletter from '@/components/Newsletter';
import CTA from '@/components/CTA';

export default function Home() {
  return (
    <div className="pt-16">
      <Hero />
      <Stats />
      <Trips />
      <Features />
      <FAQ />
      <Testimonials />
      <About />
      <Newsletter />
      <CTA />
    </div>
  );
}

