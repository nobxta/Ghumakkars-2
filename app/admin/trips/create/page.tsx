'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Save, Plus, X, Trash2, Check, Calendar, DollarSign, Users, MapPin, Image as ImageIcon, FileText, Sparkles, ChevronRight, ChevronLeft, Clock, Send, Upload, Loader2 } from 'lucide-react';
import TripAddonsEditor, { type AddonDraft, draftToPayload } from '@/components/admin/TripAddonsEditor';

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

export default function CreateTripPage() {
  const router = useRouter();
  const supabase = createClient();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 6;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Step 1: Basic Information
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [shortDescription, setShortDescription] = useState('');
  const [fullDescription, setFullDescription] = useState('');
  const [destination, setDestination] = useState('');

  const generateSlug = (text: string) =>
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80);

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
  const [durationText, setDurationText] = useState('');
  // Recurring weekly trips
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceDay, setRecurrenceDay] = useState('5'); // Friday
  const [recurrenceWeeksAhead, setRecurrenceWeeksAhead] = useState('4');
  const [paymentDueDaysBefore, setPaymentDueDaysBefore] = useState(''); // blank = use global default
  const [recurringDurationDays, setRecurringDurationDays] = useState('3');

  // Step 4: Images
  const [coverImage, setCoverImage] = useState('');
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState<number | null>(null);
  const [galleryImages, setGalleryImages] = useState<string[]>(['']);

  // Step 5: Content
  const [highlights, setHighlights] = useState<string[]>(['']);
  const [pickupPoints, setPickupPoints] = useState<string[]>(['']);
  const [itinerary, setItinerary] = useState<DayItinerary[]>([
    { day: 1, title: '', description: '', activities: [''] }
  ]);

  // Step 6: Additional
  const [whatsappGroupLink, setWhatsappGroupLink] = useState('');
  const [showSections, setShowSections] = useState({
    photos: true,
    itinerary: true,
    highlights: true,
    perks: true,
    included: true,
  });
  const [includedItems, setIncludedItems] = useState<string[]>(['']);
  const [excludedItems, setExcludedItems] = useState<string[]>(['']);
  const [freePerks, setFreePerks] = useState<string[]>(['']);
  const [pickupLocation, setPickupLocation] = useState('');
  const [cancellationPolicy, setCancellationPolicy] = useState('');
  
  // Publish options
  // Trip Add-ons (optional)
  const [addonsEnabled, setAddonsEnabled] = useState(false);
  const [addonDrafts, setAddonDrafts] = useState<AddonDraft[]>([]);

  const [publishOption, setPublishOption] = useState<'draft' | 'now' | 'schedule'>('draft');
  const [scheduledPublishDate, setScheduledPublishDate] = useState('');
  const [scheduledPublishTime, setScheduledPublishTime] = useState('');

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
                    className={`w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center font-bold transition-all duration-300 ${
                      isActive
                        ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white shadow-lg scale-110'
                        : isCompleted
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {isCompleted ? <Check className="h-4 w-4 sm:h-5 sm:w-5" /> : <Icon className="h-4 w-4 sm:h-5 sm:w-5" />}
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
        if (isRecurring) {
          if (!recurringDurationDays || parseInt(recurringDurationDays) < 1) {
            setError('Please set the trip length in days');
            return false;
          }
          return true;
        }
        if (!startDate || !endDate || !bookingDeadline) {
          setError('Please fill in all date information');
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

  const uploadToCloudinary = async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', 'trips');
    const res = await fetch('/api/upload/cloudinary', { method: 'POST', body: fd });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Upload failed');
    }
    const { url } = await res.json();
    return url;
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    setError('');
    try {
      const url = await uploadToCloudinary(file);
      setCoverImage(url);
    } catch (err: any) {
      setError(err.message || 'Failed to upload cover image');
    } finally {
      setUploadingCover(false);
      e.target.value = '';
    }
  };

  const handleGalleryUpload = async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingGallery(idx);
    setError('');
    try {
      const url = await uploadToCloudinary(file);
      const updated = [...galleryImages];
      updated[idx] = url;
      setGalleryImages(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to upload image');
    } finally {
      setUploadingGallery(null);
      e.target.value = '';
    }
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
    // Validate every step before submission
    for (let step = 1; step <= 5; step++) {
      if (!validateStep(step)) {
        setCurrentStep(step);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      const originalPrice = parseFloat(price);
      const discountedPriceNum = parseFloat(discountedPrice);
      const seatLockPriceNum = parseFloat(seatLockPrice);
      const earlyBirdPriceNum = earlyBirdEnabled && earlyBirdPrice ? parseFloat(earlyBirdPrice) : null;

      const start = new Date(startDate);
      const end = new Date(endDate);
      const durationDays = isRecurring
        ? (parseInt(recurringDurationDays) || 1)
        : Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

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

      const finalSlug = (slug && slug.trim()) ? slug.trim() : generateSlug(title);
      const tripData = {
        title,
        slug: finalSlug,
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
        duration_text: durationText.trim() || `${durationDays} ${durationDays === 1 ? 'day' : 'days'}`,
        max_participants: maxSeats ? parseInt(maxSeats) : null,
        current_participants: 0,
        // Recurring trips have no fixed start/end — departures are per-booking.
        start_date: isRecurring ? null : startDate,
        end_date: isRecurring ? null : endDate,
        booking_deadline_date: isRecurring ? null : bookingDeadline,
        is_recurring: isRecurring,
        recurrence_day: isRecurring ? parseInt(recurrenceDay) : null,
        recurrence_weeks_ahead: isRecurring ? (parseInt(recurrenceWeeksAhead) || 4) : 4,
        payment_due_days_before: paymentDueDaysBefore.trim() === '' ? null : (parseInt(paymentDueDaysBefore, 10) || null),
        cover_image_url: coverImage,
        image_url: coverImage,
        gallery_images: filteredGallery.length > 0 ? filteredGallery : null,
        highlights: filteredHighlights.length > 0 ? filteredHighlights : null,
        pickup_points: pickupPoints.map(p => p.trim()).filter(Boolean).length > 0 ? pickupPoints.map(p => p.trim()).filter(Boolean) : null,
        day_wise_itinerary: itinerary,
        whatsapp_group_link: whatsappGroupLink || null,
        included_features: includedItems.filter(item => item.trim()),
        free_perks: freePerks.filter(item => item.trim()),
        display_sections: showSections,
        excluded_features: excludedItems.filter(item => item.trim()).length > 0 ? excludedItems.filter(item => item.trim()) : null,
        status: publishOption === 'draft' ? 'draft' : publishOption === 'schedule' ? 'scheduled' : 'active',
        is_active: publishOption === 'now',
        scheduled_publish_at: publishOption === 'schedule' && scheduledPublishDate && scheduledPublishTime
          ? new Date(`${scheduledPublishDate}T${scheduledPublishTime}`).toISOString()
          : null,
        published_at: publishOption === 'now' ? new Date().toISOString() : null,
        addons_enabled: addonsEnabled,
      };

      const { data, error: insertError } = await supabase
        .from('trips')
        .insert([tripData])
        .select()
        .single();

      if (insertError) throw insertError;

      // Persist Trip Add-ons (best-effort; a failure here shouldn't lose the trip).
      if (data?.id && (addonsEnabled || addonDrafts.length > 0)) {
        try {
          const res = await fetch(`/api/admin/trips/${data.id}/addons`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              enabled: addonsEnabled,
              addons: addonDrafts.map((d, i) => draftToPayload(d, i)),
            }),
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || 'Failed to save add-ons');
          }
        } catch (addonErr: any) {
          setError(`Trip created, but add-ons failed to save: ${addonErr.message}. Edit the trip to retry.`);
        }
      }

      // Immediately refresh the cached public trips list so the new trip is
      // visible right away instead of after the 10-minute revalidate window.
      // Best-effort: never block trip creation on this.
      try {
        await fetch('/api/admin/revalidate-trips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tripId: data?.id }),
        });
      } catch {}

      setSuccess(true);
      setTimeout(() => {
        router.push('/admin/trips');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to create trip');
    } finally {
      setLoading(false);
    }
  };

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
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Create New Trip</h1>
          <p className="text-gray-600">Fill in the details to create an amazing travel experience</p>
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
            Trip created successfully! Redirecting...
          </div>
        )}

        {/* Step 1: Basic Information */}
        {currentStep === 1 && (
          <div className="bg-white rounded-2xl border border-purple-200 shadow-xl p-8 animate-fade-in-up">
            <div className="flex items-center mb-6">
              <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg sm:rounded-xl flex items-center justify-center mr-2 sm:mr-3 md:mr-4">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg md:text-2xl font-bold text-gray-900">Basic Information</h2>
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
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (!slugManuallyEdited) setSlug(generateSlug(e.target.value));
                  }}
                  required
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition-all text-gray-900 placeholder-gray-400 text-sm"
                  placeholder="e.g., Manali Snow Adventure"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Trip URL <span className="text-gray-400 font-normal">(auto-filled)</span>
                </label>
                <div className="flex items-center border border-gray-200 rounded-xl focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-100 transition-all overflow-hidden bg-gray-50">
                  <span className="pl-3 pr-1 text-xs sm:text-sm text-gray-500 select-none whitespace-nowrap">/trips/</span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => {
                      setSlug(generateSlug(e.target.value));
                      setSlugManuallyEdited(true);
                    }}
                    className="flex-1 px-1 sm:px-2 py-2.5 sm:py-3 bg-transparent outline-none text-gray-900 text-sm font-mono"
                    placeholder="manali-snow-adventure"
                    maxLength={80}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1.5">Used in the trip URL. Lowercase letters, numbers, and hyphens only.</p>
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
                  className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none resize-none transition-all text-gray-900 placeholder-gray-400"
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
                  className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none resize-none transition-all text-gray-900 placeholder-gray-400"
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
                  className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900 placeholder-gray-400"
                  placeholder="e.g., Goa, India"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Pricing */}
        {currentStep === 2 && (
          <div className="bg-white rounded-2xl border border-purple-200 shadow-xl p-8 animate-fade-in-up">
            <div className="flex items-center mb-6">
              <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg sm:rounded-xl flex items-center justify-center mr-2 sm:mr-3 md:mr-4">
                <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg md:text-2xl font-bold text-gray-900">Pricing Information</h2>
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
                    className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900"
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
                    className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900"
                  />
                  {price && discountedPrice && calculateDiscount() > 0 && (
                    <p className="text-sm text-green-600 font-medium mt-2">
                      {calculateDiscount()}% discount applied
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
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
                  className="w-full px-4 py-3.5 border border-purple-200 rounded-xl focus:border-purple-600 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900 bg-white"
                  placeholder="Partial payment amount"
                />
                <div className="mt-3 space-y-1 text-sm text-gray-600">
                  <p>• This amount locks a seat (non-refundable)</p>
                  <p>• The traveller is asked to pay the balance before the deadline below</p>
                </div>
                <div className="mt-4 pt-4 border-t border-purple-200">
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Balance due (days before departure)</label>
                  <input
                    type="number" min="0" step="1"
                    value={paymentDueDaysBefore}
                    onChange={(e) => setPaymentDueDaysBefore(e.target.value)}
                    placeholder="Leave blank for the global default"
                    className="w-full sm:w-64 px-3 py-2.5 border border-purple-200 rounded-lg bg-white text-gray-900 focus:border-purple-600 outline-none"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">Overrides the global setting for this trip only. Blank = use the global default.</p>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl p-5">
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
                        className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900"
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
                                className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white"
                              />
                              <span className="text-gray-400">to</span>
                              <input
                                type="date"
                                value={condition.value.split('|')[1] || ''}
                                onChange={(e) => {
                                  const dates = condition.value.split('|');
                                  updateEarlyBirdCondition(index, `${dates[0] || ''}|${e.target.value}`);
                                }}
                                className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white"
                              />
                            </div>
                          ) : (
                            <input
                              type={condition.type === 'user_limit' || condition.type === 'first_bookings' ? 'number' : 'text'}
                              value={condition.value}
                              onChange={(e) => updateEarlyBirdCondition(index, e.target.value)}
                              className="px-3 py-2 border border-gray-200 rounded-lg text-sm flex-1 text-gray-900 placeholder-gray-500 bg-white"
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
          <div className="bg-white rounded-2xl border border-purple-200 shadow-xl p-8 animate-fade-in-up">
            <div className="flex items-center mb-6">
              <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg sm:rounded-xl flex items-center justify-center mr-2 sm:mr-3 md:mr-4">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg md:text-2xl font-bold text-gray-900">Dates & Capacity</h2>
                <p className="text-gray-600 text-sm">Set trip dates and available seats</p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Recurring toggle */}
              <div className="p-4 rounded-xl border-2 border-purple-200 bg-purple-50/50">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <div>
                    <span className="font-bold text-gray-900">🔁 Recurring weekly trip</span>
                    <p className="text-xs text-gray-600">Departs the same weekday every week. Travellers pick their date at booking; seats count per departure.</p>
                  </div>
                </label>

                {isRecurring && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">Departs every</label>
                      <select
                        value={recurrenceDay}
                        onChange={(e) => setRecurrenceDay(e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-white text-gray-900 focus:border-purple-500 outline-none"
                      >
                        {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((d, i) => (
                          <option key={i} value={i}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">Bookable weeks ahead</label>
                      <input
                        type="number" min="1" max="26"
                        value={recurrenceWeeksAhead}
                        onChange={(e) => setRecurrenceWeeksAhead(e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-white text-gray-900 focus:border-purple-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">Days on trip (sets return date)</label>
                      <input
                        type="number" min="1" max="30"
                        value={recurringDurationDays}
                        onChange={(e) => setRecurringDurationDays(e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-white text-gray-900 focus:border-purple-500 outline-none"
                      />
                    </div>
                  </div>
                )}
                {isRecurring && (
                  <p className="text-[11px] text-gray-500 mt-3">
                    <strong>Days on trip</strong> is just the number used to auto-calculate each return date (e.g. Friday + {recurringDurationDays || 'N'} days). The wording travellers see comes from <strong>Duration Display</strong> below (e.g. &ldquo;6 Days / 5 Nights&rdquo;).
                  </p>
                )}
              </div>

              {!isRecurring && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Trip Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900"
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
                    min={startDate}
                    className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900"
                  />
                  {startDate && endDate && (
                    <p className="text-sm text-gray-600 mt-2">
                      Duration: {Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} days
                    </p>
                  )}
                </div>
              </div>
              )}

              {!isRecurring && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Booking Deadline <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={bookingDeadline}
                  onChange={(e) => setBookingDeadline(e.target.value)}
                  max={startDate}
                  className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900"
                />
                <p className="text-sm text-gray-600 mt-2">
                  Last date users can book this trip (must be before trip start)
                </p>
              </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Maximum Seats <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="number"
                  value={maxSeats}
                  onChange={(e) => setMaxSeats(e.target.value)}
                  min="1"
                  placeholder="Leave empty for unlimited"
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition-all text-gray-900 text-sm"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Leave empty if you don&apos;t want a seat cap. Users will see "Spots available" instead of an exact number.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Duration Display <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={durationText}
                  onChange={(e) => setDurationText(e.target.value)}
                  maxLength={40}
                  placeholder="e.g. 4N 5D or 4 Days / 3 Nights"
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition-all text-gray-900 text-sm"
                />
                <p className="text-xs text-gray-500 mt-2">
                  How duration shows everywhere. Leave empty to auto-fill from trip dates.
                </p>
              </div>

              {/* Pickup points */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Pickup Points <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setPickupPoints([...pickupPoints, ''])}
                    className="text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add point
                  </button>
                </div>
                <div className="space-y-2">
                  {pickupPoints.map((point, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={point}
                        onChange={(e) => {
                          const next = [...pickupPoints];
                          next[index] = e.target.value;
                          setPickupPoints(next);
                        }}
                        placeholder="e.g. Delhi (ISBT Kashmere Gate)"
                        className="flex-1 px-3 sm:px-4 py-2.5 border border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition-all text-gray-900 text-sm"
                      />
                      {pickupPoints.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setPickupPoints(pickupPoints.filter((_, i) => i !== index))}
                          className="px-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Travellers choose one of these at booking (e.g. Delhi, Chandigarh). Leave empty if there&rsquo;s a single fixed pickup.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Images */}
        {currentStep === 4 && (
          <div className="bg-white rounded-2xl border border-purple-200 shadow-xl p-8 animate-fade-in-up">
            <div className="flex items-center mb-6">
              <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg sm:rounded-xl flex items-center justify-center mr-2 sm:mr-3 md:mr-4">
                <ImageIcon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg md:text-2xl font-bold text-gray-900">Images</h2>
                <p className="text-gray-600 text-sm">Add cover and gallery images</p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Cover Image <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={coverImage}
                    onChange={(e) => setCoverImage(e.target.value)}
                    className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition-all text-gray-900 placeholder-gray-400 text-sm"
                    placeholder="Paste image URL or click upload"
                  />
                  <label className={`px-3 sm:px-4 py-2.5 sm:py-3 border border-purple-300 bg-purple-50 hover:bg-purple-100 rounded-xl cursor-pointer flex items-center gap-1.5 text-sm font-semibold text-purple-700 whitespace-nowrap ${uploadingCover ? 'opacity-50 pointer-events-none' : ''}`}>
                    {uploadingCover ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    <span>Upload</span>
                    <input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" disabled={uploadingCover} />
                  </label>
                </div>
                {coverImage && (
                  <div className="mt-3">
                    <img src={coverImage} alt="Cover preview" className="w-full h-48 object-cover rounded-xl border border-gray-200" />
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
                    <div key={index} className="flex gap-2">
                      <input
                        type="url"
                        value={image}
                        onChange={(e) => {
                          const updated = [...galleryImages];
                          updated[index] = e.target.value;
                          setGalleryImages(updated);
                        }}
                        className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition-all text-gray-900 placeholder-gray-400 text-sm"
                        placeholder="Paste URL or upload"
                      />
                      <label className={`px-3 py-2.5 sm:py-3 border border-purple-300 bg-purple-50 hover:bg-purple-100 rounded-xl cursor-pointer flex items-center text-sm text-purple-700 ${uploadingGallery === index ? 'opacity-50 pointer-events-none' : ''}`}>
                        {uploadingGallery === index ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        <input type="file" accept="image/*" onChange={(e) => handleGalleryUpload(index, e)} className="hidden" />
                      </label>
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
                          <img src={image} alt={`Gallery ${index + 1}`} className="w-full h-full object-cover rounded-lg border border-gray-200" />
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
          <div className="bg-white rounded-2xl border border-purple-200 shadow-xl p-8 animate-fade-in-up">
            <div className="flex items-center mb-6">
              <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg sm:rounded-xl flex items-center justify-center mr-2 sm:mr-3 md:mr-4">
                <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg md:text-2xl font-bold text-gray-900">Content & Itinerary</h2>
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
                        className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900 placeholder-gray-400"
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
                    <div key={dayIndex} className="border border-gray-200 rounded-xl p-5 bg-gray-50">
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
                            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900 placeholder-gray-400 bg-white"
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
                            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none resize-none transition-all text-gray-900 placeholder-gray-400 bg-white"
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
                                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:border-purple-500 outline-none text-gray-900 placeholder-gray-400 bg-white"
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
          <div className="bg-white rounded-2xl border border-purple-200 shadow-xl p-8 animate-fade-in-up">
            <div className="flex items-center mb-6">
              <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg sm:rounded-xl flex items-center justify-center mr-2 sm:mr-3 md:mr-4">
                <Check className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg md:text-2xl font-bold text-gray-900">Final Details</h2>
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
                  className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900 placeholder-gray-400"
                  placeholder="https://chat.whatsapp.com/..."
                />
                <div className="mt-3 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
                  <p className="text-sm text-blue-900">
                    <strong>Important:</strong> This WhatsApp group link will be shared with users only after their booking is <strong>confirmed</strong> (not for seat lock or pending bookings). Users will receive a notification with the group link upon booking confirmation.
                  </p>
                </div>
              </div>

              <TripAddonsEditor
                enabled={addonsEnabled}
                drafts={addonDrafts}
                onEnabledChange={setAddonsEnabled}
                onDraftsChange={setAddonDrafts}
                tripDurationDays={isRecurring
                  ? (parseInt(recurringDurationDays) || 3)
                  : (startDate && endDate
                      ? Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1)
                      : 3)}
              />

              <div className="p-4 sm:p-5 bg-gradient-to-br from-purple-50 to-purple-100/40 border border-purple-200 rounded-xl">
                <label className="block text-sm font-bold text-gray-900 mb-1 flex items-center">
                  <Sparkles className="h-4 w-4 text-purple-600 mr-1.5" />
                  Free Perks <span className="ml-2 text-xs text-gray-500 font-normal">(shown prominently — get attention)</span>
                </label>
                <p className="text-xs text-gray-600 mb-3">
                  Add free extras or conditional offers. Examples:<br />
                  &bull; "Free bike rental for first 10 bookings"<br />
                  &bull; "Group of 5+ gets ₹500 off"<br />
                  &bull; "20% off for the first 5 customers"<br />
                  &bull; "Free welcome drink on arrival"
                </p>
                {freePerks.map((perk, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={perk}
                      onChange={(e) => {
                        const updated = [...freePerks];
                        updated[index] = e.target.value;
                        setFreePerks(updated);
                      }}
                      className="flex-1 px-3 py-2 border border-purple-200 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none text-sm"
                      placeholder="e.g., Free welcome drink on arrival"
                    />
                    {freePerks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setFreePerks(freePerks.filter((_, i) => i !== index))}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setFreePerks([...freePerks, ''])}
                  className="text-sm text-purple-700 hover:text-purple-800 font-semibold flex items-center"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add another perk
                </button>
              </div>

              {/* Section Visibility Toggles */}
              <div className="p-4 sm:p-5 bg-blue-50/50 border border-blue-200 rounded-xl">
                <label className="block text-sm font-bold text-gray-900 mb-1">
                  Show on Trip Page
                </label>
                <p className="text-xs text-gray-600 mb-3">Pick which sections appear on the user-facing trip page.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {([
                    { key: 'photos', label: 'Photo carousel', desc: 'Swipeable gallery at top' },
                    { key: 'itinerary', label: 'Day-by-day plan', desc: 'Timeline of activities' },
                    { key: 'highlights', label: 'Trip highlights', desc: 'What you\'ll experience' },
                    { key: 'perks', label: 'Free perks banner', desc: 'Big purple promo banner' },
                    { key: 'included', label: 'Included / Not included', desc: 'Two-column list' },
                  ] as const).map(s => (
                    <label key={s.key} className="flex items-start gap-2.5 p-2.5 rounded-lg border border-gray-200 bg-white hover:border-blue-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showSections[s.key]}
                        onChange={(e) => setShowSections({ ...showSections, [s.key]: e.target.checked })}
                        className="w-4 h-4 mt-0.5 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{s.label}</p>
                        <p className="text-xs text-gray-500">{s.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  What&apos;s Included
                </label>
                <div className="space-y-2 mb-3">
                  {includedItems.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => {
                          const updated = [...includedItems];
                          updated[index] = e.target.value;
                          setIncludedItems(updated);
                        }}
                        className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900 placeholder-gray-400 bg-white"
                        placeholder="e.g., Accommodation, Breakfast, Guide"
                      />
                      {includedItems.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeIncludedItem(index)}
                          className="p-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors shrink-0"
                          title="Remove this item"
                          aria-label="Remove this item"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      ) : (
                        <span className="w-11 shrink-0" aria-hidden />
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addIncludedItem}
                  className="flex items-center gap-2 px-4 py-2.5 text-purple-600 hover:bg-purple-50 border-2 border-dashed border-purple-200 rounded-xl transition-colors font-medium text-sm"
                >
                  <Plus className="h-5 w-5 shrink-0" />
                  Add included item
                </button>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  What&apos;s Not Included
                </label>
                <div className="space-y-2 mb-3">
                  {excludedItems.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => {
                          const updated = [...excludedItems];
                          updated[index] = e.target.value;
                          setExcludedItems(updated);
                        }}
                        className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900 placeholder-gray-400 bg-white"
                        placeholder="e.g., Lunch, Dinner, Personal expenses"
                      />
                      {excludedItems.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeExcludedItem(index)}
                          className="p-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors shrink-0"
                          title="Remove this item"
                          aria-label="Remove this item"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      ) : (
                        <span className="w-11 shrink-0" aria-hidden />
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addExcludedItem}
                  className="flex items-center gap-2 px-4 py-2.5 text-purple-600 hover:bg-purple-50 border-2 border-dashed border-purple-200 rounded-xl transition-colors font-medium text-sm"
                >
                  <Plus className="h-5 w-5 shrink-0" />
                  Add not included item
                </button>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Pickup Location (Optional)
                </label>
                <input
                  type="text"
                  value={pickupLocation}
                  onChange={(e) => setPickupLocation(e.target.value)}
                  className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900 placeholder-gray-400"
                  placeholder="e.g., Central Railway Station, Mumbai"
                />
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
            <div className="space-y-4">
              {/* Publish Options */}
              <div className="bg-white rounded-xl border border-purple-200 p-6 mb-4">
                <h3 className="font-bold text-gray-900 mb-4">Publish Options</h3>
                <div className="space-y-3">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="publishOption"
                      value="draft"
                      checked={publishOption === 'draft'}
                      onChange={(e) => setPublishOption(e.target.value as any)}
                      className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                    />
                    <div>
                      <span className="font-medium text-gray-900">Save as Draft</span>
                      <p className="text-sm text-gray-600">Save trip without publishing</p>
                    </div>
                  </label>
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="publishOption"
                      value="now"
                      checked={publishOption === 'now'}
                      onChange={(e) => setPublishOption(e.target.value as any)}
                      className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                    />
                    <div>
                      <span className="font-medium text-gray-900">Publish Now</span>
                      <p className="text-sm text-gray-600">Make trip live immediately</p>
                    </div>
                  </label>
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="publishOption"
                      value="schedule"
                      checked={publishOption === 'schedule'}
                      onChange={(e) => setPublishOption(e.target.value as any)}
                      className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                    />
                    <div className="flex-1">
                      <span className="font-medium text-gray-900">Schedule Publish</span>
                      <p className="text-sm text-gray-600 mb-2">Set a date and time to publish</p>
                      {publishOption === 'schedule' && (
                        <div className="flex gap-3 mt-2">
                          <input
                            type="date"
                            value={scheduledPublishDate}
                            onChange={(e) => setScheduledPublishDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                          />
                          <input
                            type="time"
                            value={scheduledPublishTime}
                            onChange={(e) => setScheduledPublishTime(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                          />
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || (publishOption === 'schedule' && (!scheduledPublishDate || !scheduledPublishTime))}
                className="w-full px-8 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-semibold hover:from-green-700 hover:to-green-800 transition-all shadow-lg hover:shadow-xl flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    {publishOption === 'draft' ? (
                      <>
                        <Save className="h-5 w-5" />
                        <span>Save as Draft</span>
                      </>
                    ) : publishOption === 'now' ? (
                      <>
                        <Send className="h-5 w-5" />
                        <span>Publish Now</span>
                      </>
                    ) : (
                      <>
                        <Clock className="h-5 w-5" />
                        <span>Schedule Publish</span>
                      </>
                    )}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
