'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MapPin, Camera, Utensils, Mountain, Waves, Sunrise, Calendar, Users, Star, ArrowRight, Heart, Share2 } from 'lucide-react';
import ScrollAnimation from '@/components/ScrollAnimation';

const destinationsData: Record<string, {
  name: string;
  slug: string;
  image: string;
  description: string;
  location: string;
  bestTime: string;
  culture: {
    title: string;
    description: string;
    highlights: string[];
  };
  bestThings: {
    title: string;
    items: {
      icon: any;
      name: string;
      description: string;
    }[];
  };
  gallery: string[];
  tips: string[];
  nearbyDestinations: string[];
}> = {
  'manali': {
    name: 'Manali',
    slug: 'manali',
    image: 'https://www.tripstorz.com/_astro/houses-surrounded-by-green-trees-in-manali-during-daytime.DAktkgeM_90jep.jpg?w=800&h=600&fit=crop',
    description: 'Nestled in the Pir Panjal and Dhauladhar ranges of the Himalayas, Manali is a breathtaking hill station that offers stunning landscapes, adventure activities, and rich cultural experiences.',
    location: 'Himachal Pradesh, India',
    bestTime: 'March to June, October to February',
    culture: {
      title: 'Rich Himalayan Culture',
      description: 'Manali is home to a vibrant mix of cultures with influences from Tibetan, Himachali, and Punjabi traditions. The region celebrates numerous festivals throughout the year, with colorful fairs, traditional music, and dance performances.',
      highlights: [
        'Traditional Himachali architecture with wooden houses',
        'Tibetan monasteries and Buddhist influence',
        'Local handicrafts including woolen shawls and carpets',
        'Folk music and dance performances',
        'Temple festivals and religious ceremonies',
        'Warm hospitality of the mountain people'
      ]
    },
    bestThings: {
      title: 'Best Things to Do',
      items: [
        {
          icon: Mountain,
          name: 'Adventure Sports',
          description: 'Paragliding, skiing, river rafting, ziplining, and trekking in the Himalayas'
        },
        {
          icon: Camera,
          name: 'Scenic Views',
          description: 'Visit Rohtang Pass, Solang Valley, Hadimba Temple, and Jogini Falls'
        },
        {
          icon: Utensils,
          name: 'Local Cuisine',
          description: 'Try traditional dishes like Dham, Sidu, Trout fish, and local apple products'
        },
        {
          icon: Sunrise,
          name: 'Nature Experiences',
          description: 'Hot springs, wildlife sanctuaries, apple orchards, and mountain trekking'
        }
      ]
    },
    gallery: [
      'https://www.tripstorz.com/_astro/houses-surrounded-by-green-trees-in-manali-during-daytime.DAktkgeM_90jep.jpg?w=800&h=600&fit=crop',
      'https://www.tusktravel.com/blog/wp-content/uploads/2021/02/Solang-Valley-Manali.jpg?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=600&fit=crop'
    ],
    tips: [
      'Carry warm clothes as temperatures can drop significantly',
      'Book adventure activities in advance during peak season',
      'Respect local customs and traditions',
      'Try local Himachali cuisine for authentic experience',
      'Carry cash as ATMs may be limited in remote areas'
    ],
    nearbyDestinations: ['Solang Valley', 'Rohtang Pass', 'Kasol', 'Kullu']
  },
  'mussorie': {
    name: 'Mussorie',
    slug: 'mussorie',
    image: 'https://hblimg.mmtcdn.com/content/hubble/img/destimg/mmt/destination/m_Mussorrie_main_tv_destination_img_1_l_639_958.jpg?w=800&h=600&fit=crop',
    description: 'Known as the "Queen of Hills", Mussorie is a charming hill station in Uttarakhand offering colonial architecture, beautiful waterfalls, and panoramic views of the Himalayan ranges.',
    location: 'Uttarakhand, India',
    bestTime: 'March to June, September to November',
    culture: {
      title: 'Colonial & Himalayan Heritage',
      description: 'Mussorie reflects a unique blend of British colonial architecture and Garhwali culture. The town has preserved its colonial charm with heritage buildings, churches, and libraries while maintaining strong local traditions.',
      highlights: [
        'Colonial-era architecture and churches',
        'Garhwali folk culture and traditions',
        'Temple visits and religious festivals',
        'Local handicrafts and woolen items',
        'Literary heritage and old libraries',
        'Traditional Garhwali music and dance'
      ]
    },
    bestThings: {
      title: 'Best Things to Do',
      items: [
        {
          icon: Camera,
          name: 'Scenic Spots',
          description: 'Visit Kempty Falls, Gun Hill, Lal Tibba, Cloud End, and Camel\'s Back Road'
        },
        {
          icon: Mountain,
          name: 'Nature Trails',
          description: 'Trekking, nature walks, cable car rides, and bird watching'
        },
        {
          icon: Utensils,
          name: 'Local Food',
          description: 'Try Garhwali thali, Kumaoni dishes, Tibetan momos, and street food at Mall Road'
        },
        {
          icon: Sunrise,
          name: 'Heritage Sites',
          description: 'Christ Church, Library Bazaar, and colonial bungalows'
        }
      ]
    },
    gallery: [
      'https://hblimg.mmtcdn.com/content/hubble/img/destimg/mmt/destination/m_Mussorrie_main_tv_destination_img_1_l_639_958.jpg?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=800&h=600&fit=crop'
    ],
    tips: [
      'Best visited during spring and autumn for pleasant weather',
      'Carry an umbrella during monsoon season',
      'Enjoy the Mall Road for shopping and local food',
      'Visit during off-season for fewer crowds',
      'Wear comfortable shoes for walking'
    ],
    nearbyDestinations: ['Landour', 'Dehradun', 'Rishikesh', 'Haridwar']
  },
  'kasol': {
    name: 'Kasol',
    slug: 'kasol',
    image: 'https://indotoursadventures.com/public/storage/blogs/165dec86f3683b83a19a09d0345dd8e2.jpg?w=800&h=600&fit=crop',
    description: 'Kasol is a paradise for trekkers and nature lovers, nestled along the Parvati River. Known as "Mini Israel" for its Israeli influence, it offers stunning landscapes and a laid-back hippie culture.',
    location: 'Himachal Pradesh, India',
    bestTime: 'April to June, October to November',
    culture: {
      title: 'Hippie Culture & Mountain Traditions',
      description: 'Kasol is a melting pot of cultures with a strong Israeli backpacker community and traditional Himachali roots. The town has a relaxed, bohemian atmosphere with cafes, music, and spiritual vibes.',
      highlights: [
        'Israeli cafes and international cuisine',
        'Hippie culture and backpacker community',
        'Traditional Himachali villages nearby',
        'Music festivals and cultural events',
        'Spiritual retreats and yoga sessions',
        'Mix of local and international influences'
      ]
    },
    bestThings: {
      title: 'Best Things to Do',
      items: [
        {
          icon: Mountain,
          name: 'Trekking',
          description: 'Kheerganga trek, Malana village, Tosh, Grahan, and Rasol treks'
        },
        {
          icon: Waves,
          name: 'Riverside Activities',
          description: 'Camping by Parvati River, bonfires, and riverside cafes'
        },
        {
          icon: Utensils,
          name: 'Cafe Culture',
          description: 'Try Israeli food, pancakes, momos, and international cuisine at local cafes'
        },
        {
          icon: Sunrise,
          name: 'Nature & Spirituality',
          description: 'Hot springs at Kheerganga, meditation, and nature immersion'
        }
      ]
    },
    gallery: [
      'https://indotoursadventures.com/public/storage/blogs/165dec86f3683b83a19a09d0345dd8e2.jpg?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop'
    ],
    tips: [
      'Ideal for backpackers and adventure enthusiasts',
      'Carry trekking gear if planning treks',
      'Respect local customs and environment',
      'Try Israeli cuisine at cafes',
      'Best for solo travelers and groups',
      'Carry cash as card facilities are limited'
    ],
    nearbyDestinations: ['Tosh', 'Malana', 'Manikaran', 'Manali']
  },
  'rishikesh': {
    name: 'Rishikesh',
    slug: 'rishikesh',
    image: 'https://s7ap1.scene7.com/is/image/incredibleindia/1-triveni-ghat-rishikesh-uttarakhand-2-city-hero?',
    description: 'The "Yoga Capital of the World", Rishikesh is a spiritual hub on the banks of the Ganges River, offering yoga, meditation, adventure sports, and ancient temples.',
    location: 'Uttarakhand, India',
    bestTime: 'February to May, September to November',
    culture: {
      title: 'Spiritual & Adventure Culture',
      description: 'Rishikesh is a unique blend of ancient spirituality and modern adventure tourism. It\'s a center for yoga, meditation, and Hindu philosophy, while also attracting adventure enthusiasts from around the world.',
      highlights: [
        'Yoga and meditation centers',
        'Evening Ganga Aarti ceremonies',
        'Ancient temples and ashrams',
        'Vegetarian culture and healthy food',
        'Spiritual festivals and events',
        'Mix of traditional and modern practices'
      ]
    },
    bestThings: {
      title: 'Best Things to Do',
      items: [
        {
          icon: Sunrise,
          name: 'Spiritual Experiences',
          description: 'Yoga classes, meditation, Ganga Aarti, temple visits, and ashram stays'
        },
        {
          icon: Mountain,
          name: 'Adventure Sports',
          description: 'River rafting, bungee jumping, rock climbing, and cliff jumping'
        },
        {
          icon: Camera,
          name: 'Iconic Bridges',
          description: 'Visit Lakshman Jhula, Ram Jhula, and Triveni Ghat'
        },
        {
          icon: Utensils,
          name: 'Healthy Cuisine',
          description: 'Vegetarian food, organic cafes, and healthy eating options'
        }
      ]
    },
    gallery: [
      'https://s7ap1.scene7.com/is/image/incredibleindia/1-triveni-ghat-rishikesh-uttarakhand-2-city-hero?',
      'https://images.unsplash.com/photo-1606811971618-4486c44f78e8?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1590736969955-71cc94901144?w=800&h=600&fit=crop'
    ],
    tips: [
      'No alcohol or non-vegetarian food in main areas',
      'Attend evening Ganga Aarti for spiritual experience',
      'Book rafting and adventure activities in advance',
      'Carry light cotton clothes for summer',
      'Respect spiritual atmosphere and local customs'
    ],
    nearbyDestinations: ['Haridwar', 'Dehradun', 'Mussoorie', 'Deoprayag']
  },
  'dalhousie': {
    name: 'Dalhousie',
    slug: 'dalhousie',
    image: 'https://skysafar.in/wp-content/uploads/2024/09/Untitled-design-10.png?w=800&h=600&fit=crop',
    description: 'A beautiful colonial hill station in Himachal Pradesh, Dalhousie is known for its old-world charm, pine-clad valleys, and stunning views of the Dhauladhar ranges.',
    location: 'Himachal Pradesh, India',
    bestTime: 'March to June, September to October',
    culture: {
      title: 'Colonial & Mountain Culture',
      description: 'Dalhousie retains its colonial character with old British architecture, churches, and peaceful atmosphere. The town blends British heritage with traditional Himachali culture.',
      highlights: [
        'British colonial architecture',
        'Ancient churches and heritage buildings',
        'Himachali traditions and customs',
        'Peaceful and serene atmosphere',
        'Local handicrafts and woolens',
        'Traditional festivals and celebrations'
      ]
    },
    bestThings: {
      title: 'Best Things to Do',
      items: [
        {
          icon: Camera,
          name: 'Scenic Views',
          description: 'Visit Panch Pulla, Satdhara Falls, Dainkund Peak, and Subhash Baoli'
        },
        {
          icon: Mountain,
          name: 'Nature Walks',
          description: 'Trekking, nature trails, and peaceful walks through pine forests'
        },
        {
          icon: Utensils,
          name: 'Local Food',
          description: 'Himachali cuisine, momos, and Tibetan food'
        },
        {
          icon: Sunrise,
          name: 'Heritage Sites',
          description: 'St. John\'s Church, St. Francis Church, and colonial bungalows'
        }
      ]
    },
    gallery: [
      'https://skysafar.in/wp-content/uploads/2024/09/Untitled-design-10.png?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop'
    ],
    tips: [
      'Best for peace and tranquility seekers',
      'Carry warm clothes as it can get cold',
      'Perfect for nature lovers and photographers',
      'Visit during off-season for solitude',
      'Enjoy slow-paced exploration'
    ],
    nearbyDestinations: ['Khajjiar', 'Chamba', 'Dharamshala', 'McLeod Ganj']
  },
  'spiti': {
    name: 'Spiti',
    slug: 'spiti',
    image: 'https://4cornersoftheworld.blog/wp-content/uploads/2020/08/920d8-1512812465_maxresdefault.jpg.jpg?w=800&h=600&fit=crop',
    description: 'A cold desert mountain valley in Himachal Pradesh, Spiti is a remote and pristine destination offering Buddhist monasteries, rugged landscapes, and unique culture.',
    location: 'Himachal Pradesh, India',
    bestTime: 'May to October',
    culture: {
      title: 'Tibetan Buddhist Culture',
      description: 'Spiti is deeply influenced by Tibetan Buddhism with ancient monasteries, prayer flags, and traditional Tibetan lifestyle. The region has preserved its unique culture and traditions for centuries.',
      highlights: [
        'Buddhist monasteries (gompas)',
        'Tibetan architecture and art',
        'Prayer wheels and prayer flags',
        'Traditional Tibetan festivals',
        'Ancient Buddhist manuscripts',
        'Unique Spitian dialect and customs'
      ]
    },
    bestThings: {
      title: 'Best Things to Do',
      items: [
        {
          icon: Sunrise,
          name: 'Monastery Visits',
          description: 'Key Monastery, Tabo Monastery, Dhankar Monastery, and Komic Monastery'
        },
        {
          icon: Camera,
          name: 'Stunning Landscapes',
          description: 'Chandratal Lake, Pin Valley, Kunzum Pass, and Langza fossil village'
        },
        {
          icon: Mountain,
          name: 'Adventure',
          description: 'Trekking, camping, and exploring high-altitude villages'
        },
        {
          icon: Star,
          name: 'Stargazing',
          description: 'One of the best places for stargazing in India due to clear skies'
        }
      ]
    },
    gallery: [
      'https://4cornersoftheworld.blog/wp-content/uploads/2020/08/920d8-1512812465_maxresdefault.jpg.jpg?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop'
    ],
    tips: [
      'Requires inner line permit for foreigners',
      'Carry warm clothes as temperatures are extreme',
      'Limited accommodation, book in advance',
      'Best explored by experienced travelers',
      'Respect local customs and monasteries',
      'Carry necessary medications for altitude'
    ],
    nearbyDestinations: ['Kaza', 'Kibber', 'Hikkim', 'Kunzum Pass']
  }
};

