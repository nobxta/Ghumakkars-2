'use client';

const packages = [
  {
    id: 1,
    name: 'Adventure Seeker',
    price: '$1,499',
    duration: '10 Days',
    features: [
      'Accommodation in 4-star hotels',
      'Breakfast & Dinner included',
      'Guided tours with local experts',
      'Airport transfers',
      'Travel insurance',
      '24/7 support',
    ],
    popular: false,
  },
  {
    id: 2,
    name: 'Luxury Explorer',
    price: '$2,999',
    duration: '12 Days',
    features: [
      '5-star luxury accommodation',
      'All meals included',
      'Private guided tours',
      'VIP airport transfers',
      'Premium travel insurance',
      'Concierge service',
      'Spa & wellness access',
    ],
    popular: true,
  },
  {
    id: 3,
    name: 'Budget Traveler',
    price: '$799',
    duration: '7 Days',
    features: [
      '3-star comfortable hotels',
      'Breakfast included',
      'Group tours',
      'Shared airport transfers',
      'Basic travel insurance',
      'Local support',
    ],
    popular: false,
  },
];

export default function Packages() {
  return (
    <section id="packages" className="py-20 bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Our Travel Packages
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Choose the perfect package that fits your travel style and budget
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className={`bg-white rounded-2xl shadow-xl overflow-hidden transform hover:scale-105 transition-all duration-300 ${
                pkg.popular ? 'ring-4 ring-blue-500 scale-105' : ''
              }`}
            >
              {pkg.popular && (
                <div className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-center py-2 font-semibold">
                  Most Popular
                </div>
              )}
              <div className="p-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{pkg.name}</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-blue-600">{pkg.price}</span>
                  <span className="text-gray-600 ml-2">/ {pkg.duration}</span>
                </div>
                <ul className="space-y-4 mb-8">
                  {pkg.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-green-500 mr-3 mt-1">✓</span>
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  className={`w-full py-3 rounded-full font-semibold transition-all duration-200 ${
                    pkg.popular
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:shadow-lg'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  Book Now
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

