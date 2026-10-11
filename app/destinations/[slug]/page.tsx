import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MapPin, Mountain, Calendar, Users, Star, ArrowRight, Plane, TrendingUp, Clock, Check, Snowflake, Sun, CloudRain, ChevronDown, Utensils } from 'lucide-react';
import ScrollAnimation from '@/components/ScrollAnimation';
import SafeImage from '@/components/SafeImage';
import { destinationsData, getDestination, nearbySlug } from '@/lib/destinations';
import { photoCredits } from '@/lib/photo-credits';

// Pre-render every destination page at build time (SSG). The content is 100%
// static hardcoded data, so there is no reason to render it on the client —
// the HTML now ships fully built, which is instant and ideal for SEO.
export function generateStaticParams() {
  return Object.keys(destinationsData).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const dest = getDestination(params.slug);
  if (!dest) return {};
  return {
    title: `${dest.name} Travel Guide — Best Things to Do, Culture & Tips`,
    description: dest.description,
    alternates: { canonical: `/destinations/${dest.slug}` },
    openGraph: {
      title: `${dest.name} Travel Guide`,
      description: dest.description,
      images: dest.image ? [{ url: dest.image }] : undefined,
    },
  };
}

export default function DestinationDetailPage({ params }: { params: { slug: string } }) {
  const destination = getDestination(params.slug);

  // Unknown slug → home, preserving the previous router.push('/') behaviour.
  if (!destination) redirect('/');
  // Old or alternative spelling → canonical URL.
  if (params.slug !== destination.slug) redirect(`/destinations/${destination.slug}`);

  // Every self-hosted Commons photo shown on this page, credited once each.
  const credits = Array.from(new Set([
    destination.image,
    ...(destination.topPlaces ?? []).map((p) => p.image),
    ...destination.gallery.map((g) => g.src),
  ]))
    .filter((src): src is string => !!src && src in photoCredits)
    .map((src) => photoCredits[src]);

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
      <div className="relative h-96 md:h-[500px] lg:h-[600px] overflow-hidden bg-purple-950">
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
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-white/90 text-sm md:text-base">
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
                      <SafeImage src={place.image} alt={place.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
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
                <figure
                  key={index}
                  className="relative h-64 rounded-xl overflow-hidden group"
                >
                  <SafeImage
                    src={image.src}
                    alt={image.alt}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <figcaption className="absolute bottom-0 inset-x-0 p-3 text-sm font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity">{image.alt}</figcaption>
                </figure>
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
                {destination.nearbyDestinations.map((dest, index) => {
                  const slug = nearbySlug(dest);
                  const label = (
                    <div className="flex items-center space-x-3">
                      <MapPin className="h-5 w-5 text-purple-600" />
                      <span className="text-gray-900 font-medium">{dest}</span>
                    </div>
                  );
                  // Only places with their own guide page are links.
                  return slug ? (
                    <Link
                      key={index}
                      href={`/destinations/${slug}`}
                      className="flex items-center justify-between p-3 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors group"
                    >
                      {label}
                      <ArrowRight className="h-4 w-4 text-purple-600 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  ) : (
                    <div key={index} className="flex items-center p-3 bg-purple-50 rounded-lg">
                      {label}
                    </div>
                  );
                })}
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

        {/* Photo credits for the Wikimedia Commons images on this page */}
        {credits.length > 0 && (
          <p className="mt-10 text-xs text-gray-400 leading-relaxed">
            Photos via Wikimedia Commons:{' '}
            {credits.map((c, i) => (
              <span key={c.source}>
                {i > 0 && ' · '}
                <a href={c.source} target="_blank" rel="noopener noreferrer" className="hover:text-purple-600 underline-offset-2 hover:underline">
                  {c.author}
                </a>{' '}
                ({c.license})
              </span>
            ))}
          </p>
        )}
      </div>
    </div>
  );
}

