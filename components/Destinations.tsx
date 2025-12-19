'use client';

const destinations = [
  {
    id: 1,
    name: 'Bali, Indonesia',
    image: '🏝️',
    description: 'Tropical paradise with beautiful beaches and rich culture',
    price: '$899',
    duration: '7 Days',
  },
  {
    id: 2,
    name: 'Paris, France',
    image: '🗼',
    description: 'The city of lights and romance',
    price: '$1,299',
    duration: '5 Days',
  },
  {
    id: 3,
    name: 'Tokyo, Japan',
    image: '🌸',
    description: 'Modern metropolis meets traditional culture',
    price: '$1,499',
    duration: '6 Days',
  },
  {
    id: 4,
    name: 'Santorini, Greece',
    image: '🌅',
    description: 'Stunning sunsets and white-washed buildings',
    price: '$1,199',
    duration: '5 Days',
  },
  {
    id: 5,
    name: 'Dubai, UAE',
    image: '🏙️',
    description: 'Luxury and innovation in the desert',
    price: '$1,599',
    duration: '6 Days',
  },
  {
    id: 6,
    name: 'Maldives',
    image: '🏖️',
    description: 'Crystal clear waters and overwater villas',
    price: '$2,499',
    duration: '7 Days',
  },
];

export default function Destinations() {
  return (
    <section id="destinations" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Popular Destinations
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Discover amazing places around the world and let us plan your perfect getaway
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {destinations.map((destination) => (
            <div
              key={destination.id}
              className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-2xl transform hover:-translate-y-2 transition-all duration-300 group"
            >
              <div className="relative h-64 bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center">
                <div className="text-8xl group-hover:scale-110 transition-transform duration-300">
                  {destination.image}
                </div>
                <div className="absolute top-4 right-4 bg-white px-3 py-1 rounded-full text-sm font-semibold text-blue-600">
                  {destination.price}
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{destination.name}</h3>
                <p className="text-gray-600 mb-4">{destination.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">⏱️ {destination.duration}</span>
                  <button className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-6 py-2 rounded-full hover:shadow-lg transform hover:scale-105 transition-all duration-200 text-sm font-semibold">
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

