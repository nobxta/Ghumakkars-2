'use client';

import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, EffectCoverflow } from 'swiper/modules';
import { MapPin } from 'lucide-react';
import Link from 'next/link';

const destinations = [
  {
    name: 'Manali',
    slug: 'manali',
    image: 'https://www.tripstorz.com/_astro/houses-surrounded-by-green-trees-in-manali-during-daytime.DAktkgeM_90jep.jpg?w=800&h=600&fit=crop',
  },
  {
    name: 'Mussorie',
    slug: 'mussorie',
    image: 'https://hblimg.mmtcdn.com/content/hubble/img/destimg/mmt/destination/m_Mussorrie_main_tv_destination_img_1_l_639_958.jpg?w=800&h=600&fit=crop',
  },
  {
    name: 'Kasol',
    slug: 'kasol',
    image: 'https://indotoursadventures.com/public/storage/blogs/165dec86f3683b83a19a09d0345dd8e2.jpg?w=800&h=600&fit=crop',
  },
  {
    name: 'Rishikesh',
    slug: 'rishikesh',
    image: 'https://s7ap1.scene7.com/is/image/incredibleindia/1-triveni-ghat-rishikesh-uttarakhand-2-city-hero?',
  },
  {
    name: 'Dalhousie',
    slug: 'dalhousie',
    image: 'https://skysafar.in/wp-content/uploads/2024/09/Untitled-design-10.png?w=800&h=600&fit=crop',
  },
  {
    name: 'Spiti',
    slug: 'spiti',
    image: 'https://4cornersoftheworld.blog/wp-content/uploads/2020/08/920d8-1512812465_maxresdefault.jpg.jpg?w=800&h=600&fit=crop',
  },
  {
    name: 'Solang',
    slug: 'solang',
    image: 'https://www.tusktravel.com/blog/wp-content/uploads/2021/02/Solang-Valley-Manali.jpg?w=800&h=600&fit=crop',
  },
  {
    name: 'Landour',
    slug: 'landour',
    image: 'https://www.rokebymanor.com/images/a78d9ccb02d01d8d9859f65994dc60f5.jpg?w=800&h=600&fit=crop',
  },
  {
    name: 'Dehradun',
    slug: 'dehradun',
    image: 'https://s7ap1.scene7.com/is/image/incredibleindia/asan-barrage-dehradun-uttarakhand-1-attr-hero?qlt=82&ts=1742157310603',
  },
];

export default function DestinationsSwiper() {
  return (
    <div className="w-full py-8 md:py-12">
      <Swiper
        modules={[Autoplay, EffectCoverflow]}
        effect="coverflow"
        grabCursor={true}
        centeredSlides={true}
        slidesPerView="auto"
        coverflowEffect={{
          rotate: 30,
          stretch: 0,
          depth: 150,
          modifier: 1.5,
          slideShadows: true,
        }}
        autoplay={{
          delay: 2500,
          disableOnInteraction: false,
          pauseOnMouseEnter: true,
        }}
        loop={true}
        speed={800}
        breakpoints={{
          320: {
            slidesPerView: 1.2,
            spaceBetween: 20,
          },
          640: {
            slidesPerView: 1.5,
            spaceBetween: 30,
          },
          768: {
            slidesPerView: 2,
            spaceBetween: 40,
          },
          1024: {
            slidesPerView: 2.5,
            spaceBetween: 50,
          },
          1280: {
            slidesPerView: 3,
            spaceBetween: 60,
          },
        }}
        className="destinations-swiper"
      >
        {destinations.map((destination, index) => (
          <SwiperSlide key={index}>
            <Link href={`/destinations/${destination.slug}`}>
              <div className="relative h-80 md:h-96 lg:h-[28rem] rounded-2xl overflow-hidden group cursor-pointer">
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                  style={{ backgroundImage: `url(${destination.image})` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"></div>
                </div>
                <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-8">
                  <div className="flex items-center space-x-2 mb-3">
                    <MapPin className="h-5 w-5 md:h-6 md:w-6 text-white" />
                    <span className="text-white/90 text-xs md:text-sm font-medium uppercase tracking-wider">
                      Destination
                    </span>
                  </div>
                  <h3 className="text-2xl md:text-3xl lg:text-4xl font-light text-white tracking-tight mb-2 group-hover:text-purple-200 transition-colors">
                    {destination.name}
                  </h3>
                  <div className="w-12 h-0.5 bg-white/50 mt-2 group-hover:w-20 transition-all duration-300"></div>
                  <p className="text-white/80 text-sm mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    Click to explore culture & best things to do
                  </p>
                </div>
                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
            </Link>
          </SwiperSlide>
        ))}
      </Swiper>
      
      <style jsx global>{`
        .destinations-swiper {
          padding: 20px 0 60px 0 !important;
          overflow: visible !important;
        }
        .destinations-swiper .swiper-slide {
          width: auto;
          height: auto;
          transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .destinations-swiper .swiper-slide-shadow-left,
        .destinations-swiper .swiper-slide-shadow-right {
          background: linear-gradient(to right, rgba(139, 92, 246, 0.15), transparent);
        }
        .destinations-swiper .swiper-slide-active {
          transform: scale(1.05);
        }
      `}</style>
    </div>
  );
}

