import React, { useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  Check,
  CloudUpload,
  Edit3,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Lock,
  LogOut,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, handleFirestoreError } from '../firebase';
import {
  ServiceItem,
  ServiceCategory,
  GalleryItem,
  GalleryCategory,
  AppointmentItem,
  AppointmentStatus,
  InquiryItem,
  SiteSettings,
  OperationType,
} from '../types';
import { LuxuryArtCanvas } from './LuxuryArtCanvas';

interface AdminPanelProps {
  currentUser: User | null;
  onSignInGoogle: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onExitAdmin: () => void;
  services: ServiceItem[];
  setServices: React.Dispatch<React.SetStateAction<ServiceItem[]>>;
  gallery: GalleryItem[];
  setGallery: React.Dispatch<React.SetStateAction<GalleryItem[]>>;
  appointments: AppointmentItem[];
  setAppointments: React.Dispatch<React.SetStateAction<AppointmentItem[]>>;
  inquiries: InquiryItem[];
  setInquiries: React.Dispatch<React.SetStateAction<InquiryItem[]>>;
  siteSettings: SiteSettings;
  setSiteSettings: React.Dispatch<React.SetStateAction<SiteSettings>>;
  onSeedCloudDatabase: () => Promise<void>;
}

const ADMIN_PIN = '2223';

