'use client';

import { MapPin, Mountain, Waves, Building2, Camera } from 'lucide-react';

const destinationTypes = [
  {
    icon: Mountain,
    title: 'Mountain Escapes',
    description: 'Himalayan adventures and hill station retreats',
    count: '15+ destinations',
    color: 'from-purple-100 to-purple-50',
    iconColor: 'text-purple-600',
  },
  {
    icon: Waves,
    title: 'Coastal Paradise',
    description: 'Pristine beaches and coastal towns',
    count: '12+ destinations',
    color: 'from-purple-50 to-purple-100',
    iconColor: 'text-purple-600',
  },
  {
    icon: Building2,
    title: 'Urban Explorations',
    description: 'Vibrant cities and cultural hubs',
    count: '18+ destinations',
    color: 'from-purple-100 to-purple-50',
    iconColor: 'text-purple-600',
  },
  {
    icon: Camera,
    title: 'Heritage Sites',
    description: 'Historical monuments and cultural landmarks',
    count: '20+ destinations',
    color: 'from-purple-50 to-purple-100',
    iconColor: 'text-purple-600',
  },
];

export default function DestinationsShowcase() {
  return (
    <section className="py-16 md:py-24 lg:py-32 bg-white border-t border-purple-100 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute top-1/2 left-0 w-96 h-96 bg-purple-200 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-300 rounded-full blur-3xl"></div>
      </div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 md:mb-16 lg:mb-20 px-4">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-gray-900 mb-4 md:mb-6 tracking-tight">
            Explore by Category
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-3xl mx-auto font-light leading-relaxed">
            Discover India's diverse landscapes through our carefully curated destination categories
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
          {destinationTypes.map((type, index) => {
            const Icon = type.icon;
            return (
              <div
                key={index}
                className="group relative bg-gradient-to-br from-purple-50 to-white border-2 border-purple-100 rounded-xl md:rounded-2xl p-6 md:p-8 hover:border-purple-200 hover:shadow-xl transition-all duration-300 overflow-hidden"
              >
                {/* Decorative background */}
                <div className={`absolute inset-0 bg-gradient-to-br ${type.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
                
                <div className="relative z-10">
                  <div className="mb-4 md:mb-6">
                    <div className="w-14 h-14 md:w-16 md:h-16 bg-purple-100 rounded-xl flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                      <Icon className={`h-7 w-7 md:h-8 md:w-8 ${type.iconColor}`} />
                    </div>
                  </div>
                  
                  <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-2 md:mb-3 tracking-tight">
                    {type.title}
                  </h3>
                  
                  <p className="text-sm md:text-base text-gray-600 mb-3 md:mb-4 font-light leading-relaxed">
                    {type.description}
                  </p>
                  
                  <div className="flex items-center space-x-2 text-xs md:text-sm text-purple-600 uppercase tracking-wide font-medium">
                    <MapPin className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    <span>{type.count}</span>
                  </div>
                </div>

                {/* Hover effect border */}
                <div className="absolute inset-0 border-2 border-purple-300 rounded-xl md:rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

