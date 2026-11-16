import React, { useState } from 'react';
import { CartItem, Language, translations, formatPrice } from '../types';
import { BrandLogo } from './BrandLogo';
import { PaymentIcons } from './PaymentIcons';
import { X, Check, ArrowRight, ShieldCheck } from 'lucide-react';
import { createStoreOrder } from '../supabase/dbService';
import { supabase } from '../supabase/config';
import { lockBodyScroll, unlockBodyScroll } from '../utils/scrollLock';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onOrderSuccess: () => void;
  language: Language;
}

const STEP_LABELS: Array<{ step: 1 | 2 | 3; label: string }> = [
  { step: 1, label: 'Delivery' },
  { step: 2, label: 'Payment' },
  { step: 3, label: 'Confirmation' },
];

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  items,
  onOrderSuccess,
  language,
}) => {
  const t = translations[language].checkout;

  // Body scroll lock on open
  React.useEffect(() => {
    if (isOpen) {
      lockBodyScroll();
    } else {
      unlockBodyScroll();
    }
    return () => unlockBodyScroll();
  }, [isOpen]);

  // Steps: 1 = Toimitus, 2 = Maksu, 3 = Vahvistus
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form states - starting clean without seeded values
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [street, setStreet] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');

  const [shippingMethod, setShippingMethod] = useState<'express' | 'standard' | 'whiteglove'>('express');
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'mobilepay' | 'klarna' | 'card' | 'applepay'>('card');
  const [selectedBank, setSelectedBank] = useState('OP');
  const [createdOrderNumber, setCreatedOrderNumber] = useState('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  const subtotal = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  const shippingCost = shippingMethod === 'whiteglove' ? 12.0 : (subtotal >= 100 ? 0 : 4.9);
  const total = subtotal + shippingCost;

  if (!isOpen) return null;

  const handleProceedToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setOrderError(null);
    setStep(2);
  };

  const handleConfirmOrder = async () => {
    if (isSubmittingOrder) return;
    setIsSubmittingOrder(true);
    setOrderError(null);
    try {
      const res = await createStoreOrder({
        customer: {
          id: email.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          email: email.trim(),
          name: `${firstName.trim()} ${lastName.trim()}`,
          phone: phone.trim(),
          address: {
            street: street.trim(),
            postalCode: postalCode.trim(),
            city: city.trim(),
            country: 'Finland',
          },
        },
        items: items.map((it) => ({
          productId: it.product.id,
          productNr: it.product.plateNumber || it.product.nr || 'Nº 001',
          productName: it.product.name.en || it.product.name.fi || 'Archival Garment',
          size: it.size,
          quantity: it.quantity,
          price: it.product.price,
        })),
        totals: {
          subtotal,
          shipping: shippingCost,
          vat: +(subtotal * 0.24 / 1.24).toFixed(2),
          discount: 0,
          total,
        },
        status: 'paid',
        shippingMethod: shippingMethod === 'whiteglove' ? 'White Glove Delivery' : 'Express Courier Tracked',
        timeline: [
          {
            at: new Date().toISOString(),
            status: 'paid',
            note: `Verified checkout payment received via ${paymentMethod.toUpperCase()}`,
            by: 'Storefront Checkout',
          },
        ],
        createdAt: new Date().toISOString(),
      });

      if (!res?.id) {
        throw new Error('No order reference was returned.');
      }

      // Read the row back so the receipt only ever shows a number the database holds.
      const { data: stored, error: readError } = await supabase
        .from('orders')
        .select('id, number')
        .eq('id', res.id)
        .maybeSingle();

      if (readError || !stored?.id) {
        throw new Error('The order could not be confirmed in the database.');
      }

      setCreatedOrderNumber(stored.number || res.number || stored.id);
      setStep(3);
      onOrderSuccess();
    } catch (err) {
      // Honest failure: stay on the payment step and never show a fake receipt.
      console.error('Order placement error:', err);
      setOrderError(
        'Your order could not be placed — no order was created. Please check your connection and try again.'
      );
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const optionRowClass = (active: boolean) =>
    `grid grid-cols-[auto_1fr_auto] items-start gap-4 py-4 min-h-[44px] cursor-pointer transition-opacity duration-300 ${
      active ? 'text-ink' : 'text-ink/40 hover:text-ink/70'
    }`;

  const markerClass = (active: boolean) =>
    `mt-[5px] h-2 w-2 shrink-0 rounded-full transition-colors duration-300 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-current ${
      active ? 'bg-ink' : 'bg-ink/20'
    }`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Checkout"
      className="fixed inset-0 z-[95] bg-paper text-ink flex flex-col overflow-y-auto animate-fadeIn"
      style={{
        height: '100dvh',
        minHeight: '100dvh',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {/* Minimal checkout header — wordmark left, numbered steps, close */}
      <div className="w-full border-b border-ink-a18">
        <div className="max-w-6xl w-full mx-auto px-5 sm:px-8 h-16 sm:h-20 flex items-center justify-between gap-4">
          <BrandLogo size="sm" />

          <div className="hidden sm:flex items-center gap-3 md:gap-5">
            {STEP_LABELS.map((item, index) => (
              <React.Fragment key={item.step}>
                {index > 0 && <span className="text-ink-a18">/</span>}
                <span
                  className={`label transition-colors duration-300 ${
                    step === item.step ? 'text-ink' : 'text-ink-a45'
                  }`}
                >
                  <span className="font-mono mr-2">{String(item.step).padStart(2, '0')}</span>
                  {item.label}
                </span>
              </React.Fragment>
            ))}
          </div>

          <span className="label sm:hidden text-ink-a45">
            <span className="font-mono mr-2">{String(step).padStart(2, '0')}</span>
            {STEP_LABELS[step - 1].label}
          </span>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] -mr-2 p-2 flex items-center justify-center text-ink-a45 hover:text-ink transition-colors cursor-pointer"
            aria-label="Close checkout"
          >
            <X className="w-5 h-5 stroke-[1.5]" />
          </button>
        </div>
      </div>

      {/* Main body — two columns, hairlines only */}
      <div className="max-w-6xl w-full mx-auto px-5 sm:px-8 py-8 sm:py-12 flex-1 grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-16">
        {/* LEFT COLUMN: STEPS */}
        <div className="md:col-span-7 md:pr-8 md:border-r md:border-ink-a18">
          {/* STEP 1: DELIVERY */}
          {step === 1 && (
            <form onSubmit={handleProceedToPayment} className="space-y-10 animate-fadeIn">
              <div className="space-y-3">
                <span className="label text-ink-a45">Step 01 — Delivery</span>
                <h3 className="font-display font-light text-[clamp(28px,4vw,44px)] leading-[1.05] tracking-tight">
                  Customer &amp; <em>delivery</em>
                </h3>
                <p className="body-copy text-ink-a45">
                  Provide your delivery coordinates for real-time dispatch tracking.
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <label htmlFor="checkout-email" className="field-label">
                    Email Address
                  </label>
                  <input
                    id="checkout-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="field"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="checkout-first-name" className="field-label">
                      First Name
                    </label>
                    <input
                      id="checkout-first-name"
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="field"
                    />
                  </div>
                  <div>
                    <label htmlFor="checkout-last-name" className="field-label">
                      Last Name
                    </label>
                    <input
                      id="checkout-last-name"
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="field"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="checkout-street" className="field-label">
                    Street Address
                  </label>
                  <input
                    id="checkout-street"
                    type="text"
                    required
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    className="field"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="checkout-postal-code" className="field-label">
                      Postal Code
                    </label>
                    <input
                      id="checkout-postal-code"
                      type="text"
                      required
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      className="field"
                    />
                  </div>
                  <div>
                    <label htmlFor="checkout-city" className="field-label">
                      City
                    </label>
                    <input
                      id="checkout-city"
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="field"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="checkout-phone" className="field-label">
                    Phone (for parcel notifications)
                  </label>
                  <input
                    id="checkout-phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="field"
                  />
                </div>
              </div>

              {/* Shipping method — hairline rows, square markers, inverted selection */}
              <div className="space-y-4">
                <div className="flex items-baseline justify-between border-b border-ink-a18 pb-3">
                  <h4 className="font-display font-light text-2xl">Shipping method</h4>
                  <span className="label text-ink-a45">Tier</span>
                </div>

                <div className="border border-ink-a18 divide-y divide-paper-a18">
                  <label className={optionRowClass(shippingMethod === 'express')}>
                    <input
                      type="radio"
                      name="shipping"
                      checked={shippingMethod === 'express'}
                      onChange={() => setShippingMethod('express')}
                      className="peer sr-only"
                    />
                    <span aria-hidden="true" className={markerClass(shippingMethod === 'express')} />
                    <span>
                      <span className="block text-[13px] tracking-[0.04em]">
                        Nordic Tracked Express (1–2 Business Days)
                      </span>
                      <span
                        className={`mt-1 block text-[12px] ${
                          shippingMethod === 'express' ? 'text-ink/55' : 'text-ink/35'
                        }`}
                      >
                        Direct service point or automated parcel locker
                      </span>
                    </span>
                    <span className="price">{subtotal >= 100 ? '€0.00' : '€4.90'}</span>
                  </label>

                  <label className={optionRowClass(shippingMethod === 'standard')}>
                    <input
                      type="radio"
                      name="shipping"
                      checked={shippingMethod === 'standard'}
                      onChange={() => setShippingMethod('standard')}
                      className="peer sr-only"
                    />
                    <span aria-hidden="true" className={markerClass(shippingMethod === 'standard')} />
                    <span>
                      <span className="block text-[13px] tracking-[0.04em]">
                        Carbon-Neutral Postal Service (2–4 Days)
                      </span>
                      <span
                        className={`mt-1 block text-[12px] ${
                          shippingMethod === 'standard' ? 'text-ink/55' : 'text-ink/35'
                        }`}
                      >
                        Eco-certified delivery across Europe
                      </span>
                    </span>
                    <span className="price">{subtotal >= 100 ? '€0.00' : '€4.90'}</span>
                  </label>

                  <label className={optionRowClass(shippingMethod === 'whiteglove')}>
                    <input
                      type="radio"
                      name="shipping"
                      checked={shippingMethod === 'whiteglove'}
                      onChange={() => setShippingMethod('whiteglove')}
                      className="peer sr-only"
                    />
                    <span aria-hidden="true" className={markerClass(shippingMethod === 'whiteglove')} />
                    <span>
                      <span className="block text-[13px] tracking-[0.04em]">
                        White Glove Home Delivery
                      </span>
                      <span
                        className={`mt-1 block text-[12px] ${
                          shippingMethod === 'whiteglove' ? 'text-ink/55' : 'text-ink/35'
                        }`}
                      >
                        Scheduled courier directly to your door
                      </span>
                    </span>
                    <span className="price">€12.00</span>
                  </label>
                </div>
              </div>

              <button type="submit" className="w-full btn btn-primary btn-lg">
                <span>Continue to Payment</span>
                <ArrowRight />
              </button>
            </form>
          )}

          {/* STEP 2: PAYMENT */}
          {step === 2 && (
            <div className="space-y-10 animate-fadeIn">
              <div className="space-y-3">
                <span className="label text-ink-a45">Step 02 — Payment</span>
                <h3 className="font-display font-light text-[clamp(28px,4vw,44px)] leading-[1.05] tracking-tight">
                  Payment <em>method</em>
                </h3>
                <p className="body-copy text-ink-a45">
                  All transactions are encrypted with 256-bit TLS security.
                </p>
              </div>

              <div className="border border-ink-a18 divide-y divide-paper-a18">
                {/* 1. Credit & Debit Cards */}
                <label className={optionRowClass(paymentMethod === 'card')}>
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === 'card'}
                    onChange={() => setPaymentMethod('card')}
                    className="peer sr-only"
                  />
                  <span aria-hidden="true" className={markerClass(paymentMethod === 'card')} />
                  <span className="text-[13px] tracking-[0.04em]">
                    Credit or Debit Card (Visa, Mastercard, Amex)
                  </span>
                  <span className="label">Card</span>
                </label>

                {/* 2. Apple Pay */}
                <label className={optionRowClass(paymentMethod === 'applepay')}>
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === 'applepay'}
                    onChange={() => setPaymentMethod('applepay')}
                    className="peer sr-only"
                  />
                  <span aria-hidden="true" className={markerClass(paymentMethod === 'applepay')} />
                  <span className="text-[13px] tracking-[0.04em]">Apple Pay / Google Pay</span>
                  <span className="label">Wallet</span>
                </label>

                {/* 3. Klarna */}
                <label className={optionRowClass(paymentMethod === 'klarna')}>
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === 'klarna'}
                    onChange={() => setPaymentMethod('klarna')}
                    className="peer sr-only"
                  />
                  <span aria-hidden="true" className={markerClass(paymentMethod === 'klarna')} />
                  <span className="text-[13px] tracking-[0.04em]">
                    Klarna (Pay in 30 Days or 3 Instalments)
                  </span>
                  <span className="label">Credit</span>
                </label>

                {/* 4. Bank Transfer / SEPA */}
                <label className={optionRowClass(paymentMethod === 'bank')}>
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === 'bank'}
                    onChange={() => setPaymentMethod('bank')}
                    className="peer sr-only"
                  />
                  <span aria-hidden="true" className={markerClass(paymentMethod === 'bank')} />
                  <span className="text-[13px] tracking-[0.04em]">
                    European Online Banking (SEPA Transfer)
                  </span>
                  <span className="label">SEPA</span>
                </label>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn btn-secondary sm:w-auto"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleConfirmOrder}
                  disabled={isSubmittingOrder}
                  className="btn btn-primary btn-lg flex-1 justify-between"
                >
                  <span>{isSubmittingOrder ? 'Processing Acquisition...' : `Confirm & Place Order (${formatPrice(total)})`}</span>
                  <ArrowRight />
                </button>
              </div>

              {orderError && (
                <div role="alert" className="pt-4 border-t border-ink-a18">
                  <p className="label inline-block text-ink border-b border-dashed border-ink pb-1">
                    {orderError}
                  </p>
                </div>
              )}

              <div className="pt-4 border-t border-ink-a18 flex items-center justify-center gap-3 text-ink-a45 text-center">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span className="label text-ink-a45">
                  SSL Encrypted 256-Bit Channel · 14-Day Complimentary Returns
                </span>
              </div>
            </div>
          )}

          {/* STEP 3: CONFIRMATION RECEIPT */}
          {step === 3 && (
            <div className="space-y-8 animate-fadeIn py-2">
              <div className="w-12 h-12 border border-ink-a18 flex items-center justify-center">
                <Check className="w-5 h-5 stroke-[1.5]" />
              </div>

              <div className="space-y-3">
                <span className="label text-ink-a45">Step 03 — Confirmation</span>
                <h3 className="font-display font-light text-[clamp(34px,5vw,56px)] leading-[1.02] tracking-tight">
                  Order <em>confirmed</em>
                </h3>
              </div>

              <dl className="border-t border-ink-a18">
                <div className="flex items-baseline justify-between gap-6 py-3 border-b border-ink-a18">
                  <dt className="label text-ink-a45">Order Reference</dt>
                  <dd className="font-mono text-[13px] tracking-[0.14em] text-right">
                    {createdOrderNumber || 'Not available'}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-6 py-3 border-b border-ink-a18">
                  <dt className="label text-ink-a45">Recipient</dt>
                  <dd className="text-[13px] tracking-[0.04em] text-right">
                    {firstName} {lastName}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-6 py-3 border-b border-ink-a18">
                  <dt className="label text-ink-a45">Delivery Address</dt>
                  <dd className="text-[13px] tracking-[0.04em] text-right">
                    {street}, {postalCode} {city}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-6 py-3 border-b border-ink-a18">
                  <dt className="label text-ink-a45">Delivery Tier</dt>
                  <dd className="font-mono text-[13px] tracking-[0.14em] uppercase text-right">
                    {shippingMethod.toUpperCase()}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-6 py-3 border-b border-ink-a18">
                  <dt className="label text-ink-a45">Total Charged</dt>
                  <dd className="font-display font-light text-3xl text-right">
                    {formatPrice(total)}
                    <span className="label block mt-1 text-ink-a45">incl. 24% VAT</span>
                  </dd>
                </div>
              </dl>

              <p className="body-copy text-ink-a45 leading-relaxed">
                Thank you for your acquisition. A formal dossier and tracking code will be dispatched to {email}.
              </p>

              <div className="pt-2">
                <button type="button" onClick={onClose} className="w-full btn btn-primary btn-lg justify-between">
                  Return to Archive
                  <ArrowRight />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: ORDER SUMMARY — sticky on desktop */}
        <aside className="md:col-span-5 md:sticky md:top-6 h-fit space-y-6">
          <div className="flex items-baseline justify-between border-b border-ink-a18 pb-3">
            <h4 className="font-display font-light text-2xl">Order summary</h4>
            <span className="label text-ink-a45">{items.length} {items.length === 1 ? 'Piece' : 'Pieces'}</span>
          </div>

          <div className="space-y-3 max-h-60 sm:max-h-72 overflow-y-auto">
            {items.map((item) => (
              <div key={`${item.product.id}-${item.size}`} className="flex justify-between gap-4 pb-3 border-b border-ink-a06">
                <div>
                  <span className="block text-[13px] tracking-[0.04em]">
                    {item.product.name.en || item.product.name.fi}
                  </span>
                  <span className="mt-1 block label text-ink-a45">
                    Size {item.size} · Qty {item.quantity}
                  </span>
                </div>
                <span className="price shrink-0">{formatPrice(item.product.price * item.quantity)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between gap-4">
              <span className="label text-ink-a45">Subtotal</span>
              <span className="price">{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="label text-ink-a45">Shipping</span>
              <span className="price">{formatPrice(shippingCost)}</span>
            </div>
          </div>

          <div className="pt-4 border-t border-ink-a18">
            <div className="flex items-baseline justify-between gap-4">
              <span className="label">Total</span>
              <span className="font-display font-light text-[clamp(30px,4vw,42px)] leading-none">
                {formatPrice(total)}
              </span>
            </div>
            <p className="mt-2 label text-ink-a45 text-right">
              incl. 24% VAT ({formatPrice((total * 0.24) / 1.24)})
            </p>
          </div>

          <div className="pt-2 space-y-3">
            <span className="label text-ink-a45 block">Accepted payment methods</span>
            <PaymentIcons />
          </div>
        </aside>
      </div>
    </div>
  );
};