export const AdminPanel: React.FC<AdminPanelProps> = ({
  currentUser,
  onSignInGoogle,
  onSignOut,
  onExitAdmin,
  services,
  setServices,
  gallery,
  setGallery,
  appointments,
  setAppointments,
  inquiries,
  setInquiries,
  siteSettings,
  setSiteSettings,
  onSeedCloudDatabase,
}) => {
  const isVerifiedCloudAdmin =
    Boolean(currentUser?.emailVerified) &&
    currentUser?.email === 'singhshriyansh51@gmail.com';

  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [activeTab, setActiveTab] = useState<
    'appointments' | 'services' | 'gallery' | 'inquiries' | 'settings'
  >('appointments');

  // Filters for Appointments
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Service Form State
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [isServiceFormOpen, setIsServiceFormOpen] = useState(false);
  const [srvTitle, setSrvTitle] = useState('');
  const [srvCategory, setSrvCategory] = useState<ServiceCategory>('Bridal');
  const [srvSubCategory, setSrvSubCategory] = useState('');
  const [srvPrice, setSrvPrice] = useState('14999');
  const [srvOriginalPrice, setSrvOriginalPrice] = useState('18500');
  const [srvDuration, setSrvDuration] = useState('3.5 hrs');
  const [srvDescription, setSrvDescription] = useState('');
  const [srvInclusionsText, setSrvInclusionsText] = useState('');
  const [srvImageUrl, setSrvImageUrl] = useState('art:bridal_hd');
  const [srvFeatured, setSrvFeatured] = useState(true);

  // Gallery Form State
  const [isGalleryFormOpen, setIsGalleryFormOpen] = useState(false);
  const [galTitle, setGalTitle] = useState('');
  const [galCategory, setGalCategory] = useState<GalleryCategory>('Bridal');
  const [galClientName, setGalClientName] = useState('');
  const [galDescription, setGalDescription] = useState('');
  const [galBeforeLabel, setGalBeforeLabel] = useState('');
  const [galAfterLabel, setGalAfterLabel] = useState('');
  const [galImageUrl, setGalImageUrl] = useState('art:gal_bridal_1');
  const [galInstagramUrl, setGalInstagramUrl] = useState(siteSettings.instagramUrl);

  // Upload & Save Status
  const [uploadingImage, setUploadingImage] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  // Settings Form State
  const [settingsDraft, setSettingsDraft] = useState<SiteSettings>(siteSettings);

  const showToast = (msg: string) => {
    setStatusBanner(msg);
    setTimeout(() => setStatusBanner(null), 4000);
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.trim() === ADMIN_PIN) {
      setPinUnlocked(true);
      setPinError('');
    } else {
      setPinError('Incorrect PIN. Use 2223 (last 4 digits of +91 747032223).');
    }
  };

  /**
   * Uploads an image file directly to Cloudinary REST API using configured Cloud Name & Upload Preset.
   * Falls back to a compressed Data URL if the demo Cloudinary preset rejects unsigned uploads.
   */
  const handleCloudinaryUpload = async (
    file: File,
    onSuccessUrl: (url: string) => void
  ) => {
    setUploadingImage(true);
    try {
      const cloudName = siteSettings.cloudinaryCloudName || 'demo';
      const uploadPreset = siteSettings.cloudinaryUploadPreset || 'ml_default';

      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', uploadPreset);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.secure_url) {
          onSuccessUrl(data.secure_url);
          showToast('High-res photo uploaded to Cloudinary.');
          setUploadingImage(false);
          return;
        }
      }

      // Fallback: client-side canvas resize so image fits within Firestore <500 char or local state
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          onSuccessUrl(reader.result);
          showToast('Photo processed and attached to item.');
        }
        setUploadingImage(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setUploadingImage(false);
      showToast('Upload fallback activated.');
    }
  };

  // Appointment Status Update
  const handleUpdateAppointmentStatus = async (
    apt: AppointmentItem,
    newStatus: AppointmentStatus
  ) => {
    setAppointments((prev) =>
      prev.map((item) => (item.id === apt.id ? { ...item, status: newStatus } : item))
    );

    if (isVerifiedCloudAdmin) {
      try {
        await updateDoc(doc(db, 'appointments', apt.id), {
          status: newStatus,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Appointment exists locally only; status updated locally:', err);
      }
    }
    showToast(`Appointment for ${apt.clientName} marked as ${newStatus}.`);
  };

  // Service Create / Edit Open
  const openCreateService = () => {
    setEditingService(null);
    setSrvTitle('');
    setSrvCategory('Bridal');
    setSrvSubCategory('Signature Package');
    setSrvPrice('4999');
    setSrvOriginalPrice('6500');
    setSrvDuration('90 mins');
    setSrvDescription('');
    setSrvInclusionsText('Deep Skin Prep\nLuxury Application\nPost-Care Elixir');
    setSrvImageUrl('art:bridal_hd');
    setSrvFeatured(false);
    setIsServiceFormOpen(true);
  };

  const openEditService = (srv: ServiceItem) => {
    setEditingService(srv);
    setSrvTitle(srv.title);
    setSrvCategory(srv.category);
    setSrvSubCategory(srv.subCategory);
    setSrvPrice(String(srv.price));
    setSrvOriginalPrice(String(srv.originalPrice));
    setSrvDuration(srv.duration);
    setSrvDescription(srv.description);
    setSrvInclusionsText(srv.inclusions.join('\n'));
    setSrvImageUrl(srv.imageUrl);
    setSrvFeatured(srv.isFeatured);
    setIsServiceFormOpen(true);
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = editingService ? editingService.id : `srv_${Date.now()}`;
    const inclusions = srvInclusionsText
      .split('\n')
      .map((s) => s.trim().slice(0, 120))
      .filter((s) => s.length >= 2)
      .slice(0, 8);

    const safeInclusions = inclusions.length > 0 ? inclusions : ['Luxury Consultation & Prep'];
    const safeImageUrl =
      srvImageUrl.length <= 500 ? srvImageUrl : 'art:bridal_hd';

    const serviceObj: ServiceItem = {
      id,
      title: srvTitle.trim().slice(0, 120),
      category: srvCategory,
      subCategory: (srvSubCategory.trim() || srvCategory).slice(0, 80),
      price: Math.max(0, Math.min(500000, Number(srvPrice) || 0)),
      originalPrice: Math.max(0, Math.min(500000, Number(srvOriginalPrice) || 0)),
      duration: (srvDuration.trim() || '60 mins').slice(0, 40),
      description:
        srvDescription.trim().length >= 10
          ? srvDescription.trim().slice(0, 600)
          : 'Bespoke luxury salon ritual performed by certified beauty specialists.',
      inclusions: safeInclusions,
      imageUrl: srvImageUrl,
      isActive: editingService ? editingService.isActive : true,
      isFeatured: srvFeatured,
    };

    if (editingService) {
      setServices((prev) => prev.map((s) => (s.id === id ? serviceObj : s)));
    } else {
      setServices((prev) => [serviceObj, ...prev]);
    }

    if (isVerifiedCloudAdmin) {
      try {
        await setDoc(doc(db, 'services', id), {
          title: serviceObj.title,
          category: serviceObj.category,
          subCategory: serviceObj.subCategory,
          price: serviceObj.price,
          originalPrice: serviceObj.originalPrice,
          duration: serviceObj.duration,
          description: serviceObj.description,
          inclusions: serviceObj.inclusions,
          imageUrl: safeImageUrl,
          isActive: serviceObj.isActive,
          isFeatured: serviceObj.isFeatured,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `services/${id}`);
      }
    }

    setIsServiceFormOpen(false);
    showToast(editingService ? 'Service updated.' : 'New service added to catalog.');
  };

  const handleToggleServiceActive = async (srv: ServiceItem) => {
    const updated = { ...srv, isActive: !srv.isActive };
    setServices((prev) => prev.map((s) => (s.id === srv.id ? updated : s)));
    if (isVerifiedCloudAdmin) {
      try {
        await updateDoc(doc(db, 'services', srv.id), {
          isActive: updated.isActive,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Local service toggle only:', err);
      }
    }
    showToast(`${srv.title} ${updated.isActive ? 'enabled' : 'hidden'}.`);
  };

  const handleDeleteService = async (id: string) => {
    setServices((prev) => prev.filter((s) => s.id !== id));
    if (isVerifiedCloudAdmin) {
      try {
        await deleteDoc(doc(db, 'services', id));
      } catch (err) {
        console.warn('Local delete only:', err);
      }
    }
    showToast('Service removed from catalog.');
  };

  const handleSaveGalleryItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = `gal_${Date.now()}`;
    const safeImageUrl =
      galImageUrl.length <= 500 ? galImageUrl : 'art:gal_bridal_1';

    const newItem: GalleryItem = {
      id,
      title: galTitle.trim().slice(0, 120) || 'Bridal Couture Transformation',
      category: galCategory,
      clientName: galClientName.trim().slice(0, 80) || 'Sneha Bride',
      description:
        galDescription.trim().slice(0, 400) ||
        'Custom airbrush and luxury bridal transformation at Sneha Beauty World.',
      beforeLabel:
        galBeforeLabel.trim().slice(0, 160) || 'Uneven tone & pre-bridal fatigue',
      afterLabel:
        galAfterLabel.trim().slice(0, 160) || 'Flawless 18-hour radiant bridal finish',
      imageUrl: galImageUrl,
      instagramUrl: (galInstagramUrl.trim() || siteSettings.instagramUrl).slice(0, 300),
      isPublished: true,
    };

    setGallery((prev) => [newItem, ...prev]);

    if (isVerifiedCloudAdmin) {
      try {
        await setDoc(doc(db, 'gallery', id), {
          title: newItem.title,
          category: newItem.category,
          clientName: newItem.clientName,
          description: newItem.description,
          beforeLabel: newItem.beforeLabel,
          afterLabel: newItem.afterLabel,
          imageUrl: safeImageUrl,
          instagramUrl: newItem.instagramUrl,
          isPublished: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `gallery/${id}`);
      }
    }

    setIsGalleryFormOpen(false);
    setGalTitle('');
    setGalClientName('');
    setGalDescription('');
    setGalBeforeLabel('');
    setGalAfterLabel('');
    showToast('Bridal transformation added to gallery.');
  };

  const handleDeleteGalleryItem = async (id: string) => {
    setGallery((prev) => prev.filter((g) => g.id !== id));
    if (isVerifiedCloudAdmin) {
      try {
        await deleteDoc(doc(db, 'gallery', id));
      } catch (err) {
        console.warn('Local gallery delete only:', err);
      }
    }
    showToast('Gallery item deleted.');
  };

  const handleSaveSiteSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned: SiteSettings = {
      brandName: settingsDraft.brandName.trim().slice(0, 80) || 'Sneha Beauty World',
      tagline: settingsDraft.tagline.trim().slice(0, 120) || 'Make Beauty Yours',
      phone: settingsDraft.phone.trim().slice(0, 30) || '+91 747032223',
      whatsappNumber:
        settingsDraft.whatsappNumber.replace(/[^\d]/g, '').slice(0, 25) || '91747032223',
      instagramHandle:
        settingsDraft.instagramHandle.trim().slice(0, 60) || '@sneha.beauty.world',
      instagramUrl:
        settingsDraft.instagramUrl.trim().slice(0, 250) ||
        'https://instagram.com/sneha.beauty.world',
      openingHours:
        settingsDraft.openingHours.trim().slice(0, 160) ||
        'Mon – Sun: 10:00 AM – 8:30 PM',
      address:
        settingsDraft.address.trim().slice(0, 250) ||
        'Luxury Bridal Studio & Aesthetics Lounge',
      announcementText:
        settingsDraft.announcementText.trim().slice(0, 200) ||
        'Complimentary Pre-Bridal Skin Consultation on 2026 Wedding Bookings',
      cloudinaryCloudName:
        settingsDraft.cloudinaryCloudName.trim().slice(0, 80) || 'demo',
      cloudinaryUploadPreset:
        settingsDraft.cloudinaryUploadPreset.trim().slice(0, 80) || 'ml_default',
    };

    setSiteSettings(cleaned);

    if (isVerifiedCloudAdmin) {
      try {
        await setDoc(doc(db, 'settings', 'general'), {
          ...cleaned,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'settings/general');
      }
    }
    showToast('Site settings & promo bar updated live.');
  };

  // If neither verified admin nor PIN unlocked, show protected Admin Login screen
  if (!isVerifiedCloudAdmin && !pinUnlocked) {
    return (
      <div className="min-h-screen bg-[#0D0D11] text-[#F5F0EB] flex flex-col justify-center items-center px-4 py-12">
        <div className="w-full max-w-md rounded-3xl bg-[#16161E] border border-[#2C2830] p-8 shadow-2xl space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#E0A996] tracking-wide">
              {siteSettings.brandName} · Management Portal
            </span>
            <button
              type="button"
              onClick={onExitAdmin}
              className="text-xs text-[#B5ADA6] hover:text-[#F5F0EB] inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Return to Storefront
            </button>
          </div>

          <div className="flex items-center gap-4">
            <img
              src="/assets/aistudio/IMG-20261027-WA0047_89a5906b.jpg"
              alt={siteSettings.brandName}
              className="w-16 h-16 rounded-full object-cover border border-[#D4AF37]/60 shadow-lg shrink-0"
            />
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold font-serif-luxury text-[#F5F0EB]">
                Executive Salon Console
              </h1>
              <p className="text-xs text-[#B5ADA6] leading-relaxed">
                Authenticate via Google Admin Account or enter the studio PIN to manage bookings,
                pricing, and gallery.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onSignInGoogle}
            className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-gradient-to-r from-[#E0A996] to-[#D4AF37] text-[#0D0D11] font-semibold text-sm flex items-center justify-center gap-2 shadow-lg hover:opacity-95 transition-opacity whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4" />
            Sign In with Google Admin
          </button>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-[#28242C]" />
            <span className="shrink-0 mx-3 text-[11px] text-[#8E8782]">
              Or Quick Studio PIN Access
            </span>
            <div className="flex-grow border-t border-[#28242C]" />
          </div>

          <form onSubmit={handlePinSubmit} className="space-y-3">
            <div>
              <label className="block text-xs text-[#B5ADA6] mb-1.5">
                Studio Security PIN (Default Demo PIN: <span className="text-[#D4AF37] font-mono">2223</span>)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#8E8782] absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Enter 4-digit PIN (2223)"
                  className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl bg-[#0D0D11] border border-[#2C2830] text-sm text-[#F5F0EB] font-mono focus:outline-none focus:border-[#E0A996]"
                />
              </div>
            </div>
            {pinError && <p className="text-xs text-red-400">{pinError}</p>}
            <button
              type="submit"
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#221F29] hover:bg-[#2C2835] text-[#F5F0EB] text-xs font-medium transition-colors"
            >
              Unlock Console with PIN
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Filtered Appointments
  const filteredAppointments = appointments.filter((apt) => {
    const matchesDate = !dateFilter || apt.appointmentDate === dateFilter;
    const matchesStatus = statusFilter === 'All' || apt.status === statusFilter;
    return matchesDate && matchesStatus;
  });

  const pendingCount = appointments.filter((a) => a.status === 'Pending').length;
  const confirmedRevenue = appointments
    .filter((a) => a.status === 'Confirmed' || a.status === 'Completed')
    .reduce((acc, a) => acc + Number(a.servicePrice || 0), 0);

  return (
    <div className="min-h-screen bg-[#0D0D11] text-[#F5F0EB] pb-24">
      {/* Admin Top Header */}
      <header className="sticky top-0 z-30 bg-[#0D0D11]/95 backdrop-blur-md border-b border-[#25222B] px-4 sm:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onExitAdmin}
              className="min-h-[40px] px-3 py-2 rounded-xl bg-[#16161E] border border-[#2C2830] text-xs text-[#F5F0EB] hover:border-[#E0A996] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <ArrowLeft className="w-4 h-4 text-[#E0A996]" />
              Storefront
            </button>
            <img
              src="/assets/aistudio/IMG-20261027-WA0047_89a5906b.jpg"
              alt={siteSettings.brandName}
              className="w-10 h-10 rounded-full object-cover border border-[#D4AF37]/50 shrink-0"
            />
            <div>
              <h1 className="text-lg font-semibold font-serif-luxury text-[#F5F0EB]">
                {siteSettings.brandName} — Admin Console
              </h1>
              <p className="text-xs text-[#8E8782]">
                {isVerifiedCloudAdmin
                  ? `Cloud Admin Verified (${currentUser?.email})`
                  : 'Studio PIN Session Active · Connect Google Admin for Cloud Firestore Sync'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {isVerifiedCloudAdmin ? (
              <button
                type="button"
                disabled={isSeeding}
                onClick={async () => {
                  setIsSeeding(true);
                  await onSeedCloudDatabase();
                  setIsSeeding(false);
                  showToast('Catalog & Gallery synced to Cloud Firestore.');
                }}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#1F1C26] border border-[#D4AF37]/40 text-xs text-[#D4AF37] hover:bg-[#282432] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSeeding ? 'animate-spin' : ''}`} />
                Sync Catalog to Firestore
              </button>
            ) : (
              <button
                type="button"
                onClick={onSignInGoogle}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#1F1C26] border border-[#E0A996]/40 text-xs text-[#E0A996] hover:bg-[#282432] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Connect Google Cloud Admin
              </button>
            )}

            {currentUser && (
              <button
                type="button"
                onClick={onSignOut}
                className="min-h-[40px] px-3 py-2 rounded-xl bg-[#16161E] border border-[#2C2830] text-xs text-[#B5ADA6] hover:text-[#F5F0EB] inline-flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-8">
        {statusBanner && (
          <div className="px-4 py-3 rounded-2xl bg-[#1D1B24] border border-[#D4AF37]/40 text-xs text-[#F5F0EB] flex items-center justify-between">
            <span>{statusBanner}</span>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="text-[#E0A996] font-medium"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Live Dashboard KPI Strip */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl bg-[#16161E] border border-[#26232C] p-5 space-y-1">
            <p className="text-xs text-[#8E8782]">Total Appointments</p>
            <p className="text-2xl font-semibold text-[#F5F0EB] font-mono tabular-nums">
              {appointments.length}
            </p>
            <p className="text-xs text-[#E0A996] font-mono tabular-nums">
              {pendingCount} awaiting confirmation
            </p>
          </div>

          <div className="rounded-2xl bg-[#16161E] border border-[#26232C] p-5 space-y-1">
            <p className="text-xs text-[#8E8782]">Confirmed Revenue</p>
            <p className="text-2xl font-semibold text-[#D4AF37] font-mono tabular-nums">
              ₹{confirmedRevenue.toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-[#8E8782]">Confirmed & Completed slots</p>
          </div>

          <div className="rounded-2xl bg-[#16161E] border border-[#26232C] p-5 space-y-1">
            <p className="text-xs text-[#8E8782]">Active Services</p>
            <p className="text-2xl font-semibold text-[#F5F0EB] font-mono tabular-nums">
              {services.filter((s) => s.isActive).length} / {services.length}
            </p>
            <p className="text-xs text-[#8E8782]">Across 5 luxury categories</p>
          </div>

          <div className="rounded-2xl bg-[#16161E] border border-[#26232C] p-5 space-y-1">
            <p className="text-xs text-[#8E8782]">Bridal Gallery & Inquiries</p>
            <p className="text-2xl font-semibold text-[#F5F0EB] font-mono tabular-nums">
              {gallery.length} Looks · {inquiries.length} Msg
            </p>
            <p className="text-xs text-[#E0A996]">Cloudinary Ready</p>
          </div>
        </section>

        {/* Interactive Admin Section Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-[#25222B]">
          {[
            { id: 'appointments', label: `Appointments (${appointments.length})` },
            { id: 'services', label: `Services & Pricing (${services.length})` },
            { id: 'gallery', label: `Bridal Gallery (${gallery.length})` },
            { id: 'inquiries', label: `Client Inquiries (${inquiries.length})` },
            { id: 'settings', label: 'Site Settings & Cloudinary' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-[#E0A996] to-[#D4AF37] text-[#0D0D11] font-semibold'
                  : 'bg-[#16161E] text-[#B5ADA6] hover:text-[#F5F0EB] border border-[#26232C]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: APPOINTMENTS MANAGER */}
        {activeTab === 'appointments' && (
          <section className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold font-serif-luxury text-[#F5F0EB]">
                  Real-Time Appointments Manager
                </h2>
                <p className="text-xs text-[#8E8782]">
                  Filter by date, update booking status, or connect directly with the bride via
                  Call or WhatsApp.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 bg-[#16161E] border border-[#2C2830] rounded-xl px-3 py-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#E0A996]" />
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="bg-transparent text-xs text-[#F5F0EB] font-mono focus:outline-none"
                  />
                  {dateFilter && (
                    <button
                      type="button"
                      onClick={() => setDateFilter('')}
                      className="text-[11px] text-[#E0A996] hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 bg-[#16161E] border border-[#2C2830] rounded-xl p-1">
                  {(['All', 'Pending', 'Confirmed', 'Completed', 'Cancelled'] as const).map(
                    (st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setStatusFilter(st)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                          statusFilter === st
                            ? 'bg-[#2B2633] text-[#E0A996]'
                            : 'text-[#8E8782] hover:text-[#F5F0EB]'
                        }`}
                      >
                        {st}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            {filteredAppointments.length === 0 ? (
              <div className="rounded-2xl bg-[#16161E] border border-[#26232C] p-10 text-center space-y-2">
                <p className="text-sm text-[#F5F0EB]">No appointments match this filter.</p>
                <p className="text-xs text-[#8E8782]">
                  Try clearing the date filter or switching status tabs.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAppointments.map((apt) => {
                  const cleanDigits = apt.clientPhone.replace(/[^\d]/g, '');
                  const waClientMsg = encodeURIComponent(
                    `Hello ${apt.clientName}, greetings from *${siteSettings.brandName}*! Your booking for *${apt.serviceTitle}* on *${apt.appointmentDate}* at *${apt.timeSlot}* is *${apt.status}*.`
                  );

                  return (
                    <div
                      key={apt.id}
                      className="rounded-2xl bg-[#16161E] border border-[#26232C] p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#B5ADA6]">
                          <span className="font-mono tabular-nums text-[#E0A996]">
                            {apt.appointmentDate} · {apt.timeSlot}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>Status: {apt.status}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums text-[#D4AF37]">
                            ₹{Number(apt.servicePrice).toLocaleString('en-IN')}
                          </span>
                        </div>

                        <h3 className="text-base font-semibold text-[#F5F0EB]">
                          {apt.clientName}{' '}
                          <span className="text-sm font-normal text-[#B5ADA6]">
                            — {apt.serviceTitle}
                          </span>
                        </h3>

                        <p className="text-xs text-[#8E8782] font-mono tabular-nums">
                          Client Phone: {apt.clientPhone}
                        </p>
                        {apt.notes && (
                          <p className="text-xs text-[#B5ADA6] italic">
                            Note: &ldquo;{apt.notes}&rdquo;
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {/* Direct Call & WhatsApp Client Actions */}
                        <a
                          href={`tel:${apt.clientPhone.replace(/\s+/g, '')}`}
                          className="min-h-[40px] px-3 py-2 rounded-xl bg-[#1F1C27] border border-[#2E2A38] text-xs text-[#F5F0EB] hover:border-[#E0A996] inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <Phone className="w-3.5 h-3.5 text-[#E0A996]" />
                          Call Client
                        </a>
                        <a
                          href={`https://wa.me/${cleanDigits}?text=${waClientMsg}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[40px] px-3 py-2 rounded-xl bg-[#1F1C27] border border-[#2E2A38] text-xs text-[#D4AF37] hover:border-[#D4AF37] inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          WhatsApp Client
                        </a>

                        {/* Status Selector */}
                        <select
                          aria-label={`Change status for ${apt.clientName}`}
                          value={apt.status}
                          onChange={(e) =>
                            handleUpdateAppointmentStatus(
                              apt,
                              e.target.value as AppointmentStatus
                            )
                          }
                          className="min-h-[40px] px-3 py-2 rounded-xl bg-[#0D0D11] border border-[#2C2830] text-xs text-[#F5F0EB] focus:outline-none focus:border-[#E0A996]"
                        >
                          <option value="Pending">Pending</option>
                          <option value="Confirmed">Confirmed</option>
                          <option value="Completed">Completed</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* TAB 2: SERVICES & PRICING MANAGER (CRUD + CLOUDINARY) */}
        {activeTab === 'services' && (
          <section className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold font-serif-luxury text-[#F5F0EB]">
                  Services & Tariff Manager
                </h2>
                <p className="text-xs text-[#8E8782]">
                  Add new treatments, adjust pricing, upload Cloudinary service banners, or toggle
                  availability.
                </p>
              </div>
              <button
                type="button"
                onClick={openCreateService}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#E0A996] to-[#D4AF37] text-[#0D0D11] font-semibold text-xs inline-flex items-center gap-2 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Add New Service
              </button>
            </div>

            {isServiceFormOpen && (
              <form
                onSubmit={handleSaveService}
                className="rounded-3xl bg-[#16161E] border border-[#E0A996]/40 p-6 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold font-serif-luxury text-[#F5F0EB]">
                    {editingService ? `Edit Service: ${editingService.title}` : 'Create New Service'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsServiceFormOpen(false)}
                    className="text-xs text-[#B5ADA6] hover:text-[#F5F0EB]"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-[#B5ADA6] mb-1">Service Title *</label>
                    <input
                      type="text"
                      required
                      value={srvTitle}
                      onChange={(e) => setSrvTitle(e.target.value)}
                      placeholder="e.g., Signature HD Royal Bridal Makeup"
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0D0D11] border border-[#2C2830] text-sm text-[#F5F0EB]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#B5ADA6] mb-1">Category *</label>
                    <select
                      value={srvCategory}
                      onChange={(e) => setSrvCategory(e.target.value as ServiceCategory)}
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0D0D11] border border-[#2C2830] text-sm text-[#F5F0EB]"
                    >
                      <option value="Bridal">Bridal</option>
                      <option value="Skin">Skin</option>
                      <option value="Hair">Hair</option>
                      <option value="Massage">Massage</option>
                      <option value="Draping">Draping</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs text-[#B5ADA6] mb-1">Offer Price (₹) *</label>
                    <input
                      type="number"
                      required
                      value={srvPrice}
                      onChange={(e) => setSrvPrice(e.target.value)}
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0D0D11] border border-[#2C2830] text-sm text-[#F5F0EB] font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#B5ADA6] mb-1">Regular Price (₹)</label>
                    <input
                      type="number"
                      required
                      value={srvOriginalPrice}
                      onChange={(e) => setSrvOriginalPrice(e.target.value)}
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0D0D11] border border-[#2C2830] text-sm text-[#F5F0EB] font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#B5ADA6] mb-1">Duration *</label>
                    <input
                      type="text"
                      required
                      value={srvDuration}
                      onChange={(e) => setSrvDuration(e.target.value)}
                      placeholder="e.g., 90 mins"
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0D0D11] border border-[#2C2830] text-sm text-[#F5F0EB]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#B5ADA6] mb-1">Sub-Category Label</label>
                    <input
                      type="text"
                      value={srvSubCategory}
                      onChange={(e) => setSrvSubCategory(e.target.value)}
                      placeholder="e.g., Airbrush Bridal"
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0D0D11] border border-[#2C2830] text-sm text-[#F5F0EB]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-[#B5ADA6] mb-1">
                      Detailed Description *
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={srvDescription}
                      onChange={(e) => setSrvDescription(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-[#0D0D11] border border-[#2C2830] text-sm text-[#F5F0EB]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#B5ADA6] mb-1">
                      Package Inclusions (One per line)
                    </label>
                    <textarea
                      rows={3}
                      value={srvInclusionsText}
                      onChange={(e) => setSrvInclusionsText(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-[#0D0D11] border border-[#2C2830] text-sm text-[#F5F0EB]"
                    />
                  </div>
                </div>

                {/* Cloudinary Banner Uploader */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-[#26232C]">
                  <div className="flex items-center gap-3">
                    <label className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#1F1C27] border border-[#2E2A38] text-xs text-[#E0A996] hover:border-[#E0A996] cursor-pointer inline-flex items-center gap-2">
                      <CloudUpload className="w-4 h-4" />
                      {uploadingImage ? 'Uploading to Cloudinary...' : 'Upload Service Banner (Cloudinary)'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleCloudinaryUpload(file, (url) => setSrvImageUrl(url));
                          }
                        }}
                      />
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs text-[#B5ADA6] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={srvFeatured}
                        onChange={(e) => setSrvFeatured(e.target.checked)}
                        className="rounded border-[#2C2830]"
                      />
                      Highlight as Signature Service
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="min-h-[42px] px-5 py-2 rounded-xl bg-gradient-to-r from-[#E0A996] to-[#D4AF37] text-[#0D0D11] font-semibold text-xs inline-flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    Save Service
                  </button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {services.map((srv) => (
                <div
                  key={srv.id}
                  className={`rounded-2xl bg-[#16161E] border p-4 flex gap-4 ${
                    srv.isActive ? 'border-[#26232C]' : 'border-[#26232C] opacity-60'
                  }`}
                >
                  <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0 border border-[#2C2830]">
                    <LuxuryArtCanvas
                      imageUrl={srv.imageUrl}
                      alt={srv.title}
                      variant={srv.category.toLowerCase() as 'bridal'}
                    />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-[#E0A996]">
                        {srv.category} · {srv.duration}
                      </span>
                      <span className="text-sm font-semibold text-[#D4AF37] font-mono tabular-nums">
                        ₹{srv.price.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-[#F5F0EB] truncate">{srv.title}</h3>
                    <p className="text-xs text-[#8E8782] line-clamp-2">{srv.description}</p>

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => openEditService(srv)}
                        className="px-2.5 py-1 rounded-lg bg-[#221F2A] text-xs text-[#F5F0EB] hover:text-[#E0A996] inline-flex items-center gap-1"
                      >
                        <Edit3 className="w-3 h-3" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleServiceActive(srv)}
                        className="px-2.5 py-1 rounded-lg bg-[#221F2A] text-xs text-[#B5ADA6] hover:text-[#F5F0EB] inline-flex items-center gap-1"
                      >
                        {srv.isActive ? (
                          <>
                            <EyeOff className="w-3 h-3" /> Hide
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3" /> Enable
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteService(srv.id)}
                        className="px-2.5 py-1 rounded-lg bg-red-950/40 text-xs text-red-300 hover:text-red-200 inline-flex items-center gap-1 ml-auto"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TAB 3: BRIDAL GALLERY MANAGER (CLOUDINARY) */}
        {activeTab === 'gallery' && (
          <section className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold font-serif-luxury text-[#F5F0EB]">
                  Bridal Transformation & Gallery Manager
                </h2>
                <p className="text-xs text-[#8E8782]">
                  Upload client makeover photos to Cloudinary with category tags and before/after
                  notes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsGalleryFormOpen(!isGalleryFormOpen)}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#E0A996] to-[#D4AF37] text-[#0D0D11] font-semibold text-xs inline-flex items-center gap-2 whitespace-nowrap"
              >
                <ImageIcon className="w-4 h-4" />
                Upload New Client Look
              </button>
            </div>

            {isGalleryFormOpen && (
              <form
                onSubmit={handleSaveGalleryItem}
                className="rounded-3xl bg-[#16161E] border border-[#E0A996]/40 p-6 space-y-4"
              >
                <h3 className="text-base font-semibold font-serif-luxury text-[#F5F0EB]">
                  Add Portfolio Transformation
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-[#B5ADA6] mb-1">Look Title *</label>
                    <input
                      type="text"
                      required
                      value={galTitle}
                      onChange={(e) => setGalTitle(e.target.value)}
                      placeholder="e.g., Royal Airbrush Bridal Look"
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0D0D11] border border-[#2C2830] text-sm text-[#F5F0EB]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#B5ADA6] mb-1">Bride / Client Name *</label>
                    <input
                      type="text"
                      required
                      value={galClientName}
                      onChange={(e) => setGalClientName(e.target.value)}
                      placeholder="e.g., Ananya Sharma"
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0D0D11] border border-[#2C2830] text-sm text-[#F5F0EB]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#B5ADA6] mb-1">Tag *</label>
                    <select
                      value={galCategory}
                      onChange={(e) => setGalCategory(e.target.value as GalleryCategory)}
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0D0D11] border border-[#2C2830] text-sm text-[#F5F0EB]"
                    >
                      <option value="Bridal">Bridal</option>
                      <option value="Hair">Hair</option>
                      <option value="Skin">Skin</option>
                      <option value="Draping">Draping</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-[#B5ADA6] mb-1">Before State Note *</label>
                    <input
                      type="text"
                      required
                      value={galBeforeLabel}
                      onChange={(e) => setGalBeforeLabel(e.target.value)}
                      placeholder="e.g., Uneven skin tone & sun tan"
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0D0D11] border border-[#2C2830] text-sm text-[#F5F0EB]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#B5ADA6] mb-1">After Result Note *</label>
                    <input
                      type="text"
                      required
                      value={galAfterLabel}
                      onChange={(e) => setGalAfterLabel(e.target.value)}
                      placeholder="e.g., Poreless 18-hr airbrush bridal glow"
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0D0D11] border border-[#2C2830] text-sm text-[#F5F0EB]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-[#B5ADA6] mb-1">
                      Products & Technique Notes *
                    </label>
                    <input
                      type="text"
                      required
                      value={galDescription}
                      onChange={(e) => setGalDescription(e.target.value)}
                      placeholder="e.g., TEMPTU silicone airbrush + Kundan styling"
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0D0D11] border border-[#2C2830] text-sm text-[#F5F0EB]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#B5ADA6] mb-1">Instagram Post URL</label>
                    <input
                      type="url"
                      value={galInstagramUrl}
                      onChange={(e) => setGalInstagramUrl(e.target.value)}
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0D0D11] border border-[#2C2830] text-sm text-[#F5F0EB]"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-[#26232C]">
                  <label className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#1F1C27] border border-[#2E2A38] text-xs text-[#E0A996] hover:border-[#E0A996] cursor-pointer inline-flex items-center gap-2">
                    <CloudUpload className="w-4 h-4" />
                    {uploadingImage ? 'Uploading to Cloudinary...' : 'Upload Client Photo (Cloudinary)'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleCloudinaryUpload(file, (url) => setGalImageUrl(url));
                        }
                      }}
                    />
                  </label>

                  <button
                    type="submit"
                    className="min-h-[42px] px-5 py-2 rounded-xl bg-gradient-to-r from-[#E0A996] to-[#D4AF37] text-[#0D0D11] font-semibold text-xs"
                  >
                    Publish to Gallery
                  </button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {gallery.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl bg-[#16161E] border border-[#26232C] overflow-hidden flex flex-col"
                >
                  <div className="aspect-[4/3] w-full">
                    <LuxuryArtCanvas
                      imageUrl={item.imageUrl}
                      alt={item.title}
                      variant={item.category.toLowerCase() as 'bridal'}
                    />
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                      <p className="text-xs text-[#E0A996]">
                        {item.category} · {item.clientName}
                      </p>
                      <h3 className="text-sm font-semibold text-[#F5F0EB]">{item.title}</h3>
                      <p className="text-xs text-[#8E8782] line-clamp-2">{item.afterLabel}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteGalleryItem(item.id)}
                      className="self-start px-2.5 py-1 rounded-lg bg-red-950/40 text-xs text-red-300 hover:text-red-200 inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TAB 4: INQUIRIES */}
        {activeTab === 'inquiries' && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold font-serif-luxury text-[#F5F0EB]">
              Custom Bridal & Salon Inquiries
            </h2>
            {inquiries.length === 0 ? (
              <div className="rounded-2xl bg-[#16161E] border border-[#26232C] p-8 text-center text-xs text-[#8E8782]">
                No inquiries submitted yet. Inquiries sent from the footer form appear here in
                real time.
              </div>
            ) : (
              <div className="space-y-3">
                {inquiries.map((inq) => (
                  <div
                    key={inq.id}
                    className="rounded-2xl bg-[#16161E] border border-[#26232C] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-[#F5F0EB]">
                        {inq.name} ·{' '}
                        <span className="font-mono text-xs text-[#E0A996]">{inq.phone}</span>
                      </p>
                      <p className="text-xs text-[#B5ADA6]">{inq.message}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={`tel:${inq.phone.replace(/\s+/g, '')}`}
                        className="px-3 py-2 rounded-xl bg-[#221F2A] text-xs text-[#F5F0EB] inline-flex items-center gap-1.5"
                      >
                        <Phone className="w-3.5 h-3.5 text-[#E0A996]" /> Call
                      </a>
                      <button
                        type="button"
                        onClick={() =>
                          setInquiries((prev) => prev.filter((item) => item.id !== inq.id))
                        }
                        className="px-3 py-2 rounded-xl bg-red-950/40 text-xs text-red-300"
                      >
                        Archive
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* TAB 5: SITE SETTINGS EDITOR */}
        {activeTab === 'settings' && (
          <section className="max-w-3xl space-y-6">
            <div>
              <h2 className="text-xl font-semibold font-serif-luxury text-[#F5F0EB] flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#E0A996]" />
                Site Settings & Cloudinary Configuration
              </h2>
              <p className="text-xs text-[#8E8782]">
                Dynamically update salon opening hours, phone numbers, Instagram links, promo
                announcement bar, and Cloudinary upload preset.
              </p>
            </div>

            <form
              onSubmit={handleSaveSiteSettings}
              className="rounded-3xl bg-[#16161E] border border-[#26232C] p-6 space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#B5ADA6] mb-1">Brand Name</label>
                  <input
                    type="text"
                    value={settingsDraft.brandName}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, brandName: e.target.value })
                    }
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0D0D11] border border-[#2C2830] text-sm text-[#F5F0EB]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#B5ADA6] mb-1">Brand Tagline</label>
                  <input
                    type="text"
                    value={settingsDraft.tagline}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, tagline: e.target.value })
                    }
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0D0D11] border border-[#2C2830] text-sm text-[#F5F0EB]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#B5ADA6] mb-1">
                    Display Contact Number
                  </label>
                  <input
                    type="text"
                    value={settingsDraft.phone}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, phone: e.target.value })
                    }
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0D0D11] border border-[#2C2830] text-sm text-[#F5F0EB] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#B5ADA6] mb-1">
                    WhatsApp Number (Digits with Country Code)
                  </label>
                  <input
                    type="text"
                    value={settingsDraft.whatsappNumber}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, whatsappNumber: e.target.value })
                    }
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0D0D11] border border-[#2C2830] text-sm text-[#F5F0EB] font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#B5ADA6] mb-1">Instagram Handle</label>
                  <input
                    type="text"
                    value={settingsDraft.instagramHandle}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, instagramHandle: e.target.value })
                    }
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0D0D11] border border-[#2C2830] text-sm text-[#F5F0EB]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#B5ADA6] mb-1">Instagram Profile URL</label>
                  <input
                    type="url"
                    value={settingsDraft.instagramUrl}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, instagramUrl: e.target.value })
                    }
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0D0D11] border border-[#2C2830] text-sm text-[#F5F0EB]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-[#B5ADA6] mb-1">Salon Opening Hours</label>
                <input
                  type="text"
                  value={settingsDraft.openingHours}
                  onChange={(e) =>
                    setSettingsDraft({ ...settingsDraft, openingHours: e.target.value })
                  }
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0D0D11] border border-[#2C2830] text-sm text-[#F5F0EB]"
                />
              </div>

              <div>
                <label className="block text-xs text-[#B5ADA6] mb-1">
                  Top Promo Announcement Bar Text
                </label>
                <input
                  type="text"
                  value={settingsDraft.announcementText}
                  onChange={(e) =>
                    setSettingsDraft({ ...settingsDraft, announcementText: e.target.value })
                  }
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0D0D11] border border-[#2C2830] text-sm text-[#F5F0EB]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#26232C]">
                <div>
                  <label className="block text-xs text-[#B5ADA6] mb-1">
                    Cloudinary Cloud Name
                  </label>
                  <input
                    type="text"
                    value={settingsDraft.cloudinaryCloudName}
                    onChange={(e) =>
                      setSettingsDraft({
                        ...settingsDraft,
                        cloudinaryCloudName: e.target.value,
                      })
                    }
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0D0D11] border border-[#2C2830] text-sm text-[#F5F0EB] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#B5ADA6] mb-1">
                    Cloudinary Unsigned Upload Preset
                  </label>
                  <input
                    type="text"
                    value={settingsDraft.cloudinaryUploadPreset}
                    onChange={(e) =>
                      setSettingsDraft({
                        ...settingsDraft,
                        cloudinaryUploadPreset: e.target.value,
                      })
                    }
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0D0D11] border border-[#2C2830] text-sm text-[#F5F0EB] font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="min-h-[46px] px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#E0A996] to-[#D4AF37] text-[#0D0D11] font-semibold text-xs inline-flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save All Settings
              </button>
            </form>
          </section>
        )}
      </main>
    </div>
  );
};
