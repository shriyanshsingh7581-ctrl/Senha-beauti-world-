/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Check,
  Clock,
  ExternalLink,
  Home,
  Image as ImageIcon,
  Instagram,
  MapPin,
  MessageCircle,
  Phone,
  Sparkles,
  Star,
} from 'lucide-react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  auth,
  db,
  signInWithGoogle,
  logOutUser,
  handleFirestoreError,
} from './firebase';
import {
  ServiceItem,
  ServiceCategory,
  GalleryItem,
  GalleryCategory,
  AppointmentItem,
  InquiryItem,
  SiteSettings,
  OperationType,
} from './types';
import {
  INITIAL_SERVICES,
  INITIAL_GALLERY,
  INITIAL_SITE_SETTINGS,
  INITIAL_REVIEWS,
  INITIAL_DEMO_APPOINTMENTS,
} from './data/initialData';
import { LuxuryArtCanvas } from './components/LuxuryArtCanvas';
import { BookingModal } from './components/BookingModal';
import { AdminPanel } from './components/AdminPanel';

const STORAGE_KEYS = {
  SERVICES: 'sbw_services_v1',
  GALLERY: 'sbw_gallery_v1',
  APPOINTMENTS: 'sbw_appointments_v1',
  INQUIRIES: 'sbw_inquiries_v1',
  SETTINGS: 'sbw_settings_v1',
};

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  // Route state: supports direct /admin path or hash #admin
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(() => {
    return (
      window.location.pathname.startsWith('/admin') ||
      window.location.hash === '#admin'
    );
  });

  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Core Application State (Hydrated with Initial Luxury Data + Local Persistence + Firestore Real-Time Sync)
  const [services, setServices] = useState<ServiceItem[]>(() =>
    loadFromStorage(STORAGE_KEYS.SERVICES, INITIAL_SERVICES)
  );
  const [gallery, setGallery] = useState<GalleryItem[]>(() =>
    loadFromStorage(STORAGE_KEYS.GALLERY, INITIAL_GALLERY)
  );
  const [appointments, setAppointments] = useState<AppointmentItem[]>(() =>
    loadFromStorage(STORAGE_KEYS.APPOINTMENTS, INITIAL_DEMO_APPOINTMENTS)
  );
  const [inquiries, setInquiries] = useState<InquiryItem[]>(() =>
    loadFromStorage(STORAGE_KEYS.INQUIRIES, [])
  );
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(() =>
    loadFromStorage(STORAGE_KEYS.SETTINGS, INITIAL_SITE_SETTINGS)
  );

  // UI Filter & Modal States
  const [serviceFilter, setServiceFilter] = useState<'All' | ServiceCategory>('All');
  const [galleryFilter, setGalleryFilter] = useState<'All' | GalleryCategory>('All');
  const [beforeAfterMode, setBeforeAfterMode] = useState<Record<string, 'after' | 'before'>>({});
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedServiceForBooking, setSelectedServiceForBooking] =
    useState<ServiceItem | null>(null);

  // Footer Inquiry Form State
  const [inqName, setInqName] = useState('');
  const [inqPhone, setInqPhone] = useState('');
  const [inqMessage, setInqMessage] = useState('');
  const [inqSubmitted, setInqSubmitted] = useState(false);

  // Sync LocalStorage whenever state updates
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(services));
    } catch {
      // ignore quota errors
    }
  }, [services]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.GALLERY, JSON.stringify(gallery));
    } catch {
      // ignore
    }
  }, [gallery]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(appointments));
    } catch {
      // ignore
    }
  }, [appointments]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.INQUIRIES, JSON.stringify(inquiries));
    } catch {
      // ignore
    }
  }, [inquiries]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(siteSettings));
    } catch {
      // ignore
    }
  }, [siteSettings]);

  // Listen to browser back/forward for /admin
  useEffect(() => {
    const handlePopState = () => {
      setIsAdminRoute(
        window.location.pathname.startsWith('/admin') ||
          window.location.hash === '#admin'
      );
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Track Firebase Auth State
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Real-time Firestore Listeners for Public Catalog & Authenticated Bookings
  useEffect(() => {
    if (!isAuthReady) return;

    const isVerifiedAdmin =
      Boolean(currentUser?.emailVerified) &&
      currentUser?.email === 'singhshriyansh51@gmail.com';

    // 1. Site Settings Listener
    const unsubSettings = onSnapshot(
      doc(db, 'settings', 'general'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as SiteSettings;
          setSiteSettings((prev) => ({ ...prev, ...data }));
        }
      },
      (err) => {
        console.warn('Settings listener info:', err.message);
      }
    );

    // 2. Services Catalog Listener (filtered by isActive == true for public visitors)
    const servicesQuery = isVerifiedAdmin
      ? collection(db, 'services')
      : query(collection(db, 'services'), where('isActive', '==', true));

    const unsubServices = onSnapshot(
      servicesQuery,
      (snap) => {
        if (!snap.empty) {
          const cloudServices: ServiceItem[] = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<ServiceItem, 'id'>),
          }));
          setServices(cloudServices);
        }
      },
      (err) => {
        console.warn('Services listener info:', err.message);
      }
    );

    // 3. Bridal Gallery Listener
    const galleryQuery = isVerifiedAdmin
      ? collection(db, 'gallery')
      : query(collection(db, 'gallery'), where('isPublished', '==', true));

    const unsubGallery = onSnapshot(
      galleryQuery,
      (snap) => {
        if (!snap.empty) {
          const cloudGallery: GalleryItem[] = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<GalleryItem, 'id'>),
          }));
          setGallery(cloudGallery);
        }
      },
      (err) => {
        console.warn('Gallery listener info:', err.message);
      }
    );

    // 4. Appointments Listener (Only when signed in, enforcing PII isolation rules)
    let unsubAppointments: (() => void) | undefined;
    if (currentUser) {
      const aptQuery = isVerifiedAdmin
        ? collection(db, 'appointments')
        : query(
            collection(db, 'appointments'),
            where('clientUid', '==', currentUser.uid)
          );

      unsubAppointments = onSnapshot(
        aptQuery,
        (snap) => {
          if (!snap.empty) {
            const cloudApts: AppointmentItem[] = snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<AppointmentItem, 'id'>),
            }));
            setAppointments((prev) => {
              const map = new Map<string, AppointmentItem>();
              prev.forEach((p) => map.set(p.id, p));
              cloudApts.forEach((c) => map.set(c.id, c));
              return Array.from(map.values());
            });
          }
        },
        (err) => {
          console.warn('Appointments listener info:', err.message);
        }
      );
    }

    return () => {
      unsubSettings();
      unsubServices();
      unsubGallery();
      if (unsubAppointments) unsubAppointments();
    };
  }, [isAuthReady, currentUser]);

  // Seed Cloud Firestore with initial services, gallery, and site settings when Admin clicks sync
  const handleSeedCloudDatabase = async () => {
    if (!currentUser) return;
    try {
      await setDoc(doc(db, 'settings', 'general'), {
        brandName: siteSettings.brandName.slice(0, 80),
        tagline: siteSettings.tagline.slice(0, 120),
        phone: siteSettings.phone.slice(0, 30),
        whatsappNumber: siteSettings.whatsappNumber.slice(0, 25),
        instagramHandle: siteSettings.instagramHandle.slice(0, 60),
        instagramUrl: siteSettings.instagramUrl.slice(0, 250),
        openingHours: siteSettings.openingHours.slice(0, 160),
        address: siteSettings.address.slice(0, 250),
        announcementText: siteSettings.announcementText.slice(0, 200),
        cloudinaryCloudName: siteSettings.cloudinaryCloudName.slice(0, 80),
        cloudinaryUploadPreset: siteSettings.cloudinaryUploadPreset.slice(0, 80),
        updatedAt: serverTimestamp(),
      });

      for (const srv of services) {
        const safeImageUrl =
          srv.imageUrl.length <= 500 ? srv.imageUrl : 'art:bridal_hd';
        await setDoc(doc(db, 'services', srv.id), {
          title: srv.title.slice(0, 120),
          category: srv.category,
          subCategory: srv.subCategory.slice(0, 80),
          price: Number(srv.price),
          originalPrice: Number(srv.originalPrice),
          duration: srv.duration.slice(0, 40),
          description: srv.description.slice(0, 600),
          inclusions: srv.inclusions.slice(0, 8),
          imageUrl: safeImageUrl,
          isActive: Boolean(srv.isActive),
          isFeatured: Boolean(srv.isFeatured),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      for (const item of gallery) {
        const safeImageUrl =
          item.imageUrl.length <= 500 ? item.imageUrl : 'art:gal_bridal_1';
        await setDoc(doc(db, 'gallery', item.id), {
          title: item.title.slice(0, 120),
          category: item.category,
          clientName: item.clientName.slice(0, 80),
          description: item.description.slice(0, 400),
          beforeLabel: item.beforeLabel.slice(0, 160),
          afterLabel: item.afterLabel.slice(0, 160),
          imageUrl: safeImageUrl,
          instagramUrl: item.instagramUrl.slice(0, 300),
          isPublished: Boolean(item.isPublished),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'seed_catalog');
    }
  };

  const navigateToAdmin = () => {
    window.history.pushState({}, '', '/admin');
    setIsAdminRoute(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToStorefront = () => {
    window.history.pushState({}, '', '/');
    setIsAdminRoute(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openBookingWithService = (srv: ServiceItem | null = null) => {
    setSelectedServiceForBooking(srv);
    setIsBookingModalOpen(true);
  };

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = inqName.trim().slice(0, 100);
    const cleanPhone = inqPhone.trim().slice(0, 25);
    const cleanMsg = inqMessage.trim().slice(0, 600);
    if (cleanName.length < 2 || cleanPhone.length < 7 || cleanMsg.length < 5) return;

    const id = `inq_${Date.now()}`;
    const newInquiry: InquiryItem = {
      id,
      clientUid: currentUser?.uid || `guest_${Date.now()}`,
      name: cleanName,
      phone: cleanPhone,
      message: cleanMsg,
      status: 'New',
      createdAt: new Date().toISOString(),
    };

    setInquiries((prev) => [newInquiry, ...prev]);

    if (currentUser && currentUser.emailVerified) {
      try {
        await setDoc(doc(db, 'inquiries', id), {
          clientUid: currentUser.uid,
          name: cleanName,
          phone: cleanPhone,
          message: cleanMsg,
          status: 'New',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Inquiry stored locally:', err);
      }
    }

    setInqName('');
    setInqPhone('');
    setInqMessage('');
    setInqSubmitted(true);
    setTimeout(() => setInqSubmitted(false), 5000);
  };

  // Render Admin Console if /admin route is active
  if (isAdminRoute) {
    return (
      <AdminPanel
        currentUser={currentUser}
        onSignInGoogle={async () => {
          await signInWithGoogle();
        }}
        onSignOut={async () => {
          await logOutUser();
        }}
        onExitAdmin={navigateToStorefront}
        services={services}
        setServices={setServices}
        gallery={gallery}
        setGallery={setGallery}
        appointments={appointments}
        setAppointments={setAppointments}
        inquiries={inquiries}
        setInquiries={setInquiries}
        siteSettings={siteSettings}
        setSiteSettings={setSiteSettings}
        onSeedCloudDatabase={handleSeedCloudDatabase}
      />
    );
  }

  const visibleServices = services.filter(
    (s) => s.isActive && (serviceFilter === 'All' || s.category === serviceFilter)
  );

  const visibleGallery = gallery.filter(
    (g) => g.isPublished && (galleryFilter === 'All' || g.category === galleryFilter)
  );

  const directWhatsAppUrl = `https://wa.me/${siteSettings.whatsappNumber}?text=${encodeURIComponent(
    `Hello ${siteSettings.brandName}! I would like to inquire about bridal & salon packages.`
  )}`;

  return (
    <div id="top" className="min-h-screen bg-[#0D0D11] text-[#F5F0EB] pb-20 md:pb-0">
      {/* 1. TOP BAR CONTRACT: Strictly 1-row, 3-zone navigation header */}
      <header className="sticky top-0 z-30 h-16 bg-[#0D0D11]/90 backdrop-blur-md border-b border-[#232029] px-4 sm:px-8 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Logo & Wordmark */}
        <a
          href="#top"
          className="flex items-center gap-3 text-xl sm:text-2xl font-semibold tracking-tight text-[#F5F0EB] font-serif-luxury whitespace-nowrap shrink-0"
        >
          <img
            src="/assets/aistudio/IMG-20261027-WA0047_89a5906b.jpg"
            alt={siteSettings.brandName}
            className="w-11 h-11 rounded-full object-cover border border-[#D4AF37]/50 shadow-md shadow-[#D4AF37]/10 shrink-0"
          />
          <span>{siteSettings.brandName}</span>
        </a>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#B5ADA6]">
          <a
            href="#services"
            className="hover:text-[#E0A996] transition-colors whitespace-nowrap shrink-0"
          >
            Services
          </a>
          <a
            href="#gallery"
            className="hover:text-[#E0A996] transition-colors whitespace-nowrap shrink-0"
          >
            Bridal Gallery
          </a>
          <a
            href="#reviews"
            className="hover:text-[#E0A996] transition-colors whitespace-nowrap shrink-0"
          >
            Reviews
          </a>
          <a
            href="#contact"
            className="hover:text-[#E0A996] transition-colors whitespace-nowrap shrink-0"
          >
            Contact
          </a>
          <button
            type="button"
            onClick={navigateToAdmin}
            className="hover:text-[#D4AF37] transition-colors whitespace-nowrap shrink-0"
          >
            Admin Studio
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => openBookingWithService(null)}
            className="min-h-[42px] px-5 py-2 rounded-xl bg-gradient-to-r from-[#E0A996] to-[#D4AF37] text-[#0D0D11] text-xs sm:text-sm font-semibold hover:opacity-95 transition-opacity whitespace-nowrap shrink-0"
          >
            Book Appointment
          </button>
        </div>
      </header>

      {/* Non-sticky Announcement Ribbon (keeps mobile sticky height <= 15%) */}
      <div className="bg-[#16141C] border-b border-[#26222C] px-4 py-2 text-center">
        <p className="text-xs text-[#E0A996] tracking-wide max-w-4xl mx-auto truncate">
          {siteSettings.announcementText}
        </p>
      </div>

      {/* 2. HERO SECTION: 2-Column Editorial Split + Full-Width Proof Strip */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 pt-8 pb-14 lg:py-16 space-y-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
          {/* Left Column: Editorial Bridal Pitch & Quick Actions */}
          <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
            <div className="flex items-center gap-4">
              <img
                src="/assets/aistudio/IMG-20261027-WA0047_89a5906b.jpg"
                alt={`${siteSettings.brandName} Emblem`}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-[#D4AF37]/60 shadow-xl shadow-[#E0A996]/15 shrink-0"
              />
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#E0A996] tracking-wide">
                  <span>{siteSettings.brandName}</span>
                  <span aria-hidden="true">·</span>
                  <span>{siteSettings.tagline}</span>
                </div>
                <p className="text-xs text-[#B5ADA6]">
                  Luxury Bridal Makeup &amp; Aesthetics Salon
                </p>
              </div>
            </div>

            <h1
              className="font-serif-luxury font-semibold text-[#F5F0EB] tracking-tight leading-[1.12]"
              style={{ fontSize: 'clamp(2.25rem, 4vw, 3.75rem)' }}
            >
              Timeless Bridal Artistry &amp; Luminous Skin Couture.
            </h1>

            <p className="text-base text-[#B5ADA6] leading-relaxed max-w-2xl">
              Experience 18-hour waterproof HD and 24K silicone airbrush bridal transformations,
              Korean glass-skin Hydra facials, Brazilian Botoplex hair rituals, and architectural
              saree draping tailored exclusively to Indian skin undertones.
            </p>

            {/* Primary & Direct Contact Actions */}
            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              <button
                type="button"
                onClick={() => openBookingWithService(services[0] || null)}
                className="min-h-[48px] px-7 py-3 rounded-xl bg-gradient-to-r from-[#E0A996] to-[#D4AF37] text-[#0D0D11] font-semibold text-sm inline-flex items-center gap-2 shadow-lg hover:opacity-95 transition-opacity whitespace-nowrap"
              >
                <Calendar className="w-4 h-4" />
                Reserve Bridal or Salon Slot
              </button>

              <a
                href={directWhatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[48px] px-5 py-3 rounded-xl bg-[#16161E] border border-[#2D2936] hover:border-[#D4AF37] text-[#F5F0EB] text-sm font-medium inline-flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                <MessageCircle className="w-4 h-4 text-[#D4AF37]" />
                WhatsApp Concierge
              </a>

              <a
                href={`tel:${siteSettings.phone.replace(/\s+/g, '')}`}
                className="min-h-[48px] px-5 py-3 rounded-xl bg-[#16161E] border border-[#2D2936] hover:border-[#E0A996] text-[#B5ADA6] hover:text-[#F5F0EB] text-sm font-mono tabular-nums inline-flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                <Phone className="w-4 h-4 text-[#E0A996]" />
                {siteSettings.phone}
              </a>
            </div>

            {/* Quiet Unboxed Metadata Highlights */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 text-xs text-[#8E8782]">
              <span>TEMPTU Silicone Airbrush</span>
              <span aria-hidden="true">·</span>
              <span>O3+ &amp; Korean Hydra Technology</span>
              <span aria-hidden="true">·</span>
              <span>Nauvari, Bengali &amp; Gujarati Saree Draping</span>
            </div>
          </div>

          {/* Right Column: Luxury Bridal Visual Anchor */}
          <div className="lg:col-span-5 flex">
            <div className="relative w-full min-h-[340px] lg:h-full rounded-3xl overflow-hidden border border-[#2C2733] bg-[#16161E] group flex flex-col justify-end">
              <div className="absolute inset-0">
                <LuxuryArtCanvas
                  imageUrl={services[0]?.imageUrl}
                  alt="Sneha Beauty World Signature Bridal Artistry"
                  variant="hero"
                  className="w-full h-full"
                />
              </div>

              <div className="relative z-10 p-6 sm:p-8 space-y-2 bg-gradient-to-t from-[#0D0D11] via-[#0D0D11]/75 to-transparent">
                <p className="text-xs text-[#D4AF37] tracking-wide">
                  2026 Bridal Couture Collection
                </p>
                <h2 className="text-xl font-semibold font-serif-luxury text-[#F5F0EB]">
                  24K Silicone Airbrush &amp; Royal HD Bridal Look
                </h2>
                <div className="flex items-center justify-between pt-1 text-xs text-[#B5ADA6]">
                  <span>Includes Hairdo, Lashes &amp; Saree Draping</span>
                  <button
                    type="button"
                    onClick={() => openBookingWithService(services[1] || services[0])}
                    className="text-[#E0A996] hover:underline font-medium whitespace-nowrap"
                  >
                    Book Package →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Full-Width 4-Column Quantitative Proof Strip Below Hero Split */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          <div className="rounded-2xl bg-[#16161E] border border-[#25222C] p-5 space-y-1">
            <p className="text-2xl sm:text-3xl font-semibold text-[#D4AF37] font-mono tabular-nums">
              1,000+
            </p>
            <p className="text-sm font-medium text-[#F5F0EB]">Happy Brides Styled</p>
            <p className="text-xs text-[#8E8782]">Across HD, Airbrush &amp; Engagement Looks</p>
          </div>

          <div className="rounded-2xl bg-[#16161E] border border-[#25222C] p-5 space-y-1">
            <p className="text-2xl sm:text-3xl font-semibold text-[#E0A996] font-mono tabular-nums">
              18 Hrs
            </p>
            <p className="text-sm font-medium text-[#F5F0EB]">Sweat &amp; Tear Resistance</p>
            <p className="text-xs text-[#8E8782]">Certified International Luxury Pigments</p>
          </div>

          <div className="rounded-2xl bg-[#16161E] border border-[#25222C] p-5 space-y-1">
            <p className="text-2xl sm:text-3xl font-semibold text-[#F5F0EB] font-mono tabular-nums">
              100%
            </p>
            <p className="text-sm font-medium text-[#F5F0EB]">Certified Beauty Experts</p>
            <p className="text-xs text-[#8E8782]">Skin, Hair, Spa &amp; Heritage Saree Draping</p>
          </div>

          <div className="rounded-2xl bg-[#16161E] border border-[#25222C] p-5 space-y-1">
            <p className="text-2xl sm:text-3xl font-semibold text-[#D4AF37] font-mono tabular-nums">
              4.9 / 5.0
            </p>
            <p className="text-sm font-medium text-[#F5F0EB]">Verified Client Rating</p>
            <p className="text-xs text-[#8E8782]">From 420+ Bridal &amp; Aesthetics Reviews</p>
          </div>
        </div>
      </section>

      {/* 3. SERVICES EXPLORER: Interactive Category Filter & Contiguous Price Cards */}
      <section
        id="services"
        className="max-w-7xl mx-auto px-4 sm:px-8 py-14 border-t border-[#1F1C26] space-y-8"
      >
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <p className="text-xs text-[#E0A996] tracking-wide">
              01. Curated Salon &amp; Bridal Menu
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold font-serif-luxury text-[#F5F0EB]">
              Signature Treatments &amp; Bridal Packages
            </h2>
            <p className="text-sm text-[#B5ADA6] max-w-2xl">
              Transparent tariff cards with session duration and full step-by-step inclusions.
            </p>
          </div>

          {/* Interactive Category Filter Controls */}
          <div
            className="flex items-center gap-1.5 p-1.5 bg-[#16161E] border border-[#26232D] rounded-2xl overflow-x-auto"
            role="tablist"
            aria-label="Filter services by category"
          >
            {(
              [
                { id: 'All', label: 'All Services' },
                { id: 'Bridal', label: 'Bridal Makeup' },
                { id: 'Skin', label: 'Facial & Skin' },
                { id: 'Hair', label: 'Hair Treatment' },
                { id: 'Massage', label: 'Body Spa' },
                { id: 'Draping', label: 'Saree Draping' },
              ] as const
            ).map((cat) => (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={serviceFilter === cat.id}
                onClick={() => setServiceFilter(cat.id)}
                className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  serviceFilter === cat.id
                    ? 'bg-gradient-to-r from-[#E0A996] to-[#D4AF37] text-[#0D0D11] font-semibold shadow-sm'
                    : 'text-[#B5ADA6] hover:text-[#F5F0EB]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* 3-Column Desktop / 2-Column Tablet / 1-Column Mobile Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {visibleServices.map((srv) => (
            <article
              key={srv.id}
              className="group rounded-3xl bg-[#16161E] border border-[#26232E] hover:border-[#E0A996]/50 overflow-hidden flex flex-col justify-between transition-transform duration-200 hover:-translate-y-0.5"
            >
              <div>
                {/* 4:3 Service Visual */}
                <div className="aspect-[4/3] w-full overflow-hidden bg-[#121117]">
                  <LuxuryArtCanvas
                    imageUrl={srv.imageUrl}
                    alt={srv.title}
                    variant={srv.category.toLowerCase() as 'bridal'}
                  />
                </div>

                {/* Card Body */}
                <div className="p-6 space-y-3">
                  {/* Unboxed Metadata Line */}
                  <div className="flex items-center gap-2 text-xs text-[#E0A996]">
                    <span>{srv.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>{srv.subCategory}</span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 font-mono tabular-nums text-[#B5ADA6]">
                      <Clock className="w-3 h-3" /> {srv.duration}
                    </span>
                  </div>

                  <h3 className="text-lg font-semibold font-serif-luxury text-[#F5F0EB]">
                    {srv.title}
                  </h3>

                  <p className="text-xs text-[#B5ADA6] leading-relaxed">{srv.description}</p>

                  {/* Service Inclusions List */}
                  <div className="pt-2 border-t border-[#23202B] space-y-1.5">
                    <p className="text-[11px] font-medium text-[#8E8782]">
                      Ritual Inclusions:
                    </p>
                    <ul className="space-y-1">
                      {srv.inclusions.slice(0, 4).map((inc, idx) => (
                        <li
                          key={idx}
                          className="text-xs text-[#D5CEC8] flex items-center gap-2"
                        >
                          <Check className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                          <span className="truncate">{inc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Price & Book Now Footer */}
              <div className="px-6 py-4 bg-[#121118] border-t border-[#23202B] flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-semibold text-[#D4AF37] font-mono tabular-nums">
                      ₹{srv.price.toLocaleString('en-IN')}
                    </span>
                    {srv.originalPrice > srv.price && (
                      <span className="text-xs text-[#6E6864] line-through font-mono tabular-nums">
                        ₹{srv.originalPrice.toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#8E8782]">Inclusive of luxury products</p>
                </div>

                <button
                  type="button"
                  onClick={() => openBookingWithService(srv)}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-gradient-to-r from-[#E0A996] to-[#D4AF37] text-[#0D0D11] font-semibold text-xs hover:opacity-95 transition-opacity whitespace-nowrap shrink-0"
                >
                  Book Now
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 4. BRIDAL TRANSFORMATION & GALLERY: Filterable Portfolio with Before/After Comparison */}
      <section
        id="gallery"
        className="max-w-7xl mx-auto px-4 sm:px-8 py-14 border-t border-[#1F1C26] space-y-8"
      >
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <p className="text-xs text-[#E0A996] tracking-wide">
              02. Real Brides &amp; Transformations
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold font-serif-luxury text-[#F5F0EB]">
              Bridal Transformation &amp; Lookbook Gallery
            </h2>
            <p className="text-sm text-[#B5ADA6] max-w-2xl">
              Inspect before and after transformation notes across our signature bridal, glass-skin,
              hair botoplex, and heritage saree draping sessions.
            </p>
          </div>

          <div
            className="flex items-center gap-1.5 p-1.5 bg-[#16161E] border border-[#26232D] rounded-2xl overflow-x-auto"
            role="tablist"
            aria-label="Filter bridal gallery"
          >
            {(['All', 'Bridal', 'Skin', 'Hair', 'Draping'] as const).map((tag) => (
              <button
                key={tag}
                type="button"
                role="tab"
                aria-selected={galleryFilter === tag}
                onClick={() => setGalleryFilter(tag)}
                className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  galleryFilter === tag
                    ? 'bg-gradient-to-r from-[#E0A996] to-[#D4AF37] text-[#0D0D11] font-semibold'
                    : 'text-[#B5ADA6] hover:text-[#F5F0EB]'
                }`}
              >
                {tag === 'All' ? 'All Looks (8)' : tag}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {visibleGallery.map((item) => {
            const currentView = beforeAfterMode[item.id] || 'after';
            return (
              <article
                key={item.id}
                className="group rounded-3xl bg-[#16161E] border border-[#26232E] overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="relative aspect-[4/3] w-full overflow-hidden">
                    <LuxuryArtCanvas
                      imageUrl={item.imageUrl}
                      alt={item.title}
                      variant={item.category.toLowerCase() as 'bridal'}
                    />

                    {/* Interactive Before / After Comparison Switcher */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 bg-[#0D0D11]/90 backdrop-blur-md border border-[#2E2938] rounded-xl p-1">
                      <button
                        type="button"
                        onClick={() =>
                          setBeforeAfterMode((prev) => ({ ...prev, [item.id]: 'before' }))
                        }
                        className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap ${
                          currentView === 'before'
                            ? 'bg-[#2B2635] text-[#E0A996]'
                            : 'text-[#8E8782] hover:text-[#F5F0EB]'
                        }`}
                      >
                        Before Prep
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setBeforeAfterMode((prev) => ({ ...prev, [item.id]: 'after' }))
                        }
                        className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap ${
                          currentView === 'after'
                            ? 'bg-gradient-to-r from-[#E0A996] to-[#D4AF37] text-[#0D0D11] font-semibold'
                            : 'text-[#8E8782] hover:text-[#F5F0EB]'
                        }`}
                      >
                        After Glow
                      </button>
                    </div>
                  </div>

                  <div className="p-5 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs text-[#E0A996]">
                      <span>{item.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>Client: {item.clientName}</span>
                    </div>

                    <h3 className="text-base font-semibold font-serif-luxury text-[#F5F0EB]">
                      {item.title}
                    </h3>

                    {/* Dynamic Before vs After Diagnostic Callout */}
                    <div className="p-3 rounded-xl bg-[#111016] border border-[#25222D] text-xs space-y-1">
                      <p className="text-[11px] font-medium text-[#D4AF37]">
                        {currentView === 'before'
                          ? 'Initial Skin / Hair Assessment:'
                          : 'Final Transformation Outcome:'}
                      </p>
                      <p className="text-[#D5CEC8] leading-relaxed">
                        {currentView === 'before' ? item.beforeLabel : item.afterLabel}
                      </p>
                    </div>

                    <p className="text-xs text-[#8E8782] leading-relaxed">{item.description}</p>
                  </div>
                </div>

                <div className="px-5 py-3.5 bg-[#121118] border-t border-[#23202B] flex items-center justify-between text-xs">
                  <a
                    href={item.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#E0A996] hover:underline inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Instagram className="w-3.5 h-3.5" />
                    {siteSettings.instagramHandle}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => openBookingWithService(null)}
                    className="text-[#D4AF37] hover:underline font-medium whitespace-nowrap"
                  >
                    Book Similar →
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* 5. CUSTOMER REVIEWS & RATINGS: Attributable 5-Star Bridal & Salon Testimonials */}
      <section
        id="reviews"
        className="max-w-7xl mx-auto px-4 sm:px-8 py-14 border-t border-[#1F1C26] space-y-8"
      >
        <div className="space-y-2">
          <p className="text-xs text-[#E0A996] tracking-wide">
            03. Verified Client Testimonials
          </p>
          <h2 className="text-2xl sm:text-3xl font-semibold font-serif-luxury text-[#F5F0EB]">
            Loved by Over 1,000+ Brides &amp; Aesthetics Clients
          </h2>
          <p className="text-sm text-[#B5ADA6] max-w-2xl">
            Real stories of long-wear bridal perfection, glass-skin facials, and effortless silk
            saree draping.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {INITIAL_REVIEWS.map((rev) => (
            <div
              key={rev.id}
              className="rounded-3xl bg-[#16161E] border border-[#26232E] p-6 sm:p-7 flex flex-col justify-between space-y-5"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-[#D4AF37]" aria-label="5 out of 5 stars">
                    {Array.from({ length: rev.rating }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-[#D4AF37]" />
                    ))}
                  </div>
                  <span className="text-xs text-[#8E8782]">{rev.dateLabel}</span>
                </div>

                <p className="text-sm text-[#F5F0EB] leading-relaxed">
                  &ldquo;{rev.quote}&rdquo;
                </p>
              </div>

              <div className="pt-4 border-t border-[#23202B] space-y-1">
                <p className="text-sm font-semibold font-serif-luxury text-[#F5F0EB]">
                  {rev.clientName}
                </p>
                <p className="text-xs text-[#B5ADA6]">{rev.roleOrEvent}</p>
                <p className="text-xs text-[#E0A996] pt-1">
                  Outcome: {rev.outcomeHighlight}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. LOCATION, CONTACT & INQUIRY FOOTER */}
      <footer
        id="contact"
        className="border-t border-[#23202B] bg-[#111016] pt-14 pb-12 px-4 sm:px-8"
      >
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 pb-12 border-b border-[#221F2A]">
          {/* Studio Contact & Timings */}
          <div className="lg:col-span-6 space-y-5">
            <div className="flex items-center gap-4">
              <img
                src="/assets/aistudio/IMG-20261027-WA0047_89a5906b.jpg"
                alt={siteSettings.brandName}
                className="w-16 h-16 rounded-full object-cover border border-[#D4AF37]/60 shadow-lg shrink-0"
              />
              <div className="space-y-1">
                <p className="text-xs text-[#E0A996] tracking-wide">{siteSettings.tagline}</p>
                <h2 className="text-2xl sm:text-3xl font-semibold font-serif-luxury text-[#F5F0EB]">
                  {siteSettings.brandName}
                </h2>
              </div>
            </div>

            <p className="text-sm text-[#B5ADA6] max-w-lg leading-relaxed">
              Visit our luxury bridal studio for a personal skin &amp; bridal trousseau
              consultation, or connect directly on phone and WhatsApp.
            </p>

            <div className="space-y-3 text-sm text-[#D5CEC8]">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-[#E0A996] shrink-0 mt-1" />
                <span>{siteSettings.address}</span>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-[#D4AF37] shrink-0 mt-1" />
                <span>{siteSettings.openingHours}</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-[#E0A996] shrink-0" />
                <a
                  href={`tel:${siteSettings.phone.replace(/\s+/g, '')}`}
                  className="font-mono tabular-nums hover:text-[#E0A996] transition-colors"
                >
                  {siteSettings.phone} (Click to Call)
                </a>
              </div>
              <div className="flex items-center gap-3">
                <Instagram className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <a
                  href={siteSettings.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#E0A996] transition-colors"
                >
                  {siteSettings.instagramHandle}
                </a>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a
                href={`tel:${siteSettings.phone.replace(/\s+/g, '')}`}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#1C1A24] border border-[#2E2A38] hover:border-[#E0A996] text-xs font-medium text-[#F5F0EB] inline-flex items-center gap-2 whitespace-nowrap"
              >
                <Phone className="w-4 h-4 text-[#E0A996]" />
                Call {siteSettings.phone}
              </a>
              <a
                href={directWhatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#1C1A24] border border-[#2E2A38] hover:border-[#D4AF37] text-xs font-medium text-[#D4AF37] inline-flex items-center gap-2 whitespace-nowrap"
              >
                <MessageCircle className="w-4 h-4" />
                Chat on WhatsApp
              </a>
            </div>
          </div>

          {/* Custom Bridal & Aesthetics Inquiry Form */}
          <div className="lg:col-span-6">
            <form
              onSubmit={handleInquirySubmit}
              className="rounded-3xl bg-[#16161E] border border-[#26232E] p-6 sm:p-8 space-y-4"
            >
              <div className="space-y-1">
                <h3 className="text-lg font-semibold font-serif-luxury text-[#F5F0EB]">
                  Send a Custom Bridal or Group Inquiry
                </h3>
                <p className="text-xs text-[#8E8782]">
                  Planning destination bridal makeup or group pre-bridal packages? Leave your
                  details for a callback within 30 minutes.
                </p>
              </div>

              {inqSubmitted && (
                <div className="p-3.5 rounded-xl bg-[#1D1B24] border border-[#D4AF37]/40 text-xs text-[#D4AF37]">
                  Thank you! Your inquiry has been received by {siteSettings.brandName}.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs text-[#B5ADA6] mb-1">Your Name *</label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={100}
                    value={inqName}
                    onChange={(e) => setInqName(e.target.value)}
                    placeholder="Full Name"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#0D0D11] border border-[#2C2830] text-sm text-[#F5F0EB] focus:outline-none focus:border-[#E0A996]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#B5ADA6] mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    minLength={7}
                    maxLength={25}
                    value={inqPhone}
                    onChange={(e) => setInqPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#0D0D11] border border-[#2C2830] text-sm text-[#F5F0EB] font-mono tabular-nums focus:outline-none focus:border-[#E0A996]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-[#B5ADA6] mb-1">
                  Wedding Dates / Services Needed *
                </label>
                <textarea
                  rows={3}
                  required
                  minLength={5}
                  maxLength={600}
                  value={inqMessage}
                  onChange={(e) => setInqMessage(e.target.value)}
                  placeholder="Tell us about your event date, venue, or skin/hair requirements..."
                  className="w-full px-3.5 py-2 rounded-xl bg-[#0D0D11] border border-[#2C2830] text-sm text-[#F5F0EB] focus:outline-none focus:border-[#E0A996]"
                />
              </div>

              <button
                type="submit"
                className="w-full min-h-[46px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#E0A996] to-[#D4AF37] text-[#0D0D11] font-semibold text-xs sm:text-sm hover:opacity-95 transition-opacity whitespace-nowrap"
              >
                Request Bridal Callback
              </button>
            </form>
          </div>
        </div>

        {/* Bottom Copyright & Admin Link */}
        <div className="max-w-7xl mx-auto pt-6 flex flex-wrap items-center justify-between gap-4 text-xs text-[#8E8782]">
          <p>
            © {new Date().getFullYear()} {siteSettings.brandName} ({siteSettings.tagline}). All
            rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a href="#services" className="hover:text-[#F5F0EB]">
              Services
            </a>
            <a href="#gallery" className="hover:text-[#F5F0EB]">
              Bridal Gallery
            </a>
            <button
              type="button"
              onClick={navigateToAdmin}
              className="text-[#E0A996] hover:underline font-medium"
            >
              Admin Portal (/admin)
            </button>
          </div>
        </div>
      </footer>

      {/* 7. MOBILE APP-LIKE BOTTOM NAVIGATION BAR (Thumb-Zone Ergonomics, <= 15% Sticky Cap) */}
      <nav
        aria-label="Mobile bottom navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-[#0D0D11]/95 backdrop-blur-md border-t border-[#26232E] grid grid-cols-5 items-center px-1"
      >
        <a
          href="#top"
          className="min-h-[44px] flex flex-col items-center justify-center text-[#B5ADA6] hover:text-[#E0A996]"
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-1 whitespace-nowrap">Home</span>
        </a>

        <a
          href="#services"
          className="min-h-[44px] flex flex-col items-center justify-center text-[#B5ADA6] hover:text-[#E0A996]"
        >
          <Sparkles className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-1 whitespace-nowrap">Services</span>
        </a>

        {/* Elevated Center Book Button */}
        <button
          type="button"
          onClick={() => openBookingWithService(null)}
          className="min-h-[44px] mx-1 rounded-xl bg-gradient-to-r from-[#E0A996] to-[#D4AF37] text-[#0D0D11] flex flex-col items-center justify-center py-1.5 shadow-md"
        >
          <Calendar className="w-4 h-4" />
          <span className="text-[10px] font-bold mt-0.5 whitespace-nowrap">Book</span>
        </button>

        <a
          href="#gallery"
          className="min-h-[44px] flex flex-col items-center justify-center text-[#B5ADA6] hover:text-[#E0A996]"
        >
          <ImageIcon className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-1 whitespace-nowrap">Gallery</span>
        </a>

        <a
          href={directWhatsAppUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-[44px] flex flex-col items-center justify-center text-[#D4AF37]"
        >
          <MessageCircle className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-1 whitespace-nowrap">WhatsApp</span>
        </a>
      </nav>

      {/* Instant Booking Modal */}
      <BookingModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        services={services}
        preselectedService={selectedServiceForBooking}
        siteSettings={siteSettings}
        currentUser={currentUser}
        onSignInGoogle={async () => {
          await signInWithGoogle();
        }}
        onBookingCreated={(newBooking) => {
          setAppointments((prev) => [newBooking, ...prev]);
        }}
      />
    </div>
  );
}
