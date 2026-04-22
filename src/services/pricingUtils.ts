export interface DayUseSlot {
  id: string;
  name: string;
  name_ar?: string;
  start_time: string;  // HH:MM
  end_time: string;    // HH:MM
  sunday_rate: number;
  monday_rate: number;
  tuesday_rate: number;
  wednesday_rate: number;
  thursday_rate: number;
  friday_rate: number;
  saturday_rate: number;
}

export interface PricingSettings {
  sunday_rate: number;
  monday_rate: number;
  tuesday_rate: number;
  wednesday_rate: number;
  thursday_rate: number;
  friday_rate: number;
  saturday_rate: number;
  day_use_rate: number;         // Same-day "Day Use" price (e.g. 12 PM – 10 PM)
  event_category_name?: string; // Admin-editable label for the Event option (e.g. "Private Function")
  event_rate?: number;          // Per-night price used when stay_type = 'event'
  security_deposit: number;     // Refundable — excluded from revenue/tax
  special_dates: { date: string; price: number }[];  // YYYY-MM-DD
  discount?: {
    enabled: boolean;
    type: 'percent' | 'flat';
    value: number;
    start_date: string;
    end_date: string;
  };
  day_use_slots?: DayUseSlot[];
  // Legacy compat — ignored if individual days are set
  weekday_rate?: number;
}