export default function DestinationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [destination, setDestination] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const slug = (params.slug as string)?.toLowerCase();
    const dest = destinationsData[slug];
    
    if (dest) {
      setDestination(dest);
    } else {
      router.push('/');
    }
    setLoading(false);
  }, [params.slug, router]);

  if (loading || !destination) {
    return (
      <div className="min-h-screen pt-16 md:pt-20 flex items-center justify-center bg-gradient-to-b from-purple-50/30 to-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 md:h-16 md:w-16 border-3 border-purple-200 border-t-purple-600 mx-auto"></div>
          <p className="mt-4 text-sm md:text-base text-purple-600 tracking-wide uppercase font-medium">Loading destination...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-16 md:pt-20 bg-gradient-to-b from-purple-50/30 via-white to-purple-50/30">
      {/* Hero Section */}
      <div className="relative h-96 md:h-[500px] lg:h-[600px] overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${destination.image})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20"></div>
        </div>
        <div className="relative z-10 h-full flex flex-col justify-end">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 md:pb-12">
            <Link
              href="/#trips"
              className="inline-flex items-center text-white/90 hover:text-white mb-6 text-sm font-medium transition-colors group"
            >
              <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
              <span>Back to Destinations</span>
            </Link>
            <h1 className="text-4xl md:text-5xl lg:text-7xl font-light text-white mb-4 tracking-tight">
              {destination.name}
            </h1>
            <div className="flex items-center space-x-6 text-white/90 text-sm md:text-base">
              <div className="flex items-center">
                <MapPin className="h-5 w-5 mr-2" />
                <span>{destination.location}</span>
              </div>
              <div className="flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                <span>Best Time: {destination.bestTime}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {/* Description */}
        <ScrollAnimation className="mb-12">
          <p className="text-lg md:text-xl text-gray-700 leading-relaxed max-w-4xl">
            {destination.description}
          </p>
        </ScrollAnimation>

        {/* Culture Section */}
        <ScrollAnimation className="mb-12">
          <div className="bg-white rounded-2xl border-2 border-purple-100 shadow-xl p-8 md:p-10">
            <h2 className="text-3xl md:text-4xl font-light text-gray-900 mb-6 tracking-tight">
              {destination.culture.title}
            </h2>
            <p className="text-base md:text-lg text-gray-700 mb-6 leading-relaxed">
              {destination.culture.description}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {destination.culture.highlights.map((highlight, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-purple-600 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-gray-700 leading-relaxed">{highlight}</p>
                </div>
              ))}
            </div>
          </div>
        </ScrollAnimation>

        {/* Best Things to Do */}
        <ScrollAnimation className="mb-12">
          <h2 className="text-3xl md:text-4xl font-light text-gray-900 mb-8 tracking-tight">
            {destination.bestThings.title}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {destination.bestThings.items.map((item, index) => {
              const Icon = item.icon;
              return (
                <div
                  key={index}
                  className="bg-white rounded-xl border-2 border-purple-100 p-6 hover:border-purple-300 hover:shadow-lg transition-all group"
                >
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-purple-200 transition-colors">
                    <Icon className="h-6 w-6 text-purple-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.name}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{item.description}</p>
                </div>
              );
            })}
          </div>
        </ScrollAnimation>

        {/* Gallery */}
        {destination.gallery && destination.gallery.length > 0 && (
          <ScrollAnimation className="mb-12">
            <h2 className="text-3xl md:text-4xl font-light text-gray-900 mb-8 tracking-tight">
              Photo Gallery
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {destination.gallery.map((image, index) => (
                <div
                  key={index}
                  className="relative h-64 rounded-xl overflow-hidden group cursor-pointer"
                >
                  <img
                    src={image}
                    alt={`${destination.name} ${index + 1}`}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>
              ))}
            </div>
          </ScrollAnimation>
        )}

        {/* Tips and Nearby */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          <ScrollAnimation>
            <div className="bg-white rounded-2xl border-2 border-purple-100 shadow-xl p-8">
              <h2 className="text-2xl md:text-3xl font-light text-gray-900 mb-6 tracking-tight">
                Travel Tips
              </h2>
              <div className="space-y-3">
                {destination.tips.map((tip, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <Star className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                    <p className="text-gray-700 leading-relaxed">{tip}</p>
                  </div>
                ))}
              </div>
            </div>
          </ScrollAnimation>

          <ScrollAnimation>
            <div className="bg-white rounded-2xl border-2 border-purple-100 shadow-xl p-8">
              <h2 className="text-2xl md:text-3xl font-light text-gray-900 mb-6 tracking-tight">
                Nearby Destinations
              </h2>
              <div className="space-y-3">
                {destination.nearbyDestinations.map((dest, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <MapPin className="h-5 w-5 text-purple-600" />
                      <span className="text-gray-900 font-medium">{dest}</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-purple-600 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </div>
                ))}
              </div>
            </div>
          </ScrollAnimation>
        </div>

        {/* CTA Section */}
        <ScrollAnimation>
          <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-2xl p-8 md:p-12 text-center">
            <h2 className="text-2xl md:text-3xl font-light text-white mb-4 tracking-tight">
              Ready to Explore {destination.name}?
            </h2>
            <p className="text-white/90 mb-8 max-w-2xl mx-auto">
              Join our curated trips to {destination.name} and experience the best of this amazing destination
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/trips"
                className="px-8 py-3 bg-white text-purple-600 rounded-xl font-semibold hover:bg-purple-50 transition-all shadow-lg hover:shadow-xl inline-flex items-center justify-center space-x-2"
              >
                <span>View Available Trips</span>
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/auth/signup"
                className="px-8 py-3 bg-purple-800 text-white rounded-xl font-semibold hover:bg-purple-900 transition-all border-2 border-white/20 inline-flex items-center justify-center space-x-2"
              >
                <span>Join Our Community</span>
                <Users className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </ScrollAnimation>
      </div>
    </div>
  );
}

