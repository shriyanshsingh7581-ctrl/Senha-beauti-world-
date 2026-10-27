import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, CheckCircle2, Phone, Sparkles, ShieldCheck } from 'lucide-react';
import { User } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError } from '../firebase';
import {
  ServiceItem,
  SiteSettings,
  AppointmentItem,
  OperationType,
} from '../types';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  services: ServiceItem[];
  preselectedService: ServiceItem | null;
  siteSettings: SiteSettings;
  currentUser: User | null;
  onSignInGoogle: () => Promise<void>;
  onBookingCreated: (booking: AppointmentItem) => void;
}

const TIME_SLOTS = [
  '10:00 AM',
  '11:30 AM',
  '01:00 PM',
  '02:30 PM',
  '04:00 PM',
  '05:30 PM',
  '07:00 PM',
];

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  services,
  preselectedService,
  siteSettings,
  currentUser,
  onSignInGoogle,
  onBookingCreated,
}) => {
  const activeServices = services.filter((s) => s.isActive);
  const tomorrowDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState(
    preselectedService?.id || activeServices[0]?.id || ''
  );
  const [appointmentDate, setAppointmentDate] = useState(tomorrowDate);
  const [timeSlot, setTimeSlot] = useState('11:30 AM');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<AppointmentItem | null>(null);

  useEffect(() => {
    if (preselectedService) {
      setSelectedServiceId(preselectedService.id);
    } else if (!selectedServiceId && activeServices.length > 0) {
      setSelectedServiceId(activeServices[0].id);
    }
  }, [preselectedService, activeServices, selectedServiceId]);

  useEffect(() => {
    if (currentUser?.displayName && !clientName) {
      setClientName(currentUser.displayName.slice(0, 100));
    }
  }, [currentUser, clientName]);

  if (!isOpen) return null;

  const selectedService =
    activeServices.find((s) => s.id === selectedServiceId) || activeServices[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanName = clientName.trim().slice(0, 100);
    const cleanPhone = clientPhone.trim().slice(0, 25);
    const cleanNotes = notes.trim().slice(0, 500);

    if (cleanName.length < 2) {
      setErrorMsg('Please enter your full name (at least 2 characters).');
      return;
    }
    if (cleanPhone.length < 7) {
      setErrorMsg('Please enter a valid 10-digit phone or WhatsApp number.');
      return;
    }
    if (!selectedService) {
      setErrorMsg('Please select a salon or bridal service.');
      return;
    }

    setIsSubmitting(true);
    const appointmentId = `apt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const clientUid = currentUser?.uid || `guest_${Date.now()}`;

    const newAppointment: AppointmentItem = {
      id: appointmentId,
      clientUid,
      clientName: cleanName,
      clientPhone: cleanPhone,
      serviceId: selectedService.id,
      serviceTitle: selectedService.title.slice(0, 120),
      servicePrice: Number(selectedService.price),
      appointmentDate: appointmentDate.slice(0, 20),
      timeSlot: timeSlot.slice(0, 30),
      notes: cleanNotes,
      status: 'Pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      if (currentUser && currentUser.emailVerified) {
        const docRef = doc(db, 'appointments', appointmentId);
        try {
          await setDoc(docRef, {
            clientUid: currentUser.uid,
            clientName: newAppointment.clientName,
            clientPhone: newAppointment.clientPhone,
            serviceId: newAppointment.serviceId,
            serviceTitle: newAppointment.serviceTitle,
            servicePrice: newAppointment.servicePrice,
            appointmentDate: newAppointment.appointmentDate,
            timeSlot: newAppointment.timeSlot,
            notes: newAppointment.notes,
            status: 'Pending',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (fireErr) {
          // If the service isn't seeded to cloud yet, keep local record and log
          console.warn('Cloud sync deferred, storing booking locally:', fireErr);
        }
      }

      onBookingCreated(newAppointment);
      setConfirmedBooking(newAppointment);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `appointments/${appointmentId}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAndClose = () => {
    setConfirmedBooking(null);
    setErrorMsg(null);
    setNotes('');
    onClose();
  };

  const whatsappText = confirmedBooking
    ? encodeURIComponent(
        `✨ *New Appointment Request — ${siteSettings.brandName}* ✨\n\n` +
          `*Booking Ref:* #${confirmedBooking.id.slice(-6).toUpperCase()}\n` +
          `*Client Name:* ${confirmedBooking.clientName}\n` +
          `*Phone:* ${confirmedBooking.clientPhone}\n` +
          `*Service:* ${confirmedBooking.serviceTitle}\n` +
          `*Package Price:* ₹${confirmedBooking.servicePrice.toLocaleString('en-IN')}\n` +
          `*Preferred Date:* ${confirmedBooking.appointmentDate}\n` +
          `*Time Slot:* ${confirmedBooking.timeSlot}\n` +
          (confirmedBooking.notes ? `*Special Notes:* ${confirmedBooking.notes}\n\n` : '\n') +
          `Please confirm my slot at Sneha Beauty World.`
      )
    : '';

  const whatsappUrl = `https://wa.me/${siteSettings.whatsappNumber}?text=${whatsappText}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-modal-title"
    >
      <div className="relative w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-[#16161E] border border-[#2C2830] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Top Mobile Sheet Drag Handle */}
        <div className="w-10 h-1.5 bg-[#342E37] rounded-full mx-auto mt-3 sm:hidden" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#26232B]">
          <div className="flex items-center gap-3">
            <img
              src="/assets/aistudio/IMG-20261027-WA0047_89a5906b.jpg"
              alt={siteSettings.brandName}
              className="w-11 h-11 rounded-full object-cover border border-[#D4AF37]/50 shrink-0"
            />
            <div>
              <p className="text-xs text-[#E0A996] tracking-wide">
                {siteSettings.brandName} · Priority Concierge
              </p>
              <h2
                id="booking-modal-title"
                className="text-xl font-semibold text-[#F5F0EB] font-serif-luxury"
              >
                {confirmedBooking ? 'Appointment Reserved' : 'Reserve Your Luxury Session'}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            aria-label="Close booking modal"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#B5ADA6] hover:text-[#F5F0EB] hover:bg-[#221F28] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {confirmedBooking ? (
            <div className="space-y-6 py-2">
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-[#1D1B24] border border-[#D4AF37]/30">
                <CheckCircle2 className="w-7 h-7 text-[#D4AF37] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[#F5F0EB]">
                    Booking Reference #{confirmedBooking.id.slice(-6).toUpperCase()}
                  </p>
                  <p className="text-xs text-[#B5ADA6] leading-relaxed">
                    Thank you, {confirmedBooking.clientName}. Your request for{' '}
                    <span className="text-[#E0A996] font-medium">
                      {confirmedBooking.serviceTitle}
                    </span>{' '}
                    has been logged in our system.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-[#111116] border border-[#252229] p-4 space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#8E8782]">Service</span>
                  <span className="text-[#F5F0EB] font-medium text-right">
                    {confirmedBooking.serviceTitle}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8E8782]">Date & Time</span>
                  <span className="text-[#F5F0EB] font-mono tabular-nums">
                    {confirmedBooking.appointmentDate} · {confirmedBooking.timeSlot}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8E8782]">Estimated Tariff</span>
                  <span className="text-[#D4AF37] font-mono tabular-nums font-semibold">
                    ₹{confirmedBooking.servicePrice.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8E8782]">Client Contact</span>
                  <span className="text-[#F5F0EB] font-mono tabular-nums">
                    {confirmedBooking.clientPhone}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-gradient-to-r from-[#E0A996] to-[#D4AF37] text-[#0D0D11] font-semibold text-sm flex items-center justify-center gap-2 shadow-lg hover:opacity-95 transition-opacity whitespace-nowrap"
                >
                  <Sparkles className="w-4 h-4" />
                  Send Instant Confirmation on WhatsApp ({siteSettings.phone})
                </a>

                <div className="flex items-center gap-3">
                  <a
                    href={`tel:${siteSettings.phone.replace(/\s+/g, '')}`}
                    className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl border border-[#2E2A33] text-[#F5F0EB] hover:border-[#E0A996] text-xs font-medium flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                  >
                    <Phone className="w-4 h-4 text-[#E0A996]" />
                    Call Studio Directly
                  </a>
                  <button
                    type="button"
                    onClick={resetAndClose}
                    className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#221F28] text-[#B5ADA6] hover:text-[#F5F0EB] text-xs font-medium transition-colors whitespace-nowrap"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Cloud Auth Sync Banner */}
              <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#111116] border border-[#26232B] text-xs">
                <div className="flex items-center gap-2 text-[#B5ADA6]">
                  <ShieldCheck className="w-4 h-4 text-[#D4AF37] shrink-0" />
                  <span>
                    {currentUser
                      ? `Signed in as ${currentUser.email} (Cloud Sync Active)`
                      : 'Sign in with Google to track your booking in Cloud'}
                  </span>
                </div>
                {!currentUser && (
                  <button
                    type="button"
                    onClick={onSignInGoogle}
                    className="text-[#E0A996] hover:underline font-medium whitespace-nowrap shrink-0"
                  >
                    Sign In
                  </button>
                )}
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-950/50 border border-red-500/40 text-xs text-red-200">
                  {errorMsg}
                </div>
              )}

              {/* Service Selector */}
              <div>
                <label className="block text-xs font-medium text-[#B5ADA6] mb-1.5">
                  Select Service or Bridal Package
                </label>
                <select
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#0D0D11] border border-[#2C2830] text-sm text-[#F5F0EB] focus:outline-none focus:border-[#E0A996]"
                >
                  {activeServices.map((srv) => (
                    <option key={srv.id} value={srv.id}>
                      {srv.category} — {srv.title} (₹{srv.price.toLocaleString('en-IN')} ·{' '}
                      {srv.duration})
                    </option>
                  ))}
                </select>
              </div>

              {/* Client Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-[#B5ADA6] mb-1.5">
                    Your Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={100}
                    placeholder="e.g., Priya Sharma"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#0D0D11] border border-[#2C2830] text-sm text-[#F5F0EB] placeholder-[#68625E] focus:outline-none focus:border-[#E0A996]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#B5ADA6] mb-1.5">
                    Phone / WhatsApp Number *
                  </label>
                  <input
                    type="tel"
                    required
                    minLength={7}
                    maxLength={25}
                    placeholder="+91 98765 43210"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#0D0D11] border border-[#2C2830] text-sm text-[#F5F0EB] placeholder-[#68625E] font-mono tabular-nums focus:outline-none focus:border-[#E0A996]"
                  />
                </div>
              </div>

              {/* Date & Time Slot */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-[#B5ADA6] mb-1.5">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#E0A996]" /> Preferred Date *
                    </span>
                  </label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#0D0D11] border border-[#2C2830] text-sm text-[#F5F0EB] font-mono tabular-nums focus:outline-none focus:border-[#E0A996]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#B5ADA6] mb-1.5">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#E0A996]" /> Preferred Time Slot *
                    </span>
                  </label>
                  <select
                    value={timeSlot}
                    onChange={(e) => setTimeSlot(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#0D0D11] border border-[#2C2830] text-sm text-[#F5F0EB] font-mono tabular-nums focus:outline-none focus:border-[#E0A996]"
                  >
                    {TIME_SLOTS.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-[#B5ADA6] mb-1.5">
                  Bridal Venue / Skin Type / Special Requests (Optional)
                </label>
                <textarea
                  rows={2}
                  maxLength={500}
                  placeholder="Share your wedding date, skin sensitivities, or draping style preference..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#0D0D11] border border-[#2C2830] text-sm text-[#F5F0EB] placeholder-[#68625E] focus:outline-none focus:border-[#E0A996]"
                />
              </div>

              {/* Selected Package Summary */}
              {selectedService && (
                <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#111116] border border-[#26232B] text-xs">
                  <div>
                    <span className="text-[#8E8782]">Selected Tariff</span>
                    <p className="text-[#F5F0EB] font-medium mt-0.5">{selectedService.title}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-semibold text-[#D4AF37] font-mono tabular-nums">
                      ₹{selectedService.price.toLocaleString('en-IN')}
                    </span>
                    <p className="text-[11px] text-[#8E8782] font-mono tabular-nums">
                      {selectedService.duration}
                    </p>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-gradient-to-r from-[#E0A996] to-[#D4AF37] text-[#0D0D11] font-semibold text-sm flex items-center justify-center gap-2 shadow-lg hover:opacity-95 transition-opacity disabled:opacity-50 whitespace-nowrap"
              >
                {isSubmitting ? 'Confirming Slot...' : 'Confirm Appointment & Get WhatsApp Pass'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