export interface PriceBreakdown {
  nights: number;
  isDayUse: boolean;
  subtotal: number;
  discount_amount: number;
  total: number;
  per_night: { date: string; dayLabel: string; rate: number; isSpecial: boolean }[];
  slotName?: string;
  slotNameAr?: string;
  slotTime?: string;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Parse a YYYY-MM-DD string as a local-timezone Date (midnight local).
 * `new Date('2024-04-27')` parses as UTC midnight, which in negative-offset
 * timezones rolls back to the previous day when read with local getters —
 * causing off-by-one bugs in the breakdown.
 */
export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Format a Date as YYYY-MM-DD using local components (NOT UTC). */
export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

/** Format 24h time string to readable format (e.g. "14:00" → "2 PM" / "٢ م") */
export function formatTime(time: string, lang = 'en'): string {
  const [h, m] = time.split(':').map(Number);
  if (lang === 'ar') {
    const period = h >= 12 ? 'م' : 'ص';
    const hour = h % 12 || 12;
    const hourStr = hour.toLocaleString('ar-SA');
    if (m === 0) return `${hourStr} ${period}`;
    const minStr = String(m).padStart(2, '0').split('').map(d => '٠١٢٣٤٥٦٧٨٩'[+d]).join('');
    return `${hourStr}:${minStr} ${period}`;
  }
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${period}` : `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

/** Get the slot rate for a given day-of-week */
export function getSlotRateForDay(dow: number, slot: DayUseSlot): number {
  switch (dow) {
    case 0: return slot.sunday_rate;
    case 1: return slot.monday_rate;
    case 2: return slot.tuesday_rate;
    case 3: return slot.wednesday_rate;
    case 4: return slot.thursday_rate;
    case 5: return slot.friday_rate;
    case 6: return slot.saturday_rate;
    default: return slot.sunday_rate;
  }
}

/** Get the nightly rate for a given day-of-week (0=Sun … 6=Sat) */
function getRateForDay(dow: number, pricing: PricingSettings): number {
  switch (dow) {
    case 0: return pricing.sunday_rate;
    case 1: return pricing.monday_rate;
    case 2: return pricing.tuesday_rate;
    case 3: return pricing.wednesday_rate;
    case 4: return pricing.thursday_rate;
    case 5: return pricing.friday_rate;
    case 6: return pricing.saturday_rate;
    default: return pricing.sunday_rate;
  }
}

/** Get all 7 nightly rates as an array */
export function getAllRates(pricing: PricingSettings): number[] {
  return [
    pricing.sunday_rate, pricing.monday_rate, pricing.tuesday_rate,
    pricing.wednesday_rate, pricing.thursday_rate, pricing.friday_rate,
    pricing.saturday_rate,
  ];
}

export function calculateTotalPrice(
  checkIn: string,
  checkOut: string,
  pricing: PricingSettings,
  slotId?: string
): PriceBreakdown {
  const start = parseLocalDate(checkIn);
  const end = parseLocalDate(checkOut);
  const specialMap = new Map(pricing.special_dates.map(s => [s.date, s.price]));

  // Day Use: check-in === check-out
  const isDayUse = checkIn === checkOut;
  if (isDayUse) {
    const dateStr = checkIn;
    const dow = start.getDay();
    const dayLabel = DAY_LABELS[dow];

    // Slot-based pricing
    if (slotId && pricing.day_use_slots?.length) {
      const slot = pricing.day_use_slots.find(s => s.id === slotId);
      if (slot) {
        let rate = getSlotRateForDay(dow, slot);
        const isSpecial = specialMap.has(dateStr);
        if (isSpecial) rate = specialMap.get(dateStr)!;

        let discountAmount = 0;
        if (pricing.discount?.enabled && pricing.discount.start_date && pricing.discount.end_date) {
          if (dateStr >= pricing.discount.start_date && dateStr <= pricing.discount.end_date) {
            if (pricing.discount.type === 'percent') {
              discountAmount = Math.round(rate * (pricing.discount.value / 100) * 100) / 100;
            } else {
              discountAmount = pricing.discount.value;
            }
          }
        }

        return {
          nights: 0,
          isDayUse: true,
          subtotal: rate,
          discount_amount: discountAmount,
          total: Math.max(0, rate - discountAmount),
          per_night: [{ date: dateStr, dayLabel, rate, isSpecial }],
          slotName: slot.name,
          slotNameAr: slot.name_ar,
          slotTime: `${formatTime(slot.start_time)} – ${formatTime(slot.end_time)}`,
        };
      }
    }

    // Fallback: flat day_use_rate
    let rate = pricing.day_use_rate || 0;
    const isSpecial = specialMap.has(dateStr);
    if (isSpecial) rate = specialMap.get(dateStr)!;

    let discountAmount = 0;
    if (pricing.discount?.enabled && pricing.discount.start_date && pricing.discount.end_date) {
      if (dateStr >= pricing.discount.start_date && dateStr <= pricing.discount.end_date) {
        if (pricing.discount.type === 'percent') {
          discountAmount = Math.round(rate * (pricing.discount.value / 100) * 100) / 100;
        } else {
          discountAmount = pricing.discount.value;
        }
      }
    }

    return {
      nights: 0,
      isDayUse: true,
      subtotal: rate,
      discount_amount: discountAmount,
      total: Math.max(0, rate - discountAmount),
      per_night: [{ date: dateStr, dayLabel, rate, isSpecial }],
    };
  }

  // Multi-night stay
  const perNight: PriceBreakdown['per_night'] = [];
  let subtotal = 0;

  const cursor = new Date(start);
  while (cursor < end) {
    const dateStr = formatLocalDate(cursor);
    const dow = cursor.getDay();
    const dayLabel = DAY_LABELS[dow];

    let rate: number;
    let isSpecial = false;

    if (specialMap.has(dateStr)) {
      rate = specialMap.get(dateStr)!;
      isSpecial = true;
    } else {
      rate = getRateForDay(dow, pricing);
    }

    subtotal += rate;
    perNight.push({ date: dateStr, dayLabel, rate, isSpecial });
    cursor.setDate(cursor.getDate() + 1);
  }

  // Apply discount if active and dates overlap
  let discountAmount = 0;
  if (pricing.discount?.enabled && pricing.discount.start_date && pricing.discount.end_date) {
    const discStart = pricing.discount.start_date;
    const discEnd = pricing.discount.end_date;
    const overlapping = perNight.filter(n => n.date >= discStart && n.date <= discEnd);
    if (overlapping.length > 0) {
      if (pricing.discount.type === 'percent') {
        discountAmount = Math.round(subtotal * (pricing.discount.value / 100) * 100) / 100;
      } else {
        discountAmount = pricing.discount.value;
      }
    }
  }

  return {
    nights: perNight.length,
    isDayUse: false,
    subtotal,
    discount_amount: discountAmount,
    total: Math.max(0, subtotal - discountAmount),
    per_night: perNight,
  };
}

/** Detect "Full Day" slots by English name (case-insensitive) */
function isFullDaySlot(name?: string): boolean {
  return !!name && /full\s*day/i.test(name);
}

/** Build a human-readable breakdown string */
export function formatBreakdown(
  b: PriceBreakdown,
  lang = 'en',
  t?: (key: string) => string,
  /** Original English slot name — used for full-day detection */
  slotNameEn?: string
): string {
  if (b.isDayUse) {
    if (b.slotName) {
      // "Full Day" slot → same label as no-slot day use
      if (isFullDaySlot(slotNameEn || b.slotName)) {
        return t ? t('common.dayUse') : (lang === 'ar' ? 'يوم كامل بدون مبيت' : 'Day Use');
      }
      // Partial slot → show the slot's localised name
      return b.slotName;
    }
    // No slot selected → full-day use
    return t ? t('common.dayUse') : (lang === 'ar' ? 'يوم كامل بدون مبيت' : 'Day Use');
  }
  if (lang === 'ar') {
    return `${b.nights} ${t ? t(b.nights > 1 ? 'common.nights' : 'common.night') : (b.nights > 1 ? 'ليالٍ' : 'ليلة')}`;
  }
  return `${b.nights} Night${b.nights > 1 ? 's' : ''}`;
}

// ── Check-in / Check-out timing engine ──────────────────────────────────────
//
// Al Malak operates on a weekday/weekend schedule:
//   Sun–Wed : day use ends 10 PM, overnight check-out 10 AM
//   Thu–Sat : day use ends 11 PM, overnight check-out 11 AM
// Check-in is always 2 PM. The rules key off the DAY THE GUEST LEAVES
// (same day for day-use, next day for overnight) so the calendar can surface
// accurate times the moment the guest picks dates.

export interface StayTimes {
  /** 24h start time, always "14:00" */
  checkInTime: string;
  /** 24h end time — "22:00"/"23:00" for day-use, "10:00"/"11:00" for overnight */
  checkOutTime: string;
  /** Localised check-in label (e.g. "2:00 PM") */
  checkInLabel: string;
  /** Localised check-out label */
  checkOutLabel: string;
  /** true if check-out is the calendar day after check-in */
  isOvernight: boolean;
}

/** Days Thu(4)–Sat(6) get the late (11 PM / 11 AM) schedule. */
function isLateScheduleDay(dow: number): boolean {
  return dow === 4 || dow === 5 || dow === 6;
}

/** Day-use times for a single-day stay on `date`. */
export function getDayUseTimes(date: Date, lang = 'en'): StayTimes {
  const dow = date.getDay();
  const checkInTime = '14:00';
  const checkOutTime = isLateScheduleDay(dow) ? '23:00' : '22:00';
  return {
    checkInTime,
    checkOutTime,
    checkInLabel: formatTime(checkInTime, lang),
    checkOutLabel: formatTime(checkOutTime, lang),
    isOvernight: false,
  };
}

/**
 * Overnight times. `checkOutDate` is the calendar day the guest LEAVES — that
 * day's weekday determines the 10/11 AM cut-off so a booking that ends on a
 * Thursday gets the 11 AM grace window.
 */
export function getNightStayTimes(checkOutDate: Date, lang = 'en'): StayTimes {
  const dow = checkOutDate.getDay();
  const checkInTime = '14:00';
  const checkOutTime = isLateScheduleDay(dow) ? '11:00' : '10:00';
  return {
    checkInTime,
    checkOutTime,
    checkInLabel: formatTime(checkInTime, lang),
    checkOutLabel: formatTime(checkOutTime, lang),
    isOvernight: true,
  };
}

/** Migrate legacy 4-rate pricing to 7-day format */
export function migratePricing(raw: any): PricingSettings {
  // If already has sunday_rate, it's the new format
  if (raw.sunday_rate !== undefined) return raw as PricingSettings;

  // Migrate from legacy weekday_rate / thursday / friday / saturday
  const weekday = raw.weekday_rate || 120;
  return {
    sunday_rate: weekday,
    monday_rate: weekday,
    tuesday_rate: weekday,
    wednesday_rate: weekday,
    thursday_rate: raw.thursday_rate || weekday,
    friday_rate: raw.friday_rate || weekday,
    saturday_rate: raw.saturday_rate || weekday,
    day_use_rate: raw.day_use_rate || Math.round(weekday * 0.6),
    event_category_name: raw.event_category_name || '',
    event_rate: raw.event_rate ?? Math.round(weekday * 2),
    security_deposit: raw.security_deposit || 50,
    special_dates: raw.special_dates || [],
    day_use_slots: raw.day_use_slots || [],
    discount: raw.discount,
  };
}
