import type { LucideIcon } from 'lucide-react';
import { Camera, Utensils, Mountain, Waves, Sunrise, Star, Snowflake } from 'lucide-react';

// Static content for the /destinations/[slug] guide pages.
//
// Images under /images/destinations/<slug>/ are self-hosted copies of freely
// licensed Wikimedia Commons photos — their authors and licences live in
// lib/photo-credits.ts and are shown at the bottom of each page. Any new
// Commons photo added here needs a matching credit entry.

export type Destination = {
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
    items: { icon: LucideIcon; name: string; description: string }[];
  };
  gallery: { src: string; alt: string }[];
  tips: string[];
  nearbyDestinations: string[];
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
};

const img = (slug: string, name: string) => `/images/destinations/${slug}/${name}.webp`;

export const destinationsData: Record<string, Destination> = {
  'manali': {
    name: 'Manali',
    slug: 'manali',
    image: 'https://d2rdhxfof4qmbb.cloudfront.net/wp-content/uploads/2024/09/Manali_City.jpg',
    description: 'Nestled in the Pir Panjal and Dhauladhar ranges of the Himalayas, Manali is a breathtaking hill station that offers stunning landscapes, adventure activities, and rich cultural experiences.',
    location: 'Kullu district, Himachal Pradesh',
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
        { icon: Mountain, name: 'Adventure Sports', description: 'Paragliding, skiing, river rafting, ziplining, and trekking in the Himalayas' },
        { icon: Camera, name: 'Scenic Views', description: 'Visit Rohtang Pass, Solang Valley, Hadimba Temple, and Jogini Falls' },
        { icon: Utensils, name: 'Local Cuisine', description: 'Try traditional dishes like Dham, Sidu, Trout fish, and local apple products' },
        { icon: Sunrise, name: 'Nature Experiences', description: 'Vashisht hot springs, apple orchards, pine forests, and mountain trekking' }
      ]
    },
    gallery: [
      { src: 'https://s7ap1.scene7.com/is/image/incredibleindia/hidimba-temple-manali-himachal-pradesh-1-musthead-hero?qlt=82&ts=1726730732148', alt: 'Hadimba Devi Temple, Manali' },
      { src: 'https://discoverkullumanali.in/wp-content/uploads/2020/11/Solang-valley-in-Manali-1089x530.jpg', alt: 'Paragliding over Solang Valley' },
      { src: 'https://s7ap1.scene7.com/is/image/incredibleindia/rohtang-pass-manali-himachal-pradesh-1-attr-hero?qlt=82&ts=1726730701545', alt: 'Rohtang Pass' },
      { src: 'https://apnayatra.com/wp-content/uploads/2025/03/Jogini-Waterfalls-Manali-3.jpg', alt: 'Jogini Waterfall' },
      { src: 'https://d2rdhxfof4qmbb.cloudfront.net/wp-content/uploads/2024/09/Manali_City.jpg', alt: 'Manali town below snow-capped peaks' }
    ],
    tips: [
      'Carry warm clothing throughout the year — even summer evenings get cold.',
      'Book hotels and activities early during peak season (May–June, Dec–Jan).',
      'Rohtang Pass needs an online vehicle permit and is closed on Tuesdays and through winter — check before you go.',
      'Stay hydrated when travelling to higher altitudes like Rohtang.',
      'Respect local customs and religious sites.',
      'Carry some cash when visiting remote areas — ATMs are limited.',
      'Check weather and road conditions before heading up to Rohtang or through the Atal Tunnel.'
    ],
    nearbyDestinations: ['Solang Valley', 'Rohtang Pass', 'Sissu', 'Kasol', 'Kullu', 'Naggar', 'Jibhi', 'Tirthan Valley', 'Spiti'],
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
      { name: 'Hadimba Devi Temple', description: 'Built in 1553 amidst towering cedar forests, this iconic temple is known for its unique wooden pagoda-style architecture and peaceful surroundings. A must-visit in Manali.', image: 'https://s7ap1.scene7.com/is/image/incredibleindia/hidimba-temple-manali-himachal-pradesh-1-musthead-hero?qlt=82&ts=1726730732148' },
      { name: 'Solang Valley', description: 'The adventure capital of Manali — paragliding, ziplining, ATV rides, skiing, snowboarding, and ropeway rides all in one stunning valley.', image: 'https://discoverkullumanali.in/wp-content/uploads/2020/11/Solang-valley-in-Manali-1089x530.jpg' },
      { name: 'Rohtang Pass', description: 'At about 3,980 m (over 13,000 ft), Rohtang offers breathtaking panoramic views of glaciers, mountains and valleys. One of the most popular day trips from Manali (permit required).', image: 'https://s7ap1.scene7.com/is/image/incredibleindia/rohtang-pass-manali-himachal-pradesh-1-attr-hero?qlt=82&ts=1726730701545' },
      { name: 'Jogini Waterfall', description: 'A scenic trek from Vashisht village through pine forests and orchards leads to this beautiful waterfall — perfect for photography and nature lovers.', image: 'https://apnayatra.com/wp-content/uploads/2025/03/Jogini-Waterfalls-Manali-3.jpg' },
      { name: 'Old Manali', description: 'Famous for its relaxed atmosphere, charming cafés, live music venues and backpacker culture — a completely different vibe from the main town.' },
      { name: 'Vashisht Hot Springs', description: 'Natural sulphur hot-water baths beside the old Vashisht temple, a short drive or walk across the Beas from Manali.' },
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
      { q: 'What is the nearest airport to Manali?', a: 'Bhuntar Airport near Kullu, around 50 km away, is the nearest airport. Most travellers reach Manali by overnight bus from Delhi or Chandigarh.' }
    ]
  },
  'mussorie': {
    name: 'Mussoorie',
    slug: 'mussorie',
    image: 'https://hblimg.mmtcdn.com/content/hubble/img/destimg/mmt/destination/m_Mussorrie_main_tv_destination_img_1_l_639_958.jpg',
    description: 'Known as the "Queen of the Hills", Mussoorie is a charming hill station in Uttarakhand offering colonial architecture, beautiful waterfalls, and panoramic views of the Himalayan ranges.',
    location: 'Dehradun district, Uttarakhand',
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
        { icon: Camera, name: 'Scenic Viewpoints', description: 'Gun Hill, Lal Tibba, and Camel’s Back Road for panoramic Himalayan views' },
        { icon: Mountain, name: 'Nature & Adventure', description: 'Ropeway rides, trekking trails, ziplining, and waterfall exploration' },
        { icon: Utensils, name: 'Cafés & Local Food', description: 'Garhwali thali, Bal Mithai, momos, and cosy Landour cafés' },
        { icon: Sunrise, name: 'Heritage Walks', description: 'Mall Road, colonial bungalows, old churches, and Landour’s old-world charm' }
      ]
    },
    gallery: [
      { src: 'https://img.avianexperiences.com/attraction/68948e9d-be4b-4f88-8f61-e42de809c639', alt: 'Kempty Falls' },
      { src: 'https://s7ap1.scene7.com/is/image/incredibleindia/gun-hill-top-mussourie-uttarakhand-1-attr-hero?qlt=82&ts=1727352381893', alt: 'View from Gun Hill' },
      { src: 'https://media.holidify.com/images/cmsuploads/compressed/uk-mussoorie-camels-back-road-01_20241205154031.jpg', alt: 'Camel rock on Camel’s Back Road' },
      { src: 'https://i0.wp.com/stampedmoments.com/wp-content/uploads/2025/07/landour-street.jpg?fit=1024%2C768&ssl=1', alt: 'A misty street in Landour' },
      { src: 'https://mussoorietourism.co.in/images/tourist-places/company-garden-mussoorie/company-garden-mussoorie-tourism-holidays-closed-on-timings.jpg', alt: 'Company Garden' }
    ],
    tips: [
      'Carry warm clothing even during summer evenings.',
      'Wear comfortable walking shoes — there’s a lot to explore on foot.',
      'Book hotels in advance during weekends and holidays.',
      'Start sightseeing early to avoid traffic congestion.',
      'Keep cash handy for local purchases.',
      'Respect local customs and environmental guidelines.',
      'Avoid peak hours around Mall Road and Kempty Falls.'
    ],
    nearbyDestinations: ['Landour', 'Dhanaulti', 'Dehradun', 'Kanatal', 'Chakrata', 'Tehri Lake', 'George Everest Peak', 'Surkanda Devi Temple', 'Rishikesh'],
    altitude: '~2,000 m above sea level',
    nearestAirport: 'Jolly Grant, Dehradun (~60 km)',
    idealDuration: '2 to 3 days',
    intro: [
      'Popularly known as the "Queen of the Hills", Mussoorie is one of India’s most iconic hill stations, nestled in the picturesque Garhwal Himalayas of Uttarakhand. Perched at around 2,000 metres above sea level, this charming mountain town offers breathtaking Himalayan views, colonial-era architecture, scenic walking trails, waterfalls, and a peaceful escape from city life.',
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
      { name: 'Kempty Falls', description: 'One of Mussoorie’s most famous attractions, surrounded by scenic hills and lush greenery. About 15 km from town, it’s a favourite picnic spot for a refreshing mountain experience.', image: 'https://img.avianexperiences.com/attraction/68948e9d-be4b-4f88-8f61-e42de809c639' },
      { name: 'Gun Hill', description: 'The second-highest peak in Mussoorie, offering stunning panoramic views of the Garhwal Himalayas and Doon Valley. Reach the viewpoint via an exciting ropeway ride from Mall Road.', image: 'https://s7ap1.scene7.com/is/image/incredibleindia/gun-hill-top-mussourie-uttarakhand-1-attr-hero?qlt=82&ts=1727352381893' },
      { name: 'Lal Tibba', description: 'Located in Landour, Lal Tibba is the highest viewpoint in the region. On clear days you can see snow-covered Himalayan peaks through observation telescopes.', image: 'https://themanorhousehomestays.com/wp-content/uploads/2026/03/scscdw.png' },
      { name: 'Mall Road', description: 'The heart of Mussoorie — lined with cafés, restaurants, bakeries, and souvenir shops. Perfect for evening strolls, shopping, and soaking up the lively atmosphere.', image: 'https://img.avianexperiences.com/attractions/f7842913-c82c-4be2-b5d5-2841824f7d42' },
      { name: 'Camel’s Back Road', description: 'Named after a rock formation shaped like a camel’s hump, this peaceful 3 km walking road offers spectacular sunset views away from the crowds.', image: 'https://media.holidify.com/images/cmsuploads/compressed/uk-mussoorie-camels-back-road-01_20241205154031.jpg' },
      { name: 'Landour', description: 'A charming colonial cantonment just above Mussoorie, famous for its peaceful atmosphere, heritage buildings, scenic cafés, and old-world charm.', image: 'https://i0.wp.com/stampedmoments.com/wp-content/uploads/2025/07/landour-street.jpg?fit=1024%2C768&ssl=1' },
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
      { q: 'Why is Mussoorie called the Queen of the Hills?', a: 'Mussoorie earned the title for its stunning mountain scenery, pleasant climate, colonial charm, and popularity as one of India’s most beautiful hill stations.' },
      { q: 'Is 2 days enough for Mussoorie?', a: 'Yes. A 2 to 3-day trip is enough to cover major attractions like Mall Road, Gun Hill, Kempty Falls, Landour, and Lal Tibba.' },
      { q: 'Does Mussoorie receive snowfall?', a: 'Yes. Light snowfall usually occurs in late December to February, though it varies from year to year.' },
      { q: 'Is Mussoorie suitable for family trips?', a: 'Absolutely. Mussoorie has family-friendly attractions, scenic viewpoints, gardens, waterfalls, and comfortable stays.' },
      { q: 'What is the nearest airport and railway station?', a: 'The nearest airport is Jolly Grant Airport in Dehradun, and Dehradun Railway Station (about 35 km away) is the nearest major railhead.' }
    ]
  },
  'kasol': {
    name: 'Kasol',
    slug: 'kasol',
    image: 'https://indotoursadventures.com/public/storage/blogs/165dec86f3683b83a19a09d0345dd8e2.jpg?w=800&h=600&fit=crop',
    description: 'A riverside village in the Parvati Valley, Kasol is the base for some of Himachal’s best-loved treks — Kheerganga, Tosh and Malana — with pine forests, hot springs and a laid-back café culture.',
    location: 'Parvati Valley, Kullu district, Himachal Pradesh',
    bestTime: 'March to June, September to November',
    culture: {
      title: 'Backpacker Culture & Mountain Traditions',
      description: 'Kasol has long drawn backpackers from around the world — especially Israeli travellers, which is why it is nicknamed "Mini Israel". Around it, the villages of the Parvati Valley keep their traditional Himachali way of life, wooden houses and village deities.',
      highlights: [
        'Cafés serving Israeli and international food',
        'A relaxed backpacker and trekking community',
        'Traditional villages like Chalal, Tosh and Malana',
        'Manikaran Sahib — sacred to both Sikhs and Hindus',
        'Village deities and local temple fairs',
        'Wooden Kath-Kuni style houses'
      ]
    },
    bestThings: {
      title: 'Best Things to Do',
      items: [
        { icon: Mountain, name: 'Trekking', description: 'Kheerganga, Tosh, Malana, Grahan and the Sar Pass trek, which starts from Kasol' },
        { icon: Waves, name: 'Riverside Life', description: 'Walk the Parvati riverbank to Chalal and stay in riverside camps and cottages' },
        { icon: Utensils, name: 'Café Culture', description: 'Shakshuka, falafel, momos, wood-fired bakes and riverside cafés' },
        { icon: Sunrise, name: 'Hot Springs', description: 'Soak in the natural hot springs at Manikaran and at the top of the Kheerganga trek' }
      ]
    },
    gallery: [
      { src: img('kasol', 'kasol-bridge'), alt: 'Bridge over the Parvati River at Kasol' },
      { src: img('kasol', 'manikaran'), alt: 'Manikaran and the Parvati River' },
      { src: img('kasol', 'kheerganga'), alt: 'Hot-spring pool at Kheerganga' },
      { src: img('kasol', 'tosh'), alt: 'Tosh village with snow peaks behind' },
      { src: img('kasol', 'malana'), alt: 'Malana village on the hillside' },
      { src: img('kasol', 'rudra-nag-waterfall'), alt: 'Rudra Nag waterfall on the Kheerganga trail' }
    ],
    tips: [
      'Carry enough cash — ATMs in Kasol are few and often run out on weekends.',
      'Cannabis (charas) is illegal in India and police checks are common in the Parvati Valley — stay well clear of it.',
      'Do not swim in the Parvati River; its ice-cold water and strong currents are dangerous.',
      'In Malana, follow the village rules — visitors must not touch houses, temples or villagers.',
      'Start the Kheerganga trek early in the day and check the current rules on camping at the top.',
      'Mobile network is patchy beyond Kasol and Manikaran.'
    ],
    nearbyDestinations: ['Chalal', 'Manikaran', 'Tosh', 'Malana', 'Kheerganga', 'Barshaini', 'Kullu', 'Manali'],
    altitude: '~1,580 m above sea level',
    nearestAirport: 'Bhuntar Airport (~31 km)',
    idealDuration: '2 to 4 days',
    intro: [
      'Kasol sits on the banks of the Parvati River in Himachal’s Kullu district, surrounded by pine forests and steep valley walls. What started as a quiet village has become one of the most popular backpacker stops in India, loved for its riverside cafés, slow pace and easy access to the treks of the upper Parvati Valley.',
      'Most travellers reach Kasol by overnight bus from Delhi to Bhuntar, followed by a scenic 31 km drive up the valley. From here, Manikaran is just 4 km away, and the road continues to Barshaini — the starting point for treks to Kheerganga and Tosh.'
    ],
    whyVisit: {
      text: 'Kasol is the easiest way into the Parvati Valley — a place to slow down by the river, then set off on some of the most rewarding short treks in the Himalayas.',
      highlights: [
        'Riverside stays among pine forests',
        'Gateway to the Kheerganga trek and its hot spring',
        'Easy walks to Chalal and Manikaran',
        'Café culture with international food',
        'Village walks to Tosh, Malana and Grahan',
        'Great for budget travellers and groups'
      ]
    },
    topPlaces: [
      { name: 'Kasol & the Parvati River', description: 'Walk the main market, then follow the river through the pine forest. The bridges over the Parvati are the best spots to take in the valley.', image: img('kasol', 'kasol-bridge') },
      { name: 'Chalal', description: 'A small village across the footbridge from Kasol, reached by a pleasant 30-minute riverside walk. Quieter than Kasol, with homestays and cafés.', image: img('kasol', 'parvati-footbridge') },
      { name: 'Manikaran Sahib', description: 'Just 4 km from Kasol, this gurudwara and the neighbouring Shiva temple are built around natural hot springs. The langar is cooked using the spring’s hot water.', image: img('kasol', 'manikaran-sahib') },
      { name: 'Kheerganga', description: 'A trek of about 12 km from Barshaini through forests and villages ends at a meadow with a natural hot-spring pool and views across the valley.', image: img('kasol', 'kheerganga') },
      { name: 'Tosh', description: 'One of the last villages in the valley, a short climb from Barshaini, with wooden houses and close views of snow-covered peaks.', image: img('kasol', 'tosh') },
      { name: 'Malana', description: 'An ancient, isolated village with its own village council and strict customs. Visitors may walk through but must not touch homes or temples.', image: img('kasol', 'malana') }
    ],
    adventure: {
      text: 'The Parvati Valley is a trekker’s valley — short village walks, multi-day high passes and everything in between.',
      activities: [
        'Trekking to Kheerganga',
        'Village walks to Chalal, Grahan and Tosh',
        'Riverside camping',
        'Day trip to Manikaran’s hot springs',
        'Nature photography',
        'Multi-day high-altitude treks'
      ],
      treks: ['Kheerganga Trek', 'Sar Pass Trek', 'Grahan Village Trek', 'Malana Trek', 'Pin Parvati Pass (expert)']
    },
    food: {
      text: 'Kasol’s cafés serve an unusually wide menu for a mountain village, from Israeli breakfasts to Tibetan and Himachali food.',
      dishes: ['Shakshuka', 'Falafel & hummus with pita', 'Momos', 'Thukpa', 'Himachali Siddu', 'Fresh river trout', 'Langar at Manikaran Sahib']
    },
    seasons: [
      { name: 'Summer', months: 'March to June', points: ['Pleasant days and cool nights', 'Best time for treks and camping', 'Busy season — book stays early'] },
      { name: 'Monsoon', months: 'July to August', points: ['Heavy rain and a swollen river', 'Landslides can block the valley road', 'Treks are slippery — not recommended'] },
      { name: 'Winter', months: 'November to February', points: ['Cold, with snow in upper villages like Tosh', 'Fewer travellers and lower prices', 'Many cafés and camps close'] }
    ],
    faqs: [
      { q: 'How do I reach Kasol?', a: 'Take an overnight bus from Delhi to Bhuntar (about 12–14 hours), then a local bus or taxi for the last 31 km. The nearest airport is Bhuntar.' },
      { q: 'How long is the Kheerganga trek?', a: 'About 12 km one way from Barshaini. Most people take 4 to 6 hours to walk up.' },
      { q: 'How many days do I need for Kasol?', a: 'Two to four days lets you explore Kasol, Chalal and Manikaran and do the Kheerganga trek.' },
      { q: 'Is Kasol safe for solo travellers?', a: 'Yes, it is popular with solo travellers. Use normal precautions, avoid trekking alone after dark and stay away from drugs, which are illegal.' },
      { q: 'Why is Kasol called Mini Israel?', a: 'Because of the large number of Israeli travellers who visit — many cafés and signboards here even use Hebrew.' }
    ]
  },
  'rishikesh': {
    name: 'Rishikesh',
    slug: 'rishikesh',
    image: 'https://s7ap1.scene7.com/is/image/incredibleindia/1-triveni-ghat-rishikesh-uttarakhand-2-city-hero?',
    description: 'The "Yoga Capital of the World", Rishikesh is a spiritual hub on the banks of the Ganga at the foothills of the Himalayas, known for yoga, the evening Ganga Aarti, white-water rafting and ancient temples.',
    location: 'Dehradun district, Uttarakhand',
    bestTime: 'September to November, February to May',
    culture: {
      title: 'Spiritual & Adventure Culture',
      description: 'Rishikesh is a unique blend of ancient spirituality and modern adventure tourism. It is a centre for yoga, meditation and Hindu philosophy, while also drawing rafters and adventure lovers from around the world.',
      highlights: [
        'Yoga schools, ashrams and meditation centres',
        'Evening Ganga Aarti at Triveni Ghat and Parmarth Niketan',
        'Ancient temples along the Ganga',
        'A vegetarian, alcohol-free town',
        'International Yoga Festival every March',
        'The Beatles’ 1968 stay at Maharishi Mahesh Yogi’s ashram'
      ]
    },
    bestThings: {
      title: 'Best Things to Do',
      items: [
        { icon: Sunrise, name: 'Spiritual Experiences', description: 'Yoga classes, meditation, Ganga Aarti, temple visits, and ashram stays' },
        { icon: Waves, name: 'River Rafting', description: 'Rapids on the Ganga from Shivpuri, Marine Drive or Kaudiyala' },
        { icon: Mountain, name: 'Adventure Sports', description: 'Bungee jumping, giant swing, flying fox, kayaking and riverside camping' },
        { icon: Camera, name: 'Iconic Landmarks', description: 'Laxman Jhula, Ram Jhula, Triveni Ghat and the Beatles Ashram' }
      ]
    },
    gallery: [
      { src: img('rishikesh', 'laxman-jhula'), alt: 'Laxman Jhula and the Trayambakeshwar temple' },
      { src: img('rishikesh', 'ganga-ghats'), alt: 'Ghats along the Ganga at Laxman Jhula' },
      { src: img('rishikesh', 'triveni-ghat-aarti'), alt: 'Evening aarti at Triveni Ghat' },
      { src: img('rishikesh', 'ram-jhula'), alt: 'Ram Jhula across the Ganga' },
      { src: img('rishikesh', 'beatles-ashram'), alt: 'Beatles Ashram' },
      { src: img('rishikesh', 'rafting'), alt: 'River rafting on the Ganga' }
    ],
    tips: [
      'Alcohol and non-vegetarian food are banned within the city — eat at the many vegetarian cafés.',
      'Reach Triveni Ghat or Parmarth Niketan about 30 minutes early for a good spot at the evening aarti.',
      'Book rafting only with licensed operators; rafting is suspended during the monsoon (roughly July–August).',
      'The Ganga is fast and cold — swim only where it is permitted and safe.',
      'Dress modestly at temples, ghats and ashrams.',
      'Summer afternoons (May–June) get very hot — plan sightseeing for mornings and evenings.'
    ],
    nearbyDestinations: ['Haridwar', 'Shivpuri', 'Neelkanth Mahadev', 'Kunjapuri', 'Dehradun', 'Mussoorie', 'Devprayag'],
    altitude: '~370 m above sea level',
    nearestAirport: 'Jolly Grant, Dehradun (~20 km)',
    idealDuration: '2 to 3 days',
    intro: [
      'Rishikesh sits where the Ganga leaves the Himalayan foothills and enters the plains. For centuries it has been a place of pilgrimage and meditation, and today it is known worldwide as the Yoga Capital of the World, with hundreds of ashrams and yoga schools lining both banks of the river.',
      'It is just as famous for adventure. The rapids upstream of town make it India’s most popular white-water rafting destination, and the hills around it hold waterfalls, temples and viewpoints. Rishikesh is about 6 hours from Delhi by road and 25 km from Haridwar.'
    ],
    whyVisit: {
      text: 'Few places combine peace and thrill the way Rishikesh does — a sunrise yoga class, an afternoon on the rapids and an evening aarti by the river, all in one day.',
      highlights: [
        'Yoga and meditation with experienced teachers',
        'The moving evening Ganga Aarti',
        'Some of India’s best white-water rafting',
        'Riverside camping at Shivpuri',
        'The Beatles Ashram and its murals',
        'Easy weekend trip from Delhi'
      ]
    },
    topPlaces: [
      { name: 'Laxman Jhula', description: 'The iconic iron suspension bridge, built in 1929, with the 13-storey Trayambakeshwar temple beside it. The bridge has been closed to traffic since 2020 for safety reasons, but the riverside area is still the heart of Rishikesh.', image: img('rishikesh', 'laxman-jhula') },
      { name: 'Ram Jhula', description: 'A suspension bridge a little downstream that links the town to the ashrams of Swargashram, with great views of the river.', image: img('rishikesh', 'ram-jhula') },
      { name: 'Triveni Ghat', description: 'The busiest ghat in Rishikesh, where pilgrims bathe in the Ganga and a grand aarti with fire lamps is held every evening.', image: img('rishikesh', 'triveni-ghat-aarti') },
      { name: 'Beatles Ashram (Chaurasi Kutia)', description: 'The former ashram of Maharishi Mahesh Yogi, where the Beatles stayed in 1968. Its meditation huts and walls are now covered with murals. It lies within Rajaji National Park and has an entry fee.', image: img('rishikesh', 'beatles-ashram-hut') },
      { name: 'Shivpuri', description: 'About 16 km upstream, Shivpuri is the most popular starting point for rafting, with sandy beaches and riverside camps.', image: img('rishikesh', 'shivpuri') },
      { name: 'Kunjapuri Devi Temple', description: 'A hilltop temple about 25 km away, known for its sunrise views of the Garhwal Himalayas.' },
      { name: 'Neelkanth Mahadev Temple', description: 'An important Shiva temple in the forested hills about 30 km by road from Rishikesh, visited by huge crowds during the Shravan month.' },
      { name: 'Parmarth Niketan', description: 'One of the largest ashrams in Rishikesh, known for its sunset Ganga Aarti and as the host of the annual International Yoga Festival.' }
    ],
    adventure: {
      text: 'Rishikesh is India’s adventure-sports hub for river and air activities. The rafting season runs roughly from September to June.',
      activities: [
        'White-water rafting on the Ganga',
        'Bungee jumping from an 83 m platform at Mohan Chatti',
        'Giant swing and flying fox',
        'Kayaking',
        'Riverside camping',
        'Cliff jumping on rafting trips',
        'Waterfall hikes'
      ],
      treks: ['Neer Garh Waterfall', 'Patna Waterfall', 'Kunjapuri Sunrise Hike', 'Jhilmil Gufa']
    },
    food: {
      text: 'Rishikesh is a vegetarian town, but its cafés serve everything from simple Indian breakfasts to healthy, international menus.',
      dishes: ['Aloo puri & kachori', 'Lassi', 'Sattvic thali', 'Ayurvedic meals', 'Israeli & Italian café food', 'Fresh fruit bowls', 'Masala chai']
    },
    seasons: [
      { name: 'Spring & Summer', months: 'February to June', points: ['Rafting season in full swing', 'International Yoga Festival in March', 'May and June can touch 40°C'] },
      { name: 'Monsoon', months: 'July to August', points: ['Rafting suspended', 'Green hills and full waterfalls', 'Kanwar Yatra crowds in July–August'] },
      { name: 'Winter', months: 'September to January', points: ['Pleasant days, cold nights', 'Rafting reopens from September', 'Best time for yoga retreats'] }
    ],
    faqs: [
      { q: 'What is the best time to visit Rishikesh?', a: 'September to November and February to May are best — pleasant weather and the rafting season is open.' },
      { q: 'When is rafting closed in Rishikesh?', a: 'Rafting is usually suspended during the monsoon, roughly from July to August, when the river is too high.' },
      { q: 'Where can I watch the Ganga Aarti?', a: 'Every evening at Triveni Ghat and at Parmarth Niketan near Ram Jhula, around sunset.' },
      { q: 'How far is Rishikesh from Delhi?', a: 'About 240 km — roughly 5 to 6 hours by road. Trains run to Haridwar and Yog Nagari Rishikesh.' },
      { q: 'Is alcohol allowed in Rishikesh?', a: 'No. Alcohol and non-vegetarian food are banned within the city limits.' }
    ]
  },
  'dalhousie': {
    name: 'Dalhousie',
    slug: 'dalhousie',
    image: '/images/destinations/dalhousie.webp',
    description: 'A colonial-era hill station spread over five hills in Himachal’s Chamba district, Dalhousie is known for old churches, deodar forests, the meadow of Khajjiar and views of the Dhauladhar range.',
    location: 'Chamba district, Himachal Pradesh',
    bestTime: 'March to June, September to November',
    culture: {
      title: 'Colonial & Mountain Culture',
      description: 'Founded by the British in 1854 and named after Lord Dalhousie, the town still has its Victorian churches, old bungalows and Mall Road. Rabindranath Tagore and Subhash Chandra Bose both spent time here. Around it, Chamba’s Himachali and Gaddi traditions live on.',
      highlights: [
        'British-era churches and bungalows',
        'St. John’s Church, built in 1863',
        'Subhash Baoli, linked to Netaji’s 1937 stay',
        'Gaddi shepherd culture of the Chamba region',
        'Tibetan market and handicrafts',
        'Chamba rumals and local woollens'
      ]
    },
    bestThings: {
      title: 'Best Things to Do',
      items: [
        { icon: Camera, name: 'Scenic Views', description: 'Khajjiar meadow, Dainkund Peak, Panchpula and Chamera Lake' },
        { icon: Mountain, name: 'Nature Walks', description: 'Deodar forest trails at Kalatop and the climb to Dainkund' },
        { icon: Utensils, name: 'Local Food', description: 'Chamba Madra, Chamba Chukh, Himachali Dham and Tibetan food' },
        { icon: Sunrise, name: 'Heritage Sites', description: 'St. John’s Church, St. Francis Church, Gandhi Chowk and Subhash Baoli' }
      ]
    },
    gallery: [
      { src: '/images/destinations/dalhousie.webp', alt: 'Colonial-era church and bell tower in Dalhousie' },
      { src: img('dalhousie', 'khajjiar'), alt: 'Khajjiar meadow and lake' },
      { src: img('dalhousie', 'dainkund'), alt: 'View from Dainkund Peak' },
      { src: img('dalhousie', 'st-johns-church'), alt: 'St. John’s Church' },
      { src: img('dalhousie', 'kalatop'), alt: 'Kalatop Wildlife Sanctuary' },
      { src: img('dalhousie', 'chamera-lake'), alt: 'Chamera Lake with the Pir Panjal behind' }
    ],
    tips: [
      'Dalhousie is a walking town — wear good shoes for the steep roads.',
      'Carry warm layers; evenings are cool even in summer and it snows in winter.',
      'Combine Khajjiar, Kalatop and Dainkund in one full-day trip.',
      'Pathankot is the nearest railway station — taxis and buses run up to Dalhousie.',
      'Roads can be blocked by snow from December to February; check before driving.'
    ],
    nearbyDestinations: ['Khajjiar', 'Kalatop', 'Dainkund Peak', 'Chamba', 'Chamera Lake', 'Dharamshala', 'McLeod Ganj'],
    altitude: '~1,970 m above sea level',
    nearestAirport: 'Pathankot (~75 km) or Kangra–Gaggal (~120 km)',
    idealDuration: '2 to 3 days',
    intro: [
      'Dalhousie was built by the British in the 1850s as a summer retreat and spreads across five hills at the western end of the Dhauladhar range. Its quiet roads, deodar forests and old stone churches make it one of the most peaceful hill stations in Himachal Pradesh.',
      'The town is a good base for some of the region’s most beautiful places — the meadow of Khajjiar, Kalatop forest, the viewpoint of Dainkund Peak and the old town of Chamba. Pathankot, about 80 km away, is the nearest railhead.'
    ],
    whyVisit: {
      text: 'Dalhousie is for travellers who want mountains without the crowds — slow walks, colonial charm and some of the greenest meadows in the Himalayas.',
      highlights: [
        'Khajjiar, one of India’s most beautiful meadows',
        'Wide views from Dainkund Peak',
        'Colonial churches and heritage walks',
        'Deodar forests of Kalatop',
        'Snowfall in winter',
        'Quieter than Shimla or Manali'
      ]
    },
    topPlaces: [
      { name: 'Khajjiar', description: 'About 22 km away, this saucer-shaped meadow with a small lake is ringed by deodar forest. Horse riding and zorbing are popular here.', image: img('dalhousie', 'khajjiar') },
      { name: 'Dainkund Peak', description: 'At about 2,755 m, the highest point near Dalhousie offers views across the Pir Panjal and Dhauladhar ranges. The Pohlani Mata temple sits near the top.', image: img('dalhousie', 'dainkund') },
      { name: 'St. John’s Church', description: 'Built in 1863 near Gandhi Chowk, it is the oldest church in Dalhousie, with stone walls and stained-glass windows.', image: img('dalhousie', 'st-johns-church') },
      { name: 'Kalatop Wildlife Sanctuary', description: 'Dense deodar and pine forest on the way to Khajjiar, with easy walking trails and a chance to spot Himalayan birds and wildlife.', image: img('dalhousie', 'kalatop') },
      { name: 'Chamera Lake', description: 'A reservoir on the Ravi River formed by the Chamera dam, with boating and wide valley views.', image: img('dalhousie', 'chamera-lake') },
      { name: 'Panchpula', description: 'A spot where five streams meet, with small waterfalls and the memorial of freedom fighter Sardar Ajit Singh.' },
      { name: 'Subhash Baoli', description: 'A natural spring in the forest where Netaji Subhash Chandra Bose spent time during his 1937 stay in Dalhousie.' }
    ],
    adventure: {
      text: 'Dalhousie is best explored on foot, with forest trails and gentle hikes all around.',
      activities: [
        'Hike to Dainkund Peak',
        'Forest walks in Kalatop',
        'Horse riding and zorbing at Khajjiar',
        'Boating at Chamera Lake',
        'Bird watching',
        'Snow walks in winter'
      ],
      treks: ['Dainkund Peak Hike', 'Kalatop–Khajjiar Trail', 'Bakrota Hills Walk']
    },
    food: {
      text: 'Chamba’s food is rich and distinct from the rest of Himachal — try it alongside the Tibetan food found around town.',
      dishes: ['Chamba Madra', 'Chamba Chukh (chilli sauce)', 'Himachali Dham', 'Babru', 'Momos & thukpa', 'Local honey and jams']
    },
    seasons: [
      { name: 'Summer', months: 'March to June', points: ['Pleasant weather', 'Best for sightseeing and Khajjiar', 'Peak season — book ahead'] },
      { name: 'Monsoon', months: 'July to August', points: ['Heavy rain and mist', 'Very green forests', 'Occasional landslides'] },
      { name: 'Winter', months: 'November to February', points: ['Cold with snowfall from December', 'Snow-covered Khajjiar and Dainkund', 'Some roads may close'] }
    ],
    faqs: [
      { q: 'How far is Khajjiar from Dalhousie?', a: 'About 22 km, or around an hour by road through the Kalatop forest.' },
      { q: 'Does Dalhousie get snowfall?', a: 'Yes. Snow usually falls between December and February.' },
      { q: 'How do I reach Dalhousie?', a: 'Pathankot is the nearest railway station (about 80 km) and has an airport. Kangra–Gaggal airport is about 120 km away.' },
      { q: 'How many days are enough for Dalhousie?', a: 'Two to three days covers the town, Khajjiar, Kalatop and Dainkund.' }
    ]
  },
  'spiti': {
    name: 'Spiti',
    slug: 'spiti',
    image: 'https://4cornersoftheworld.blog/wp-content/uploads/2020/08/920d8-1512812465_maxresdefault.jpg.jpg?w=800&h=600&fit=crop',
    description: 'A high-altitude cold desert in Himachal Pradesh, Spiti Valley is known for its thousand-year-old Buddhist monasteries, villages above 4,000 m, Chandratal Lake and some of the clearest night skies in India.',
    location: 'Lahaul & Spiti district, Himachal Pradesh',
    bestTime: 'May to October',
    culture: {
      title: 'Tibetan Buddhist Culture',
      description: 'Spiti shares its culture with Tibet — its monasteries, prayer flags, festivals and whitewashed mud-brick homes have been preserved for centuries. Tabo Monastery, founded in 996 CE, is one of the oldest continuously working Buddhist monasteries in the Himalayas.',
      highlights: [
        'Ancient gompas at Key, Tabo, Dhankar and Komic',
        'Murals and statues over 1,000 years old',
        'Prayer wheels, chortens and prayer flags',
        'Monastery festivals with masked Cham dances',
        'Traditional mud-brick village homes',
        'Homestays with Spitian families'
      ]
    },
    bestThings: {
      title: 'Best Things to Do',
      items: [
        { icon: Sunrise, name: 'Monastery Visits', description: 'Key, Tabo, Dhankar and Komic monasteries' },
        { icon: Camera, name: 'Stunning Landscapes', description: 'Chandratal Lake, Pin Valley, Kunzum Pass and the fossil village of Langza' },
        { icon: Mountain, name: 'High Villages', description: 'Kibber, Hikkim, Komic and Langza — all above 4,000 m' },
        { icon: Star, name: 'Stargazing', description: 'Clear, dry skies make Spiti one of the best places in India to see the Milky Way' }
      ]
    },
    gallery: [
      { src: img('spiti', 'key-monastery'), alt: 'Key Monastery above the Spiti River' },
      { src: img('spiti', 'chandratal'), alt: 'Chandratal Lake' },
      { src: img('spiti', 'dhankar'), alt: 'Dhankar Monastery on its cliff' },
      { src: img('spiti', 'tabo'), alt: 'Mud stupas at Tabo Monastery' },
      { src: img('spiti', 'langza'), alt: 'Buddha statue at Langza' },
      { src: img('spiti', 'kibber'), alt: 'Kibber village' }
    ],
    tips: [
      'Acclimatise slowly — spend a night at a lower altitude before Kaza and drink plenty of water.',
      'Indian citizens need no permit. Foreign nationals need an Inner Line Permit for the Kinnaur–Spiti stretch near the border.',
      'Mobile networks are limited — BSNL and Jio work best — and ATMs are few, so carry enough cash.',
      'Fill fuel in Kaza; there are very few petrol pumps in the valley.',
      'The Manali–Kaza road over Kunzum Pass is usually open only from about June to October.',
      'Carry sunscreen, sunglasses and warm layers — the sun is harsh and nights are cold even in summer.'
    ],
    nearbyDestinations: ['Kaza', 'Key', 'Kibber', 'Langza', 'Hikkim', 'Komic', 'Chandratal', 'Pin Valley', 'Manali'],
    altitude: 'Kaza ~3,800 m; villages up to ~4,500 m',
    nearestAirport: 'Bhuntar (~250 km to Kaza via Manali)',
    idealDuration: '7 to 10 days',
    intro: [
      'Spiti means "the middle land" — the land between Tibet and India. Its valley is a high-altitude cold desert of bare mountains, river plains and tiny villages, cut off by snow for much of the year. Kaza, at about 3,800 m, is its main town.',
      'There are two routes in: from Manali over the Atal Tunnel and Kunzum Pass (open roughly June to October), or from Shimla through Kinnaur, which stays open for most of the year. Doing a full circuit — in through one route, out through the other — is the classic Spiti road trip.'
    ],
    whyVisit: {
      text: 'Spiti feels like another world — ancient monasteries perched on cliffs, villages under endless skies and some of the most dramatic mountain roads in India.',
      highlights: [
        'Thousand-year-old monasteries',
        'Chandratal, the "Moon Lake"',
        'One of the world’s highest post offices at Hikkim',
        'Fossil hunting in Langza',
        'Snow leopard country around Kibber',
        'Unforgettable stargazing'
      ]
    },
    topPlaces: [
      { name: 'Key Monastery', description: 'The largest monastery in Spiti, about 12 km from Kaza, perched on a hill above the river at around 4,160 m. Its stacked white buildings are the valley’s most famous sight.', image: img('spiti', 'key-monastery') },
      { name: 'Chandratal Lake', description: 'A crescent-shaped lake at about 4,300 m, near Kunzum Pass, whose colour changes through the day. Camps are set up a short walk away from the lake.', image: img('spiti', 'chandratal') },
      { name: 'Dhankar Monastery', description: 'Built on a crumbling cliff above the meeting of the Spiti and Pin rivers. Dhankar was once the capital of Spiti, and a short hike leads to Dhankar Lake.', image: img('spiti', 'dhankar') },
      { name: 'Tabo Monastery', description: 'Founded in 996 CE, Tabo’s mud-walled halls hold some of the finest early Buddhist murals in the Himalayas.', image: img('spiti', 'tabo') },
      { name: 'Langza', description: 'A village at over 4,300 m, known for its large Buddha statue and for marine fossils found in the surrounding hills.', image: img('spiti', 'langza') },
      { name: 'Hikkim', description: 'Home to one of the highest post offices in the world, at about 4,400 m — send a postcard home from here.', image: img('spiti', 'hikkim') },
      { name: 'Kibber', description: 'One of the highest villages in the region connected by road, and the base for winter snow-leopard tracking tours.', image: img('spiti', 'kibber') },
      { name: 'Pin Valley', description: 'A national park known for snow leopards and Himalayan ibex. The village of Mudh sits at the end of the road.', image: img('spiti', 'pin-valley') },
      { name: 'Kunzum Pass', description: 'The 4,590 m pass between Lahaul and Spiti, marked by chortens and prayer flags around the Kunzum Mata temple.', image: img('spiti', 'kunzum-pass') }
    ],
    adventure: {
      text: 'Spiti is a destination for road-trippers, trekkers and anyone who loves wild, empty landscapes.',
      activities: [
        'The Spiti circuit road trip',
        'Monastery and village hikes',
        'Camping near Chandratal',
        'Snow-leopard tracking in winter (from Kibber)',
        'Fossil hunting at Langza',
        'Stargazing and night photography'
      ],
      treks: ['Pin Parvati Pass', 'Pin Bhaba Pass', 'Kanamo Peak', 'Dhankar Lake Hike']
    },
    food: {
      text: 'Spitian food is simple and warming, made for the cold — try it in homestays for the real taste.',
      dishes: ['Thukpa', 'Momos', 'Tingmo', 'Butter tea', 'Tsampa (roasted barley)', 'Sea buckthorn juice', 'Chhang (barley beer)']
    },
    seasons: [
      { name: 'Summer', months: 'May to June', points: ['Shimla route open; Manali route opens around June', 'Snow still on the high passes', 'Cold nights'] },
      { name: 'Monsoon', months: 'July to September', points: ['Spiti is in a rain shadow — dry and clear', 'Best time for the full circuit', 'Landslides possible on the Manali and Kinnaur roads'] },
      { name: 'Winter', months: 'November to April', points: ['Manali route closed; reach via Shimla–Kinnaur', 'Temperatures can drop to −20°C or below', 'Snow-leopard season'] }
    ],
    faqs: [
      { q: 'Do I need a permit for Spiti?', a: 'Indian citizens do not. Foreign nationals need an Inner Line Permit for the restricted stretch between Kinnaur and Spiti, available in Shimla, Rekong Peo or Kaza.' },
      { q: 'Which route is better — Manali or Shimla?', a: 'The Shimla route is gentler on acclimatisation and open most of the year. The Manali route is shorter and passes Chandratal, but is only open from about June to October.' },
      { q: 'How many days do I need for Spiti?', a: 'Seven to ten days for a full circuit with time to acclimatise.' },
      { q: 'Is altitude sickness a risk in Spiti?', a: 'Yes. Ascend gradually, rest on the first day, stay hydrated and descend if symptoms get worse.' }
    ]
  },
  'solang': {
    name: 'Solang Valley',
    slug: 'solang',
    image: img('solang', 'solang-snow'),
    description: 'Just 14 km from Manali, Solang Valley is the adventure playground of the Kullu region — paragliding and ropeway rides in summer, skiing and snow play in winter, with the Atal Tunnel a short drive beyond.',
    location: 'Near Manali, Kullu district, Himachal Pradesh',
    bestTime: 'December to February (snow), April to June',
    culture: {
      title: 'Mountain Village Life',
      description: 'Solang takes its name from the small village of Solang, at the head of the valley where the Beas River begins its journey. The surrounding villages still live by farming and herding, and their temples — like Anjani Mahadev — are important local pilgrim sites.',
      highlights: [
        'Traditional Himachali villages',
        'Anjani Mahadev temple and its winter ice lingam',
        'Gaddi shepherds and their flocks in summer',
        'Woollen shawls and caps from local weavers',
        'Ski training by the national mountaineering institute',
        'Close to Old Manali’s café culture'
      ]
    },
    bestThings: {
      title: 'Best Things to Do',
      items: [
        { icon: Mountain, name: 'Paragliding', description: 'Short tandem flights over the valley with licensed pilots' },
        { icon: Snowflake, name: 'Snow Sports', description: 'Skiing, snowboarding, snow tubing and snow scooters in winter' },
        { icon: Camera, name: 'Ropeway', description: 'A cable-car ride up the mountainside for wide views of the valley' },
        { icon: Sunrise, name: 'Atal Tunnel', description: 'Drive through the 9 km tunnel to Sissu and the Lahaul valley' }
      ]
    },
    gallery: [
      { src: img('solang', 'paragliding'), alt: 'Paragliders at Solang Valley' },
      { src: img('solang', 'ropeway'), alt: 'Solang Valley ropeway in winter' },
      { src: img('solang', 'winter-paragliding'), alt: 'Paragliding over snowy Solang' },
      { src: img('solang', 'solang-snow'), alt: 'Solang Valley under snow' },
      { src: img('solang', 'atal-tunnel'), alt: 'Approach road to the Atal Tunnel' },
      { src: img('solang', 'beas-kund'), alt: 'Beas Kund, source of the Beas River' }
    ],
    tips: [
      'Start early — traffic at Palchan and the Solang turn-off builds up by mid-morning in peak season.',
      'Book activities at the official counters and agree on prices before you start.',
      'Rent snow boots and suits in Manali or at Solang before playing in the snow.',
      'Paragliding usually pauses during the monsoon and in bad weather.',
      'After heavy snow, private cars may not be allowed beyond a point — use local taxis.'
    ],
    nearbyDestinations: ['Manali', 'Atal Tunnel', 'Sissu', 'Anjani Mahadev', 'Beas Kund', 'Rohtang Pass', 'Old Manali'],
    altitude: '~2,500 m above sea level',
    nearestAirport: 'Bhuntar Airport (~65 km)',
    idealDuration: 'A full day from Manali',
    intro: [
      'Solang Valley lies about 14 km north-west of Manali, a wide meadow at the foot of snow-capped peaks and glaciers. It is the place most Manali trips include for adventure — in summer the slopes fill with paragliders, and in winter they turn into the region’s main ski and snow-play area.',
      'Beyond Solang, the road climbs to Dhundi and the south portal of the Atal Tunnel, which runs about 9 km under the Pir Panjal range to Sissu in Lahaul — so Solang and the tunnel are easy to combine in one day.'
    ],
    whyVisit: {
      text: 'If you want snow or adventure on a Manali trip, Solang is where you’ll find it — all within an hour of town.',
      highlights: [
        'Tandem paragliding',
        'Skiing and snowboarding in winter',
        'Ropeway with valley views',
        'Snow play for families',
        'Easy access to the Atal Tunnel',
        'Gateway to the Beas Kund trek'
      ]
    },
    topPlaces: [
      { name: 'Solang Slopes', description: 'The main meadow where paragliding, zorbing and ATV rides run in summer, and where skiing and snow tubing take over in winter.', image: img('solang', 'paragliding') },
      { name: 'Solang Ropeway', description: 'A cable car from the valley floor up the mountainside — one of the best ways to see the valley from above, especially in snow.', image: img('solang', 'ropeway') },
      { name: 'Atal Tunnel', description: 'Opened in 2020, the 9.02 km Atal Tunnel is the longest highway tunnel in the world above 10,000 ft. Its south portal is a short drive beyond Solang.', image: img('solang', 'atal-tunnel') },
      { name: 'Beas Kund', description: 'A glacial lake at about 3,700 m, believed to be the source of the Beas River, reached by a popular 2–3 day trek from Solang.', image: img('solang', 'beas-kund') },
      { name: 'Anjani Mahadev', description: 'A temple and waterfall near Solang where a natural ice lingam forms in winter, reached by a short walk or pony ride.' },
      { name: 'Sissu', description: 'A village with a waterfall in the Lahaul valley, just across the Atal Tunnel — a popular extension of the Solang day trip.' }
    ],
    adventure: {
      text: 'Solang is all about adventure, with something new in every season.',
      activities: [
        'Tandem paragliding',
        'Skiing and snowboarding',
        'Snow tubing and snow scooters',
        'Ropeway ride',
        'Zorbing',
        'ATV rides',
        'Horse riding'
      ],
      treks: ['Beas Kund Trek', 'Anjani Mahadev Walk', 'Friendship Peak (expedition)']
    },
    food: {
      text: 'Food at Solang is simple — roadside stalls and small cafés. For a proper meal, head back to Manali or Old Manali.',
      dishes: ['Maggi', 'Momos', 'Roasted corn', 'Hot chai', 'Rajma chawal', 'Himachali Siddu (in Manali)']
    },
    seasons: [
      { name: 'Summer', months: 'April to June', points: ['Paragliding season', 'Green meadows and cool weather', 'Busy with Manali tourists'] },
      { name: 'Monsoon', months: 'July to September', points: ['Rain and mist', 'Paragliding usually suspended', 'Landslide risk on roads'] },
      { name: 'Winter', months: 'December to February', points: ['Snow-covered slopes', 'Skiing and snow-play season', 'Roads may close after heavy snowfall'] }
    ],
    faqs: [
      { q: 'How far is Solang Valley from Manali?', a: 'About 14 km — around 30 to 45 minutes by road, longer in peak-season traffic.' },
      { q: 'When will I find snow in Solang?', a: 'Usually from December to February, sometimes into March.' },
      { q: 'Can I visit the Atal Tunnel from Solang?', a: 'Yes. The tunnel’s south portal is a short drive beyond Solang, and most visitors combine both in one day.' },
      { q: 'Is Solang good for families?', a: 'Yes — snow play, the ropeway and short rides make it fun for all ages.' }
    ]
  },
  'landour': {
    name: 'Landour',
    slug: 'landour',
    image: img('landour', 'lal-tibba'),
    description: 'A quiet colonial cantonment just above Mussoorie, Landour is known for its deodar forests, old churches, Char Dukan cafés and Himalayan views from Lal Tibba.',
    location: 'Above Mussoorie, Dehradun district, Uttarakhand',
    bestTime: 'March to June, September to December',
    culture: {
      title: 'Colonial Heritage & Literary Charm',
      description: 'Landour was set up in 1827 as a sanatorium for British soldiers, and much of it is still a cantonment, which keeps it quiet and green. It is home to author Ruskin Bond, the historic Landour Language School and Woodstock School.',
      highlights: [
        'St. Paul’s Church, built in 1840',
        'Kellogg Memorial Church, home of the Landour Language School',
        'Old British cemetery and bungalows',
        'The home of author Ruskin Bond',
        'Bakeries and old general stores of Sisters’ Bazaar',
        'Walking trails through deodar forest'
      ]
    },
    bestThings: {
      title: 'Best Things to Do',
      items: [
        { icon: Camera, name: 'Lal Tibba', description: 'The highest point of the area, with telescope views of the Himalayan peaks' },
        { icon: Mountain, name: 'The Chukkar Walk', description: 'A peaceful loop walk around the top of Landour hill' },
        { icon: Utensils, name: 'Char Dukan', description: 'Pancakes, bun-omelettes and ginger-lemon-honey tea at the four old shops' },
        { icon: Sunrise, name: 'Heritage Churches', description: 'St. Paul’s Church and the Kellogg Memorial Church' }
      ]
    },
    gallery: [
      { src: img('landour', 'lal-tibba'), alt: 'Himalayan view from Lal Tibba' },
      { src: img('landour', 'st-pauls-church'), alt: 'St. Paul’s Church, Landour' },
      { src: img('landour', 'kellogg-church'), alt: 'Kellogg Memorial Church' },
      { src: img('landour', 'char-dukan'), alt: 'Snow above Char Dukan' },
      { src: img('landour', 'mussoorie-from-landour'), alt: 'Mussoorie seen from Landour' }
    ],
    tips: [
      'Parking is very limited and roads are narrow — walk up from Mussoorie or take a local taxi.',
      'Landour is largely a cantonment area; respect signboards and keep noise down.',
      'Visit Lal Tibba early in the morning for the clearest mountain views.',
      'Carry a jacket — it is a few degrees colder than Mussoorie.',
      'Shops and cafés close early in the evening.'
    ],
    nearbyDestinations: ['Mussoorie', 'Dhanaulti', 'George Everest Peak', 'Kempty Falls', 'Dehradun', 'Kanatal'],
    altitude: '~2,270 m above sea level',
    nearestAirport: 'Jolly Grant, Dehradun (~65 km)',
    idealDuration: '1 to 2 days',
    intro: [
      'Landour sits on the hill above Mussoorie, a few hundred metres higher and a world away from the crowds of Mall Road. Founded by the British in 1827 as a place for soldiers to recover, it has kept its quiet roads, old cottages and deodar forests.',
      'Most visitors walk or drive up from Mussoorie’s Picture Palace end. A day here usually means a walk around the Chukkar, a stop at Char Dukan, the view from Lal Tibba, and coffee at one of the small cafés and bakeries.'
    ],
    whyVisit: {
      text: 'Landour is the calm, slow side of Mussoorie — perfect for walks, cafés, old churches and mountain views.',
      highlights: [
        'Peaceful walks under deodar trees',
        'Himalayan views from Lal Tibba',
        'Char Dukan’s famous breakfasts',
        'Colonial churches and cottages',
        'Cosy bakeries and cafés',
        'Easy add-on to a Mussoorie trip'
      ]
    },
    topPlaces: [
      { name: 'Lal Tibba', description: 'The highest viewpoint in the Mussoorie area. On clear days, telescopes here show peaks like Bandarpunch and the Kedarnath range.', image: img('landour', 'lal-tibba') },
      { name: 'Char Dukan', description: '"Four shops" — a cluster of small cafés near St. Paul’s Church that has served travellers and students for decades.', image: img('landour', 'char-dukan') },
      { name: 'St. Paul’s Church', description: 'Built in 1840, this pale-yellow church sits right next to Char Dukan and is one of the oldest in the area.', image: img('landour', 'st-pauls-church') },
      { name: 'Kellogg Memorial Church', description: 'A stone church built in 1903, now home to the Landour Language School, where Hindi has been taught to visitors for generations.', image: img('landour', 'kellogg-church') },
      { name: 'Sisters’ Bazaar', description: 'A tiny bazaar known for its old-fashioned general stores selling home-made cheese, jams and peanut butter.' },
      { name: 'Landour Cemetery', description: 'A quiet British-era cemetery on the hillside with old gravestones dating back to the 1800s.' }
    ],
    adventure: {
      text: 'Landour is best explored at walking pace — the hill is laced with quiet roads and forest paths.',
      activities: [
        'The Chukkar loop walk',
        'Sunrise at Lal Tibba',
        'Heritage church walks',
        'Bird watching in the deodar forest',
        'Photography',
        'Café hopping'
      ],
      treks: ['Landour Chukkar', 'Lal Tibba to Sisters’ Bazaar', 'Mussoorie to Landour Walk']
    },
    food: {
      text: 'For a small place, Landour has a big food reputation — its bakeries and cafés are part of the experience.',
      dishes: ['Pancakes & waffles at Char Dukan', 'Bun-omelette', 'Ginger-lemon-honey tea', 'Home-made cheese & jams', 'Fresh bakery bread', 'Maggi']
    },
    seasons: [
      { name: 'Summer', months: 'March to June', points: ['Pleasant days, cool evenings', 'Clear morning views', 'Busy on weekends'] },
      { name: 'Monsoon', months: 'July to August', points: ['Mist and heavy rain', 'Moody, green forests', 'Views often hidden by clouds'] },
      { name: 'Winter', months: 'September to February', points: ['Clearest Himalayan views (Oct–Dec)', 'Chance of snow in Jan–Feb', 'Cold nights'] }
    ],
    faqs: [
      { q: 'How far is Landour from Mussoorie?', a: 'Landour starts just above Mussoorie — about 2 to 3 km from Mall Road, a 30–45 minute uphill walk.' },
      { q: 'Can I see the Himalayas from Landour?', a: 'Yes. On clear days, especially from October to December, Lal Tibba has views of the snow-covered peaks.' },
      { q: 'Is Landour worth visiting?', a: 'Yes, if you enjoy quiet walks, heritage and cafés. It is much calmer than Mussoorie.' }
    ]
  },
  'dehradun': {
    name: 'Dehradun',
    slug: 'dehradun',
    image: img('dehradun', 'fri'),
    description: 'Uttarakhand’s capital in the Doon Valley, Dehradun is the gateway to Mussoorie and Rishikesh, with colonial landmarks like the Forest Research Institute, river caves, sulphur springs and Buddhist monasteries.',
    location: 'Doon Valley, Uttarakhand',
    bestTime: 'October to March',
    culture: {
      title: 'A Valley of Schools, Forests & Temples',
      description: 'Dehradun has long been home to famous institutions — the Forest Research Institute, the Indian Military Academy and boarding schools like The Doon School. It is also a mix of Garhwali, Punjabi and Tibetan communities, with temples, gurudwaras and monasteries across the city.',
      highlights: [
        'Forest Research Institute, founded in 1906',
        'Indian Military Academy',
        'Tibetan Buddhist monasteries in Clement Town',
        'Garhwali food and festivals',
        'Old bakeries and Paltan Bazaar',
        'Famous basmati rice of the Doon Valley'
      ]
    },
    bestThings: {
      title: 'Best Things to Do',
      items: [
        { icon: Camera, name: 'Heritage', description: 'Forest Research Institute, the Clock Tower and Paltan Bazaar' },
        { icon: Waves, name: 'Caves & Springs', description: 'Robber’s Cave, Sahastradhara and Tapkeshwar Temple' },
        { icon: Sunrise, name: 'Monasteries', description: 'Mindrolling Monastery and its Great Stupa' },
        { icon: Mountain, name: 'Day Trips', description: 'Mussoorie, Rishikesh and Haridwar are all within easy reach' }
      ]
    },
    gallery: [
      { src: img('dehradun', 'fri-2'), alt: 'Forest Research Institute' },
      { src: img('dehradun', 'robbers-cave'), alt: 'Robber’s Cave (Guchhupani)' },
      { src: img('dehradun', 'mindrolling'), alt: 'Great Stupa at Mindrolling Monastery' },
      { src: img('dehradun', 'tapkeshwar'), alt: 'Shiva lingam inside Tapkeshwar Temple' },
      { src: img('dehradun', 'clock-tower'), alt: 'Clock Tower, Dehradun' },
      { src: 'https://s7ap1.scene7.com/is/image/incredibleindia/asan-barrage-dehradun-uttarakhand-1-attr-hero?qlt=82&ts=1742157310603', alt: 'Asan Barrage' }
    ],
    tips: [
      'The Forest Research Institute charges a small entry fee and is closed on some holidays — check timings before you go.',
      'Wear shoes you don’t mind getting wet at Robber’s Cave; you walk through the stream.',
      'City traffic is heavy at peak hours — plan Mussoorie trips early in the morning.',
      'Jolly Grant Airport is on the Rishikesh side of the city, about 25 km from the centre.',
      'Winter mornings can be foggy — allow extra time for travel.'
    ],
    nearbyDestinations: ['Mussoorie', 'Landour', 'Rishikesh', 'Haridwar', 'Dhanaulti', 'Chakrata'],
    altitude: '~640 m above sea level',
    nearestAirport: 'Jolly Grant Airport (~25 km)',
    idealDuration: '2 to 3 days',
    intro: [
      'Dehradun lies in the Doon Valley between the Shivalik hills and the lower Himalayas, with the Ganga to its east and the Yamuna to its west. It is the capital of Uttarakhand and the gateway to Mussoorie, about 35 km up the hill.',
      'The city is known for its grand colonial-era institutions, its mild climate, its bakeries and its many easy day trips — river caves, sulphur springs, temples, monasteries, and the hill stations and pilgrim towns all around it.'
    ],
    whyVisit: {
      text: 'Dehradun is more than a stopover — give it a day or two for its heritage, caves and monasteries before heading into the hills.',
      highlights: [
        'The grand Forest Research Institute campus',
        'Walking through Robber’s Cave',
        'Sulphur springs at Sahastradhara',
        'Mindrolling Monastery’s Great Stupa',
        'Bird watching at Asan Barrage',
        'Gateway to Mussoorie and Rishikesh'
      ]
    },
    topPlaces: [
      { name: 'Forest Research Institute', description: 'Founded in 1906, the FRI’s red-brick main building, finished in 1929, is one of the most impressive colonial buildings in India, with forestry museums open to visitors.', image: img('dehradun', 'fri-2') },
      { name: 'Robber’s Cave (Guchhupani)', description: 'A narrow limestone gorge about 8 km from the city where a stream flows through the cave — you walk through the water.', image: img('dehradun', 'robbers-cave') },
      { name: 'Mindrolling Monastery', description: 'One of the largest Tibetan Buddhist centres in India, in Clement Town, known for its towering Great Stupa and peaceful gardens.', image: img('dehradun', 'mindrolling') },
      { name: 'Tapkeshwar Temple', description: 'An ancient Shiva cave temple on the banks of a stream, where water drips naturally onto the lingam.', image: img('dehradun', 'tapkeshwar') },
      { name: 'Clock Tower & Paltan Bazaar', description: 'The Clock Tower marks the centre of the city, with Paltan Bazaar — Dehradun’s busiest market — running beside it.', image: img('dehradun', 'clock-tower') },
      { name: 'Sahastradhara', description: 'About 14 km from the city, these sulphur springs drip from limestone caves into a stream; the water is believed to have healing properties.' },
      { name: 'Asan Barrage', description: 'Part of the Asan Conservation Reserve, Uttarakhand’s first Ramsar wetland, where migratory birds gather in winter.', image: 'https://s7ap1.scene7.com/is/image/incredibleindia/asan-barrage-dehradun-uttarakhand-1-attr-hero?qlt=82&ts=1742157310603' }
    ],
    adventure: {
      text: 'The hills around Dehradun are full of short hikes, river walks and easy outdoor trips.',
      activities: [
        'Walking through Robber’s Cave',
        'Riverside picnics at Maldevta',
        'Bird watching at Asan Barrage',
        'Cycling in the cantonment areas',
        'Day hike to Shikhar Falls',
        'Weekend treks in the Garhwal hills'
      ],
      treks: ['Shikhar Falls', 'Nag Tibba Trek', 'Lachhiwala Nature Walk']
    },
    food: {
      text: 'Dehradun’s food scene mixes Garhwali home cooking, old bakeries and Tibetan food.',
      dishes: ['Bakery rusks & buns', 'Momos', 'Kafuli', 'Aloo ke gutke', 'Basmati rice dishes', 'Bun-tikki', 'Bal Mithai']
    },
    seasons: [
      { name: 'Summer', months: 'April to June', points: ['Warm to hot days', 'Good time to escape to Mussoorie', 'Lychee season in June'] },
      { name: 'Monsoon', months: 'July to September', points: ['Heavy rain', 'Very green valley', 'Roads to the hills can be disrupted'] },
      { name: 'Winter', months: 'October to March', points: ['Pleasant days, cold nights', 'Migratory birds at Asan', 'Best time for sightseeing'] }
    ],
    faqs: [
      { q: 'How far is Mussoorie from Dehradun?', a: 'About 35 km — around 1 to 1.5 hours by road.' },
      { q: 'What is Dehradun famous for?', a: 'The Forest Research Institute, the Indian Military Academy, its boarding schools, basmati rice and bakeries, and being the gateway to Mussoorie.' },
      { q: 'How many days do I need for Dehradun?', a: 'Two days covers the main sights; add more for day trips to Mussoorie or Rishikesh.' },
      { q: 'How do I reach Dehradun?', a: 'Jolly Grant Airport is about 25 km away, and Dehradun Railway Station has direct trains from Delhi.' }
    ]
  }
};

// Alternative spellings that should resolve to an existing page.
export const destinationAliases: Record<string, string> = {
  'mussoorie': 'mussorie',
  'solang-valley': 'solang',
};

// Map a "Nearby destinations" label to a page we actually have, if any.
const nearbySlugs: Record<string, string> = {
  'Manali': 'manali',
  'Mussoorie': 'mussorie',
  'Kasol': 'kasol',
  'Rishikesh': 'rishikesh',
  'Dalhousie': 'dalhousie',
  'Spiti': 'spiti',
  'Solang Valley': 'solang',
  'Landour': 'landour',
  'Dehradun': 'dehradun',
};

export function getDestination(slug: string | undefined): Destination | undefined {
  if (!slug) return undefined;
  const key = slug.toLowerCase();
  return destinationsData[destinationAliases[key] ?? key];
}

export function nearbySlug(name: string): string | undefined {
  return nearbySlugs[name];
}
