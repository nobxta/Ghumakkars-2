'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MapPin, Camera, Utensils, Mountain, Waves, Sunrise, Calendar, Users, Star, ArrowRight, Heart, Share2, Plane, TrendingUp, Clock, Check, Snowflake, Sun, CloudRain, ChevronDown } from 'lucide-react';
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
  // Optional rich article content (only some destinations have it)
  intro?: string[];
  whyVisit?: { text: string; highlights: string[] };
  topPlaces?: { name: string; description: string; image?: string }[];
  adventure?: { text: string; activities: string[]; treks?: string[] };
  food?: { text: string; dishes: string[] };
  seasons?: { name: string; months: string; points: string[] }[];
  faqs?: { q: string; a: string }[];
  altitude?: string;
  nearestAirport?: string;
  idealDuration?: string;
}> = {
  'manali': {
    name: 'Manali',
    slug: 'manali',
    image: 'https://d2rdhxfof4qmbb.cloudfront.net/wp-content/uploads/2024/09/Manali_City.jpg',
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
      'https://s7ap1.scene7.com/is/image/incredibleindia/hidimba-temple-manali-himachal-pradesh-1-musthead-hero?qlt=82&ts=1726730732148',
      'https://discoverkullumanali.in/wp-content/uploads/2020/11/Solang-valley-in-Manali-1089x530.jpg',
      'https://s7ap1.scene7.com/is/image/incredibleindia/rohtang-pass-manali-himachal-pradesh-1-attr-hero?qlt=82&ts=1726730701545',
      'https://apnayatra.com/wp-content/uploads/2025/03/Jogini-Waterfalls-Manali-3.jpg',
      'https://d2rdhxfof4qmbb.cloudfront.net/wp-content/uploads/2024/09/Manali_City.jpg'
    ],
    tips: [
      'Carry warm clothing throughout the year — even summer evenings get cold.',
      'Book hotels and activities early during peak season (May–June, Dec–Jan).',
      'Keep valid ID proof handy for permits and hotel check-ins.',
      'Stay hydrated when travelling to higher altitudes like Rohtang.',
      'Respect local customs and religious sites.',
      'Carry some cash when visiting remote areas — ATMs are limited.',
      'Check weather conditions before heading to Rohtang Pass.'
    ],
    nearbyDestinations: ['Solang Valley', 'Rohtang Pass', 'Sissu', 'Kasol', 'Tosh', 'Kullu', 'Naggar', 'Jibhi', 'Tirthan Valley'],
    altitude: '~2,050 m above sea level',
    nearestAirport: 'Bhuntar Airport (~50 km)',
    idealDuration: '4 to 6 days',
    intro: [
      "Nestled in the heart of the Himalayas, Manali is one of India's most loved hill stations and a dream destination for nature lovers, adventure seekers, honeymooners, and backpackers. Surrounded by snow-capped peaks, dense pine forests, flowing rivers, and picturesque valleys, it's the perfect escape from busy city life.",
      'Located in the Kullu district of Himachal Pradesh at roughly 2,050 metres above sea level, Manali is the gateway to iconic spots like Rohtang Pass, Solang Valley, Sissu, Atal Tunnel, and Leh-Ladakh. Whether you want thrilling adventure sports, peaceful mountain views, vibrant local culture, or a relaxed family holiday, Manali has something for everyone.'
    ],
    whyVisit: {
      text: 'Manali combines breathtaking natural beauty with exciting outdoor experiences. From snow-covered landscapes in winter to lush green valleys in summer, every season offers a completely different charm.',
      highlights: [
        'Stunning Himalayan mountain views',
        'Famous Solang Valley adventure activities',
        'Scenic drives through Rohtang Pass and Atal Tunnel',
        'Ancient temples and cultural landmarks',
        'Riverside cafés and vibrant markets',
        'Snowfall experiences in winter',
        'Trekking routes for beginners and pros',
        'A romantic getaway for couples'
      ]
    },
    topPlaces: [
      { name: 'Hadimba Devi Temple', description: 'Built amidst towering cedar forests, this iconic temple is known for its unique wooden architecture and peaceful surroundings. A must-visit in Manali.', image: 'https://s7ap1.scene7.com/is/image/incredibleindia/hidimba-temple-manali-himachal-pradesh-1-musthead-hero?qlt=82&ts=1726730732148' },
      { name: 'Solang Valley', description: 'The adventure capital of Manali — paragliding, ziplining, ATV rides, skiing, snowboarding, and cable car experiences all in one stunning valley.', image: 'https://discoverkullumanali.in/wp-content/uploads/2020/11/Solang-valley-in-Manali-1089x530.jpg' },
      { name: 'Rohtang Pass', description: 'At over 13,000 feet, Rohtang offers breathtaking panoramic views of glaciers, mountains and valleys. One of the most popular day trips from Manali.', image: 'https://s7ap1.scene7.com/is/image/incredibleindia/rohtang-pass-manali-himachal-pradesh-1-attr-hero?qlt=82&ts=1726730701545' },
      { name: 'Jogini Waterfall', description: 'A scenic trek through pine forests and local villages leads to this beautiful waterfall — perfect for photography and nature lovers.', image: 'https://apnayatra.com/wp-content/uploads/2025/03/Jogini-Waterfalls-Manali-3.jpg' },
      { name: 'Old Manali', description: 'Famous for its relaxed atmosphere, charming cafés, live music venues and backpacker culture — a completely different vibe from the main town.' },
      { name: 'Manu Temple', description: 'Dedicated to Sage Manu, this historic temple is an important cultural and spiritual landmark set in the quiet surroundings of Old Manali.' }
    ],
    adventure: {
      text: "Manali is one of India's leading adventure tourism destinations, with activities for every thrill level.",
      activities: [
        'Paragliding in Solang Valley',
        'River rafting on the Beas River',
        'Skiing and snowboarding in winter',
        'Mountain biking trails',
        'Ziplining and rope activities',
        'ATV rides',
        'Camping under the stars',
        'Himalayan trekking expeditions'
      ],
      treks: ['Hampta Pass Trek', 'Bhrigu Lake Trek', 'Beas Kund Trek', 'Chandrakhani Pass Trek']
    },
    food: {
      text: 'A trip to Manali is incomplete without experiencing local Himachali cuisine. The cafés of Old Manali also serve a wide range of international dishes.',
      dishes: ['Himachali Dham', 'Sidu', 'Babru', 'Trout Fish', 'Madra', 'Chha Gosht', 'Local apple cider & apple products', 'Fresh mountain honey']
    },
    seasons: [
      { name: 'Summer', months: 'March to June', points: ['Pleasant weather', 'Ideal for sightseeing', 'Peak adventure-sports season', 'Perfect for family vacations'] },
      { name: 'Monsoon', months: 'July to September', points: ['Lush green landscapes', 'Fewer crowds', 'Occasional landslides & road disruptions'] },
      { name: 'Winter', months: 'October to February', points: ['Snowfall season', 'Skiing & snow activities', 'Romantic atmosphere for couples', 'Spectacular mountain views'] }
    ],
    faqs: [
      { q: 'Is Manali worth visiting?', a: "Yes. Manali is one of India's most scenic mountain destinations and offers a perfect mix of nature, adventure, culture and relaxation." },
      { q: 'How many days are enough for Manali?', a: 'A 4 to 6-day trip is ideal for exploring the major attractions and nearby destinations.' },
      { q: 'Does Manali receive snowfall?', a: 'Yes. Snowfall typically occurs between December and February.' },
      { q: 'Is Manali suitable for family trips?', a: 'Absolutely. Families, couples, solo travellers and groups all enjoy Manali’s diverse experiences.' },
      { q: 'What is the nearest airport to Manali?', a: 'Bhuntar Airport, around 50 km away, is the nearest airport.' }
    ]
  },
  'mussorie': {
    name: 'Mussoorie',
    slug: 'mussorie',
    image: 'https://hblimg.mmtcdn.com/content/hubble/img/destimg/mmt/destination/m_Mussorrie_main_tv_destination_img_1_l_639_958.jpg',
    description: 'Known as the "Queen of the Hills", Mussoorie is a charming hill station in Uttarakhand offering colonial architecture, beautiful waterfalls, and panoramic views of the Himalayan ranges.',
    location: 'Uttarakhand, India',
    bestTime: 'March to June, September to February',
    culture: {
      title: 'Colonial & Himalayan Heritage',
      description: "Mussoorie's culture is influenced by Garhwali traditions, colonial history, and modern tourism. The town's heritage buildings, churches, old libraries, and local markets reflect its rich significance as a British-era hill station.",
      highlights: [
        'Traditional Garhwali hospitality',
        'Colonial-era architecture',
        'Local handicrafts and souvenirs',
        'Historic churches and heritage buildings',
        'Seasonal festivals and cultural events',
        'Traditional Uttarakhand cuisine'
      ]
    },
    bestThings: {
      title: 'Best Things to Do',
      items: [
        { icon: Camera, name: 'Scenic Viewpoints', description: 'Gun Hill, Lal Tibba, and Camel\'s Back Road for panoramic Himalayan views' },
        { icon: Mountain, name: 'Nature & Adventure', description: 'Ropeway rides, trekking trails, ziplining, and waterfall exploration' },
        { icon: Utensils, name: 'Cafés & Local Food', description: 'Garhwali thali, Bal Mithai, momos, and cosy Landour cafés' },
        { icon: Sunrise, name: 'Heritage Walks', description: 'Mall Road, colonial bungalows, old churches, and Landour\'s old-world charm' }
      ]
    },
    gallery: [
      'https://img.avianexperiences.com/attraction/68948e9d-be4b-4f88-8f61-e42de809c639',
      'https://s7ap1.scene7.com/is/image/incredibleindia/gun-hill-top-mussourie-uttarakhand-1-attr-hero?qlt=82&ts=1727352381893',
      'https://media.holidify.com/images/cmsuploads/compressed/uk-mussoorie-camels-back-road-01_20241205154031.jpg',
      'https://i0.wp.com/stampedmoments.com/wp-content/uploads/2025/07/landour-street.jpg?fit=1024%2C768&ssl=1',
      'https://mussoorietourism.co.in/images/tourist-places/company-garden-mussoorie/company-garden-mussoorie-tourism-holidays-closed-on-timings.jpg'
    ],
    tips: [
      'Carry warm clothing even during summer evenings.',
      'Wear comfortable walking shoes — there\'s a lot to explore on foot.',
      'Book hotels in advance during weekends and holidays.',
      'Start sightseeing early to avoid traffic congestion.',
      'Keep cash handy for local purchases.',
      'Respect local customs and environmental guidelines.',
      'Avoid peak hours around Mall Road and Kempty Falls.'
    ],
    nearbyDestinations: ['Landour', 'Dhanaulti', 'Dehradun', 'Kanatal', 'Chakrata', 'Tehri Lake', 'George Everest Peak', 'Surkanda Devi Temple'],
    altitude: '~2,000 m above sea level',
    nearestAirport: 'Jolly Grant, Dehradun (~60 km)',
    idealDuration: '2 to 3 days',
    intro: [
      'Popularly known as the "Queen of the Hills", Mussoorie is one of India\'s most iconic hill stations, nestled in the picturesque Garhwal Himalayas of Uttarakhand. Perched at around 2,000 metres above sea level, this charming mountain town offers breathtaking Himalayan views, colonial-era architecture, scenic walking trails, waterfalls, and a peaceful escape from city life.',
      'Located just a short drive from Dehradun, Mussoorie attracts honeymooners, families, solo travellers, photographers, and adventure enthusiasts all year round. Whether you want mist-covered mountains, vibrant cafés, nature walks, or stunning viewpoints, Mussoorie delivers an unforgettable Himalayan experience.'
    ],
    whyVisit: {
      text: 'Mussoorie perfectly blends natural beauty, colonial heritage, and modern tourism facilities — panoramic snow-capped peaks, lush green valleys, waterfalls, bustling markets, and charming cafés.',
      highlights: [
        'Spectacular Himalayan mountain views',
        'Famous Mall Road shopping and cafés',
        'Beautiful waterfalls and nature trails',
        'Colonial-era architecture and heritage sites',
        'Ropeway rides and scenic viewpoints',
        'A romantic getaway for couples',
        'Pleasant weather most of the year',
        'Easy access from Delhi and Dehradun'
      ]
    },
    topPlaces: [
      { name: 'Kempty Falls', description: 'One of Mussoorie\'s most famous attractions, surrounded by scenic hills and lush greenery. About 15 km from town, it\'s a favourite picnic spot for a refreshing mountain experience.', image: 'https://img.avianexperiences.com/attraction/68948e9d-be4b-4f88-8f61-e42de809c639' },
      { name: 'Gun Hill', description: 'The second-highest peak in Mussoorie, offering stunning panoramic views of the Garhwal Himalayas and Doon Valley. Reach the viewpoint via an exciting ropeway ride from Mall Road.', image: 'https://s7ap1.scene7.com/is/image/incredibleindia/gun-hill-top-mussourie-uttarakhand-1-attr-hero?qlt=82&ts=1727352381893' },
      { name: 'Lal Tibba', description: 'Located in Landour, Lal Tibba is the highest viewpoint in the region. On clear days you can see snow-covered Himalayan peaks through observation telescopes.', image: 'https://themanorhousehomestays.com/wp-content/uploads/2026/03/scscdw.png' },
      { name: 'Mall Road', description: 'The heart of Mussoorie — lined with cafés, restaurants, bakeries, and souvenir shops. Perfect for evening strolls, shopping, and soaking up the lively atmosphere.', image: 'https://img.avianexperiences.com/attractions/f7842913-c82c-4be2-b5d5-2841824f7d42' },
      { name: 'Camel\'s Back Road', description: 'Known for peaceful walking trails and spectacular sunset views, this serene route offers an escape from the crowds with stunning mountain vistas.', image: 'https://media.holidify.com/images/cmsuploads/compressed/uk-mussoorie-camels-back-road-01_20241205154031.jpg' },
      { name: 'Landour', description: 'A charming colonial town next to Mussoorie, famous for its peaceful atmosphere, heritage buildings, scenic cafés, and old-world charm.', image: 'https://i0.wp.com/stampedmoments.com/wp-content/uploads/2025/07/landour-street.jpg?fit=1024%2C768&ssl=1' },
      { name: 'Company Garden', description: 'A beautifully maintained garden with colourful flowers, boating, and recreational activities — a popular spot for families.', image: 'https://mussoorietourism.co.in/images/tourist-places/company-garden-mussoorie/company-garden-mussoorie-tourism-holidays-closed-on-timings.jpg' }
    ],
    adventure: {
      text: 'Mussoorie offers plenty of outdoor activities for adventure lovers and nature enthusiasts, plus excellent nature walks and birdwatching in the surrounding hills.',
      activities: [
        'Ropeway ride to Gun Hill',
        'Trekking and hiking trails',
        'Ziplining and adventure activities',
        'Nature photography',
        'Mountain biking',
        'Camping experiences',
        'Horse riding',
        'Waterfall exploration'
      ]
    },
    food: {
      text: 'A visit to Mussoorie is incomplete without exploring its food culture. The cafés of Mussoorie and Landour are especially loved for their scenic views and cosy atmosphere.',
      dishes: ['Garhwali Thali', 'Kafuli', 'Aloo Ke Gutke', 'Chainsoo', 'Bal Mithai', 'Momos & Tibetan food', 'Fresh bakery products', 'Local mountain tea']
    },
    seasons: [
      { name: 'Summer', months: 'March to June', points: ['Pleasant weather', 'Ideal for sightseeing', 'Great for family vacations', 'Adventure activities in full swing'] },
      { name: 'Monsoon', months: 'July to September', points: ['Lush green landscapes', 'Beautiful cloud-covered mountains', 'Fewer crowds', 'Occasional road disruptions'] },
      { name: 'Winter', months: 'October to February', points: ['Cold temperatures', 'Chance of snowfall', 'Romantic atmosphere', 'Clear Himalayan views'] }
    ],
    faqs: [
      { q: 'Why is Mussoorie called the Queen of the Hills?', a: 'Mussoorie earned the title for its stunning mountain scenery, pleasant climate, colonial charm, and popularity as one of India\'s most beautiful hill stations.' },
      { q: 'Is 2 days enough for Mussoorie?', a: 'Yes. A 2 to 3-day trip is enough to cover major attractions like Mall Road, Gun Hill, Kempty Falls, Landour, and Lal Tibba.' },
      { q: 'Does Mussoorie receive snowfall?', a: 'Yes. Snowfall usually occurs during December and January, drawing visitors from across India.' },
      { q: 'Is Mussoorie suitable for family trips?', a: 'Absolutely. Mussoorie has family-friendly attractions, scenic viewpoints, gardens, waterfalls, and comfortable stays.' },
      { q: 'What is the nearest airport and railway station?', a: 'The nearest airport is Jolly Grant Airport in Dehradun, and Dehradun Railway Station is the nearest major railhead.' }
    ]
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
      {/* FAQ structured data for Google rich results */}
      {destination.faqs && destination.faqs.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: destination.faqs.map((f) => ({
                '@type': 'Question',
                name: f.q,
                acceptedAnswer: { '@type': 'Answer', text: f.a },
              })),
            }),
          }}
        />
      )}
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
        {/* Description / Intro */}
        <ScrollAnimation className="mb-10">
          {destination.intro ? (
            <div className="max-w-4xl space-y-4">
              {destination.intro.map((para, i) => (
                <p key={i} className="text-lg md:text-xl text-gray-700 leading-relaxed">{para}</p>
              ))}
            </div>
          ) : (
            <p className="text-lg md:text-xl text-gray-700 leading-relaxed max-w-4xl">
              {destination.description}
            </p>
          )}
        </ScrollAnimation>

        {/* Quick facts strip */}
        {(destination.altitude || destination.nearestAirport || destination.idealDuration) && (
          <ScrollAnimation className="mb-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white rounded-2xl border border-purple-100 p-4 shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center mb-2"><Calendar className="h-5 w-5 text-purple-600" /></div>
                <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">Best time</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{destination.bestTime}</p>
              </div>
              {destination.altitude && (
                <div className="bg-white rounded-2xl border border-purple-100 p-4 shadow-sm">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center mb-2"><TrendingUp className="h-5 w-5 text-blue-600" /></div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">Altitude</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{destination.altitude}</p>
                </div>
              )}
              {destination.idealDuration && (
                <div className="bg-white rounded-2xl border border-purple-100 p-4 shadow-sm">
                  <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center mb-2"><Clock className="h-5 w-5 text-green-600" /></div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">Ideal trip</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{destination.idealDuration}</p>
                </div>
              )}
              {destination.nearestAirport && (
                <div className="bg-white rounded-2xl border border-purple-100 p-4 shadow-sm">
                  <div className="w-9 h-9 rounded-xl bg-fuchsia-100 flex items-center justify-center mb-2"><Plane className="h-5 w-5 text-fuchsia-600" /></div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">Nearest airport</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{destination.nearestAirport}</p>
                </div>
              )}
            </div>
          </ScrollAnimation>
        )}

        {/* Why Visit */}
        {destination.whyVisit && (
          <ScrollAnimation className="mb-12">
            <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50 rounded-2xl border border-purple-100 p-8 md:p-10">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3 tracking-tight">Why visit {destination.name}?</h2>
              <p className="text-base md:text-lg text-gray-700 mb-6 leading-relaxed max-w-3xl">{destination.whyVisit.text}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {destination.whyVisit.highlights.map((h, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5"><Check className="h-3 w-3 text-white" /></div>
                    <p className="text-gray-800">{h}</p>
                  </div>
                ))}
              </div>
            </div>
          </ScrollAnimation>
        )}

        {/* Top Places to Visit */}
        {destination.topPlaces && destination.topPlaces.length > 0 && (
          <ScrollAnimation className="mb-12">
            <h2 className="text-3xl md:text-4xl font-light text-gray-900 mb-8 tracking-tight">Top places to visit</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {destination.topPlaces.map((place, i) => (
                <div key={i} className="bg-white rounded-2xl border border-purple-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all group">
                  {place.image && (
                    <div className="h-48 overflow-hidden">
                      <img src={place.image} alt={place.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    </div>
                  )}
                  <div className="p-5 sm:p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-1.5 flex items-center gap-2"><MapPin className="h-4 w-4 text-purple-600 flex-shrink-0" />{place.name}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{place.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollAnimation>
        )}

        {/* Adventure activities */}
        {destination.adventure && (
          <ScrollAnimation className="mb-12">
            <div className="bg-white rounded-2xl border-2 border-purple-100 shadow-xl p-8 md:p-10">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center"><Mountain className="h-5 w-5 text-orange-600" /></div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">Adventure activities</h2>
              </div>
              <p className="text-base text-gray-700 mb-6 leading-relaxed max-w-3xl">{destination.adventure.text}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-6">
                {destination.adventure.activities.map((a, i) => (
                  <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0"></div>
                    <span className="text-sm text-gray-800">{a}</span>
                  </div>
                ))}
              </div>
              {destination.adventure.treks && destination.adventure.treks.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-2">Popular treks</p>
                  <div className="flex flex-wrap gap-2">
                    {destination.adventure.treks.map((t, i) => (
                      <span key={i} className="px-3 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-orange-800 text-sm font-semibold">{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollAnimation>
        )}

        {/* Food */}
        {destination.food && (
          <ScrollAnimation className="mb-12">
            <div className="bg-white rounded-2xl border-2 border-purple-100 shadow-xl p-8 md:p-10">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center"><Utensils className="h-5 w-5 text-amber-600" /></div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">Food to try</h2>
              </div>
              <p className="text-base text-gray-700 mb-6 leading-relaxed max-w-3xl">{destination.food.text}</p>
              <div className="flex flex-wrap gap-2">
                {destination.food.dishes.map((d, i) => (
                  <span key={i} className="px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-sm font-semibold">{d}</span>
                ))}
              </div>
            </div>
          </ScrollAnimation>
        )}

        {/* Seasons */}
        {destination.seasons && destination.seasons.length > 0 && (
          <ScrollAnimation className="mb-12">
            <h2 className="text-3xl md:text-4xl font-light text-gray-900 mb-8 tracking-tight">Best time to visit</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {destination.seasons.map((s, i) => {
                const Icon = s.name === 'Winter' ? Snowflake : s.name === 'Monsoon' ? CloudRain : Sun;
                const tone = s.name === 'Winter' ? 'blue' : s.name === 'Monsoon' ? 'green' : 'amber';
                return (
                  <div key={i} className="bg-white rounded-2xl border border-purple-100 p-6 shadow-sm">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${tone === 'blue' ? 'bg-blue-100' : tone === 'green' ? 'bg-green-100' : 'bg-amber-100'}`}>
                      <Icon className={`h-6 w-6 ${tone === 'blue' ? 'text-blue-600' : tone === 'green' ? 'text-green-600' : 'text-amber-600'}`} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">{s.name}</h3>
                    <p className="text-xs text-gray-500 mb-3">{s.months}</p>
                    <ul className="space-y-1.5">
                      {s.points.map((p, j) => (
                        <li key={j} className="text-sm text-gray-700 flex items-start gap-2"><Check className="h-3.5 w-3.5 text-purple-500 mt-0.5 flex-shrink-0" />{p}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </ScrollAnimation>
        )}

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

        {/* FAQ */}
        {destination.faqs && destination.faqs.length > 0 && (
          <ScrollAnimation className="mb-12">
            <h2 className="text-3xl md:text-4xl font-light text-gray-900 mb-8 tracking-tight">Frequently asked questions</h2>
            <div className="space-y-3 max-w-3xl">
              {destination.faqs.map((f, i) => (
                <details key={i} className="group bg-white rounded-2xl border border-purple-100 overflow-hidden">
                  <summary className="flex items-center justify-between gap-3 p-5 cursor-pointer list-none font-semibold text-gray-900 hover:bg-purple-50/50">
                    {f.q}
                    <ChevronDown className="h-5 w-5 text-purple-600 flex-shrink-0 group-open:rotate-180 transition-transform" />
                  </summary>
                  <div className="px-5 pb-5 text-gray-700 leading-relaxed">{f.a}</div>
                </details>
              ))}
            </div>
          </ScrollAnimation>
        )}

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

