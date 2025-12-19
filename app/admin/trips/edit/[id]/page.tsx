'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Save, Plus, X, Check, Calendar, DollarSign, Users, MapPin, Image as ImageIcon, FileText, Sparkles, ChevronRight, ChevronLeft } from 'lucide-react';

interface DayItinerary {
  day: number;
  title: string;
  description: string;
  activities: string[];
}

interface EarlyBirdCondition {
  type: 'date_range' | 'user_limit' | 'first_bookings' | 'discount_code';
  value: string;
  label: string;
}

export default function EditTripPage() {
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 6;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Step 1: Basic Information
  const [title, setTitle] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [fullDescription, setFullDescription] = useState('');
  const [destination, setDestination] = useState('');

  // Step 2: Pricing
  const [price, setPrice] = useState('');
  const [discountedPrice, setDiscountedPrice] = useState('');
  const [seatLockPrice, setSeatLockPrice] = useState('');
  const [earlyBirdEnabled, setEarlyBirdEnabled] = useState(false);
  const [earlyBirdPrice, setEarlyBirdPrice] = useState('');
  const [earlyBirdConditions, setEarlyBirdConditions] = useState<EarlyBirdCondition[]>([]);

  // Step 3: Dates & Seats
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [bookingDeadline, setBookingDeadline] = useState('');
  const [maxSeats, setMaxSeats] = useState('');
  const [currentParticipants, setCurrentParticipants] = useState(0);

  // Step 4: Images
  const [coverImage, setCoverImage] = useState('');
  const [galleryImages, setGalleryImages] = useState<string[]>(['']);

  // Step 5: Content
  const [highlights, setHighlights] = useState<string[]>(['']);
  const [itinerary, setItinerary] = useState<DayItinerary[]>([
    { day: 1, title: '', description: '', activities: [''] }
  ]);

  // Step 6: Additional
  const [whatsappGroupLink, setWhatsappGroupLink] = useState('');
  const [includedItems, setIncludedItems] = useState<string[]>(['']);
  const [excludedItems, setExcludedItems] = useState<string[]>(['']);
  const [pickupLocation, setPickupLocation] = useState('');

  // Load trip data
  useEffect(() => {
    if (params.id) {
      fetchTrip();
    }
  }, [params.id]);

  const fetchTrip = async () => {
    try {
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('id', params.id)
        .single();

      if (error) throw error;
      if (!data) {
        router.push('/admin/trips');
        return;
      }

      // Populate form fields
      setTitle(data.title || '');
      setShortDescription(data.short_description || data.description || '');
      setFullDescription(data.full_description || data.description || '');
      setDestination(data.destination || '');
      setPrice(data.original_price?.toString() || '');
      setDiscountedPrice(data.discounted_price?.toString() || '');
      setSeatLockPrice(data.seat_lock_price?.toString() || '');
      setMaxSeats(data.max_participants?.toString() || '');
      setCurrentParticipants(data.current_participants || 0);
      
      // Format dates for input fields (YYYY-MM-DD)
      if (data.start_date) {
        setStartDate(new Date(data.start_date).toISOString().split('T')[0]);
      }
      if (data.end_date) {
        setEndDate(new Date(data.end_date).toISOString().split('T')[0]);
      }
      if (data.booking_deadline_date) {
        setBookingDeadline(new Date(data.booking_deadline_date).toISOString().split('T')[0]);
      }

      // Images
      setCoverImage(data.cover_image_url || data.image_url || '');
      if (data.gallery_images && Array.isArray(data.gallery_images) && data.gallery_images.length > 0) {
        setGalleryImages(data.gallery_images);
      } else {
        setGalleryImages(['']);
      }

      // Highlights
      if (data.highlights && Array.isArray(data.highlights) && data.highlights.length > 0) {
        setHighlights(data.highlights);
      } else {
        setHighlights(['']);
      }

      // Itinerary
      if (data.day_wise_itinerary && Array.isArray(data.day_wise_itinerary) && data.day_wise_itinerary.length > 0) {
        setItinerary(data.day_wise_itinerary);
      }

      // Included/Excluded
      if (data.included_features && Array.isArray(data.included_features) && data.included_features.length > 0) {
        setIncludedItems(data.included_features);
      } else {
        setIncludedItems(['']);
      }

      // Early Bird
      if (data.early_bird_price) {
        setEarlyBirdEnabled(true);
        setEarlyBirdPrice(data.early_bird_price.toString());
        
        if (data.early_bird_conditions && typeof data.early_bird_conditions === 'object') {
          const conditions = data.early_bird_conditions as any;
          if (conditions.conditions && Array.isArray(conditions.conditions)) {
            const labels = {
              date_range: 'Available for bookings between dates',
              user_limit: 'First N users',
              first_bookings: 'First N bookings',
              discount_code: 'Users with discount code',
            };
            setEarlyBirdConditions(
              conditions.conditions.map((c: any) => ({
                type: c.type,
                value: c.value || '',
                label: labels[c.type as keyof typeof labels] || c.type,
              }))
            );
          }
        }
      }

      // WhatsApp link
      setWhatsappGroupLink(data.whatsapp_group_link || '');
    } catch (error: any) {
      console.error('Error fetching trip:', error);
      setError('Failed to load trip data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Step Indicator Component
  const StepIndicator = () => {
    const steps = [
      { num: 1, label: 'Basic Info', icon: FileText },
      { num: 2, label: 'Pricing', icon: DollarSign },
      { num: 3, label: 'Dates & Seats', icon: Calendar },
      { num: 4, label: 'Images', icon: ImageIcon },
      { num: 5, label: 'Content', icon: Sparkles },
      { num: 6, label: 'Finish', icon: Check },
    ];

    return (
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.num;
            const isCompleted = currentStep > step.num;
            const isLast = index === steps.length - 1;

            return (
              <div key={step.num} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center font-bold transition-all duration-300 ${
                      isActive
                        ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white shadow-lg scale-110'
                        : isCompleted
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {isCompleted ? <Check className="h-6 w-6" /> : <Icon className="h-6 w-6" />}
                  </div>
                  <span
                    className={`mt-2 text-xs font-medium hidden sm:block ${
                      isActive ? 'text-purple-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {!isLast && (
                  <div
                    className={`h-1 flex-1 mx-2 transition-all duration-300 ${
                      isCompleted ? 'bg-green-500' : currentStep > step.num ? 'bg-purple-300' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Validation for each step
  const validateStep = (step: number): boolean => {
    setError('');
    switch (step) {
      case 1:
        if (!title || !shortDescription || !fullDescription || !destination) {
          setError('Please fill in all basic information fields');
          return false;
        }
        return true;
      case 2:
        if (!price || !discountedPrice || !seatLockPrice) {
          setError('Please fill in all pricing fields');
          return false;
        }
        if (parseFloat(seatLockPrice) >= parseFloat(discountedPrice)) {
          setError('Seat lock price must be less than discounted price');
          return false;
        }
        if (earlyBirdEnabled && !earlyBirdPrice) {
          setError('Please enter early bird price');
          return false;
        }
        return true;
      case 3:
        if (!startDate || !endDate || !bookingDeadline || !maxSeats) {
          setError('Please fill in all date and seat information');
          return false;
        }
        if (new Date(bookingDeadline) >= new Date(startDate)) {
          setError('Booking deadline must be before trip start date');
          return false;
        }
        return true;
      case 4:
        if (!coverImage) {
          setError('Please provide a cover image URL');
          return false;
        }
        return true;
      case 5:
        if (itinerary.length === 0 || itinerary.some(day => !day.title || !day.description)) {
          setError('Please add at least one complete itinerary day');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      if (currentStep < totalSteps) {
        setCurrentStep(currentStep + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const addItineraryDay = () => {
    setItinerary([...itinerary, { day: itinerary.length + 1, title: '', description: '', activities: [''] }]);
  };

  const removeItineraryDay = (index: number) => {
    const updated = itinerary.filter((_, i) => i !== index);
    setItinerary(updated.map((item, i) => ({ ...item, day: i + 1 })));
  };

  const updateItineraryDay = (index: number, field: keyof DayItinerary, value: any) => {
    const updated = [...itinerary];
    updated[index] = { ...updated[index], [field]: value };
    setItinerary(updated);
  };

  const addActivity = (dayIndex: number) => {
    const updated = [...itinerary];
    updated[dayIndex].activities.push('');
    setItinerary(updated);
  };

  const removeActivity = (dayIndex: number, activityIndex: number) => {
    const updated = [...itinerary];
    updated[dayIndex].activities = updated[dayIndex].activities.filter((_, i) => i !== activityIndex);
    setItinerary(updated);
  };

  const updateActivity = (dayIndex: number, activityIndex: number, value: string) => {
    const updated = [...itinerary];
    updated[dayIndex].activities[activityIndex] = value;
    setItinerary(updated);
  };

  const addHighlight = () => {
    setHighlights([...highlights, '']);
  };

  const removeHighlight = (index: number) => {
    setHighlights(highlights.filter((_, i) => i !== index));
  };

  const addGalleryImage = () => {
    setGalleryImages([...galleryImages, '']);
  };

  const removeGalleryImage = (index: number) => {
    setGalleryImages(galleryImages.filter((_, i) => i !== index));
  };

  const addEarlyBirdCondition = (type: EarlyBirdCondition['type']) => {
    const labels = {
      date_range: 'Available for bookings between dates',
      user_limit: 'First N users',
      first_bookings: 'First N bookings',
      discount_code: 'Users with discount code',
    };
    setEarlyBirdConditions([...earlyBirdConditions, { type, value: '', label: labels[type] }]);
  };

  const removeEarlyBirdCondition = (index: number) => {
    setEarlyBirdConditions(earlyBirdConditions.filter((_, i) => i !== index));
  };

  const updateEarlyBirdCondition = (index: number, value: string) => {
    const updated = [...earlyBirdConditions];
    updated[index].value = value;
    setEarlyBirdConditions(updated);
  };

  const addIncludedItem = () => {
    setIncludedItems([...includedItems, '']);
  };

  const removeIncludedItem = (index: number) => {
    setIncludedItems(includedItems.filter((_, i) => i !== index));
  };

  const addExcludedItem = () => {
    setExcludedItems([...excludedItems, '']);
  };

  const removeExcludedItem = (index: number) => {
    setExcludedItems(excludedItems.filter((_, i) => i !== index));
  };

  const calculateDiscount = () => {
    if (price && discountedPrice) {
      const original = parseFloat(price);
      const discounted = parseFloat(discountedPrice);
      if (original > 0) {
        return Math.round(((original - discounted) / original) * 100);
      }
    }
    return 0;
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    setSaving(true);
    setError('');

    try {
      const originalPrice = parseFloat(price);
      const discountedPriceNum = parseFloat(discountedPrice);
      const seatLockPriceNum = parseFloat(seatLockPrice);
      const earlyBirdPriceNum = earlyBirdEnabled && earlyBirdPrice ? parseFloat(earlyBirdPrice) : null;

      const start = new Date(startDate);
      const end = new Date(endDate);
      const durationDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      const filteredHighlights = highlights.filter(h => h.trim());
      const filteredGallery = galleryImages.filter(img => img.trim());

      let earlyBirdConditionsData = null;
      if (earlyBirdEnabled && earlyBirdPriceNum) {
        earlyBirdConditionsData = {
          enabled: true,
          price: earlyBirdPriceNum,
          conditions: earlyBirdConditions.map(c => ({ type: c.type, value: c.value })),
        };
      }

      const tripData = {
        title,
        short_description: shortDescription,
        full_description: fullDescription,
        description: shortDescription,
        destination,
        original_price: originalPrice,
        discounted_price: discountedPriceNum,
        discount_percentage: calculateDiscount(),
        seat_lock_price: seatLockPriceNum,
        early_bird_price: earlyBirdPriceNum,
        early_bird_conditions: earlyBirdConditionsData,
        duration_days: durationDays,
        max_participants: parseInt(maxSeats),
        // Keep existing current_participants - don't reset it
        start_date: startDate,
        end_date: endDate,
        booking_deadline_date: bookingDeadline,
        cover_image_url: coverImage,
        image_url: coverImage,
        gallery_images: filteredGallery.length > 0 ? filteredGallery : null,
        highlights: filteredHighlights.length > 0 ? filteredHighlights : null,
        day_wise_itinerary: itinerary,
        whatsapp_group_link: whatsappGroupLink || null,
        included_features: includedItems.filter(item => item.trim()),
      };

      const { error: updateError } = await supabase
        .from('trips')
        .update(tripData)
        .eq('id', params.id);

      if (updateError) throw updateError;

      setSuccess(true);
      setTimeout(() => {
        router.push('/admin/trips');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to update trip');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-16 md:pt-20 flex items-center justify-center bg-gradient-to-b from-purple-50/30 to-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 md:h-16 md:w-16 border-3 border-purple-200 border-t-purple-600 mx-auto"></div>
          <p className="mt-4 text-sm md:text-base text-purple-600 tracking-wide uppercase font-medium">Loading trip data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50/30 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin/trips"
            className="inline-flex items-center text-purple-600 hover:text-purple-700 mb-6 text-sm font-medium transition-colors group"
          >
            <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Trips</span>
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Edit Trip</h1>
          <p className="text-gray-600">Update trip details and information</p>
        </div>

        {/* Step Indicator */}
        <StepIndicator />

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-700 animate-in slide-in-from-top-5 duration-300">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border-2 border-green-200 rounded-xl text-green-700 animate-in slide-in-from-top-5 duration-300">
            Trip updated successfully! Redirecting...
          </div>
        )}

        {/* Step 1: Basic Information - Same as create page */}
        {currentStep === 1 && (
          <div className="bg-white rounded-2xl border-2 border-purple-200 shadow-xl p-8 animate-fade-in-up">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl flex items-center justify-center mr-4">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Basic Information</h2>
                <p className="text-gray-600 text-sm">Tell us about your trip</p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Trip Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900 placeholder-gray-400"
                  placeholder="e.g., Amazing Goa Adventure"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Short Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  required
                  rows={3}
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none resize-none transition-all text-gray-900 placeholder-gray-400"
                  placeholder="Brief description that appears in trip listings..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Full Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={fullDescription}
                  onChange={(e) => setFullDescription(e.target.value)}
                  required
                  rows={8}
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none resize-none transition-all text-gray-900 placeholder-gray-400"
                  placeholder="Detailed description of the trip experience, what travelers can expect, special moments, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Destination <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  required
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900 placeholder-gray-400"
                  placeholder="e.g., Goa, India"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Pricing */}
        {currentStep === 2 && (
          <div className="bg-white rounded-2xl border-2 border-purple-200 shadow-xl p-8 animate-fade-in-up">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl flex items-center justify-center mr-4">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Pricing Information</h2>
                <p className="text-gray-600 text-sm">Set your trip pricing and payment options</p>
              </div>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Original Price (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                    min="0"
                    className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Discounted Price (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={discountedPrice}
                    onChange={(e) => setDiscountedPrice(e.target.value)}
                    required
                    min="0"
                    className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900"
                  />
                  {price && discountedPrice && calculateDiscount() > 0 && (
                    <p className="text-sm text-green-600 font-medium mt-2">
                      {calculateDiscount()}% discount applied
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-5">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Seat Lock Price (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={seatLockPrice}
                  onChange={(e) => setSeatLockPrice(e.target.value)}
                  required
                  min="0"
                  className="w-full px-4 py-3.5 border-2 border-purple-200 rounded-xl focus:border-purple-600 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900 bg-white"
                  placeholder="Partial payment amount"
                />
                <div className="mt-3 space-y-1 text-sm text-gray-600">
                  <p>• This amount locks a seat (non-refundable)</p>
                  <p>• Remaining payment must be completed 5 days before departure</p>
                  <p>• Seat will auto-cancel if full payment not received</p>
                </div>
              </div>

              <div className="border-2 border-gray-200 rounded-xl p-5">
                <label className="flex items-center space-x-3 mb-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={earlyBirdEnabled}
                    onChange={(e) => setEarlyBirdEnabled(e.target.checked)}
                    className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <span className="text-sm font-semibold text-gray-700">Enable Early Bird Pricing</span>
                </label>

                {earlyBirdEnabled && (
                  <div className="space-y-4 mt-4 pl-8 border-l-2 border-purple-200">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Early Bird Price (₹)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={earlyBirdPrice}
                        onChange={(e) => setEarlyBirdPrice(e.target.value)}
                        min="0"
                        className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Apply Early Bird Price To:
                      </label>
                      <div className="flex flex-wrap gap-2 mb-3">
                        <button
                          type="button"
                          onClick={() => addEarlyBirdCondition('date_range')}
                          className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200 transition-colors"
                        >
                          + Date Range
                        </button>
                        <button
                          type="button"
                          onClick={() => addEarlyBirdCondition('user_limit')}
                          className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200 transition-colors"
                        >
                          + First N Users
                        </button>
                        <button
                          type="button"
                          onClick={() => addEarlyBirdCondition('first_bookings')}
                          className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200 transition-colors"
                        >
                          + First N Bookings
                        </button>
                        <button
                          type="button"
                          onClick={() => addEarlyBirdCondition('discount_code')}
                          className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200 transition-colors"
                        >
                          + Discount Code
                        </button>
                      </div>

                      {earlyBirdConditions.map((condition, index) => (
                        <div key={index} className="mb-3 p-3 bg-gray-50 rounded-lg flex items-center space-x-2">
                          <span className="text-sm text-gray-600 flex-1">{condition.label}:</span>
                          {condition.type === 'date_range' ? (
                            <div className="flex space-x-2">
                              <input
                                type="date"
                                value={condition.value.split('|')[0] || ''}
                                onChange={(e) => {
                                  const dates = condition.value.split('|');
                                  updateEarlyBirdCondition(index, `${e.target.value}|${dates[1] || ''}`);
                                }}
                                className="px-3 py-2 border-2 border-gray-200 rounded-lg text-sm"
                              />
                              <span className="text-gray-400">to</span>
                              <input
                                type="date"
                                value={condition.value.split('|')[1] || ''}
                                onChange={(e) => {
                                  const dates = condition.value.split('|');
                                  updateEarlyBirdCondition(index, `${dates[0] || ''}|${e.target.value}`);
                                }}
                                className="px-3 py-2 border-2 border-gray-200 rounded-lg text-sm"
                              />
                            </div>
                          ) : (
                            <input
                              type={condition.type === 'user_limit' || condition.type === 'first_bookings' ? 'number' : 'text'}
                              value={condition.value}
                              onChange={(e) => updateEarlyBirdCondition(index, e.target.value)}
                              className="px-3 py-2 border-2 border-gray-200 rounded-lg text-sm flex-1"
                              placeholder={condition.type === 'discount_code' ? 'Enter code' : 'Enter number'}
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => removeEarlyBirdCondition(index)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Dates & Seats */}
        {currentStep === 3 && (
          <div className="bg-white rounded-2xl border-2 border-purple-200 shadow-xl p-8 animate-fade-in-up">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl flex items-center justify-center mr-4">
                <Calendar className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Dates & Capacity</h2>
                <p className="text-gray-600 text-sm">Set trip dates and available seats</p>
              </div>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Trip Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Trip End Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    min={startDate}
                    className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900"
                  />
                  {startDate && endDate && (
                    <p className="text-sm text-gray-600 mt-2">
                      Duration: {Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} days
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Booking Deadline <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={bookingDeadline}
                  onChange={(e) => setBookingDeadline(e.target.value)}
                  required
                  max={startDate}
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900"
                />
                <p className="text-sm text-gray-600 mt-2">
                  Last date users can book this trip (must be before trip start)
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Maximum Seats <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={maxSeats}
                  onChange={(e) => setMaxSeats(e.target.value)}
                  required
                  min="1"
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900"
                />
                <p className="text-sm text-gray-600 mt-2">
                  Total number of seats available for this trip (Current: {currentParticipants} booked)
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Images */}
        {currentStep === 4 && (
          <div className="bg-white rounded-2xl border-2 border-purple-200 shadow-xl p-8 animate-fade-in-up">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl flex items-center justify-center mr-4">
                <ImageIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Images</h2>
                <p className="text-gray-600 text-sm">Add cover and gallery images</p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Cover Image URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  value={coverImage}
                  onChange={(e) => setCoverImage(e.target.value)}
                  required
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900 placeholder-gray-400"
                  placeholder="https://example.com/cover-image.jpg"
                />
                {coverImage && (
                  <div className="mt-3">
                    <img src={coverImage} alt="Cover preview" className="w-full h-48 object-cover rounded-xl border-2 border-gray-200" />
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-semibold text-gray-700">
                    Gallery Images
                  </label>
                  <button
                    type="button"
                    onClick={addGalleryImage}
                    className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center space-x-1"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Image</span>
                  </button>
                </div>
                <div className="space-y-3">
                  {galleryImages.map((image, index) => (
                    <div key={index} className="flex space-x-3">
                      <input
                        type="url"
                        value={image}
                        onChange={(e) => {
                          const updated = [...galleryImages];
                          updated[index] = e.target.value;
                          setGalleryImages(updated);
                        }}
                        className="flex-1 px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900 placeholder-gray-400"
                        placeholder="https://example.com/image.jpg"
                      />
                      {galleryImages.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeGalleryImage(index)}
                          className="p-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      )}
                      {image && (
                        <div className="w-20 h-20 flex-shrink-0">
                          <img src={image} alt={`Gallery ${index + 1}`} className="w-full h-full object-cover rounded-lg border-2 border-gray-200" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Content */}
        {currentStep === 5 && (
          <div className="bg-white rounded-2xl border-2 border-purple-200 shadow-xl p-8 animate-fade-in-up">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl flex items-center justify-center mr-4">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Content & Itinerary</h2>
                <p className="text-gray-600 text-sm">Add highlights and day-wise itinerary</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-semibold text-gray-700">
                    Trip Highlights
                  </label>
                  <button
                    type="button"
                    onClick={addHighlight}
                    className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center space-x-1"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Highlight</span>
                  </button>
                </div>
                <div className="space-y-2">
                  {highlights.map((highlight, index) => (
                    <div key={index} className="flex space-x-2">
                      <input
                        type="text"
                        value={highlight}
                        onChange={(e) => {
                          const updated = [...highlights];
                          updated[index] = e.target.value;
                          setHighlights(updated);
                        }}
                        className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900 placeholder-gray-400"
                        placeholder="e.g., Beach hopping, Water sports, Nightlife"
                      />
                      {highlights.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeHighlight(index)}
                          className="p-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t-2 border-gray-200 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-sm font-semibold text-gray-700">
                    Day-wise Itinerary <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={addItineraryDay}
                    className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center space-x-1"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Day</span>
                  </button>
                </div>
                <div className="space-y-4">
                  {itinerary.map((day, dayIndex) => (
                    <div key={dayIndex} className="border-2 border-gray-200 rounded-xl p-5 bg-gray-50">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-gray-900">Day {day.day}</h3>
                        {itinerary.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItineraryDay(dayIndex)}
                            className="text-sm text-red-600 hover:text-red-700 font-medium"
                          >
                            Remove Day
                          </button>
                        )}
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Day Title <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={day.title}
                            onChange={(e) => updateItineraryDay(dayIndex, 'title', e.target.value)}
                            required
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900 placeholder-gray-400 bg-white"
                            placeholder="e.g., Arrival & Beach Exploration"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Description <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            value={day.description}
                            onChange={(e) => updateItineraryDay(dayIndex, 'description', e.target.value)}
                            required
                            rows={3}
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none resize-none transition-all text-gray-900 placeholder-gray-400 bg-white"
                            placeholder="What happens on this day..."
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-semibold text-gray-700">
                              Activities
                            </label>
                            <button
                              type="button"
                              onClick={() => addActivity(dayIndex)}
                              className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                            >
                              + Add Activity
                            </button>
                          </div>
                          <div className="space-y-2">
                            {day.activities.map((activity, activityIndex) => (
                              <div key={activityIndex} className="flex space-x-2">
                                <input
                                  type="text"
                                  value={activity}
                                  onChange={(e) => updateActivity(dayIndex, activityIndex, e.target.value)}
                                  className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-500 outline-none text-gray-900 placeholder-gray-400 bg-white"
                                  placeholder="Activity description"
                                />
                                {day.activities.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeActivity(dayIndex, activityIndex)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 6: Additional */}
        {currentStep === 6 && (
          <div className="bg-white rounded-2xl border-2 border-purple-200 shadow-xl p-8 animate-fade-in-up">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl flex items-center justify-center mr-4">
                <Check className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Final Details</h2>
                <p className="text-gray-600 text-sm">Complete your trip setup</p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  WhatsApp Group Link
                </label>
                <input
                  type="url"
                  value={whatsappGroupLink}
                  onChange={(e) => setWhatsappGroupLink(e.target.value)}
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900 placeholder-gray-400"
                  placeholder="https://chat.whatsapp.com/..."
                />
                <div className="mt-3 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
                  <p className="text-sm text-blue-900">
                    <strong>Important:</strong> This WhatsApp group link will be shared with users only after their booking is <strong>confirmed</strong> (not for seat lock or pending bookings). Users will receive a notification with the group link upon booking confirmation.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  What's Included
                </label>
                <div className="space-y-2 mb-5">
                  {includedItems.map((item, index) => (
                    <div key={index} className="flex space-x-2">
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => {
                          const updated = [...includedItems];
                          updated[index] = e.target.value;
                          setIncludedItems(updated);
                        }}
                        className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900 placeholder-gray-400"
                        placeholder="e.g., Accommodation, Breakfast, Guide"
                      />
                      <div className="flex space-x-2">
                        {includedItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeIncludedItem(index)}
                            className="p-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        )}
                        {index === includedItems.length - 1 && (
                          <button
                            type="button"
                            onClick={addIncludedItem}
                            className="p-3 text-purple-600 hover:bg-purple-50 rounded-xl transition-colors"
                          >
                            <Plus className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  What's Not Included
                </label>
                <div className="space-y-2 mb-5">
                  {excludedItems.map((item, index) => (
                    <div key={index} className="flex space-x-2">
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => {
                          const updated = [...excludedItems];
                          updated[index] = e.target.value;
                          setExcludedItems(updated);
                        }}
                        className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900 placeholder-gray-400"
                        placeholder="e.g., Lunch, Dinner, Personal expenses"
                      />
                      <div className="flex space-x-2">
                        {excludedItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeExcludedItem(index)}
                            className="p-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        )}
                        {index === excludedItems.length - 1 && (
                          <button
                            type="button"
                            onClick={addExcludedItem}
                            className="p-3 text-purple-600 hover:bg-purple-50 rounded-xl transition-colors"
                          >
                            <Plus className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-2 border-green-200 bg-green-50 rounded-xl p-6">
                <h3 className="font-bold text-gray-900 mb-3">Review Summary</h3>
                <div className="space-y-2 text-sm text-gray-700">
                  <p><strong>Title:</strong> {title || 'Not set'}</p>
                  <p><strong>Destination:</strong> {destination || 'Not set'}</p>
                  <p><strong>Price:</strong> ₹{discountedPrice || 'Not set'} <span className="text-green-600">({calculateDiscount()}% off)</span></p>
                  <p><strong>Seat Lock:</strong> ₹{seatLockPrice || 'Not set'}</p>
                  {earlyBirdEnabled && earlyBirdPrice && (
                    <p><strong>Early Bird:</strong> ₹{earlyBirdPrice}</p>
                  )}
                  <p><strong>Duration:</strong> {startDate && endDate ? Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1 : 'Not set'} days</p>
                  <p><strong>Max Seats:</strong> {maxSeats || 'Not set'}</p>
                  <p><strong>Current Participants:</strong> {currentParticipants}</p>
                  <p><strong>Itinerary Days:</strong> {itinerary.length}</p>
                  <p><strong>Highlights:</strong> {highlights.filter(h => h.trim()).length}</p>
                  <p><strong>Gallery Images:</strong> {galleryImages.filter(img => img.trim()).length}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="mt-8 flex justify-between items-center">
          <button
            type="button"
            onClick={prevStep}
            disabled={currentStep === 1}
            className={`px-6 py-3 rounded-xl font-semibold flex items-center space-x-2 transition-all ${
              currentStep === 1
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <ChevronLeft className="h-5 w-5" />
            <span>Previous</span>
          </button>

          <div className="text-sm text-gray-600">
            Step {currentStep} of {totalSteps}
          </div>

          {currentStep < totalSteps ? (
            <button
              type="button"
              onClick={nextStep}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-purple-800 transition-all shadow-lg hover:shadow-xl flex items-center space-x-2"
            >
              <span>Next</span>
              <ChevronRight className="h-5 w-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="px-8 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-semibold hover:from-green-700 hover:to-green-800 transition-all shadow-lg hover:shadow-xl flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-5 w-5" />
                  <span>Update Trip</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

