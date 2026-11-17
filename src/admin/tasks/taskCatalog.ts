import type { TaskDefinition, TaskField, TaskOption } from './types';

/* ==========================================================================
   Everyday tasks.
   These are the operations an operator actually performs, written in plain
   language. Each task maps to one server action, but the screen asks for
   familiar things — an order, a product, a note — not JSON or endpoint names.
   ========================================================================== */

const labelOf = (value: string) =>
  value
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (char) => char.toUpperCase());

const opts = (...values: string[]): TaskOption[] =>
  values.map((value) => ({ value, label: labelOf(value) }));

const text = (
  name: string,
  label: string,
  extra: Partial<TaskField> = {}
): TaskField => ({ name, label, type: 'text', ...extra });

const area = (
  name: string,
  label: string,
  extra: Partial<TaskField> = {}
): TaskField => ({ name, label, type: 'textarea', wide: true, ...extra });

const email = (
  name: string,
  label: string,
  extra: Partial<TaskField> = {}
): TaskField => ({ name, label, type: 'email', ...extra });

const num = (
  name: string,
  label: string,
  extra: Partial<TaskField> = {}
): TaskField => ({ name, label, type: 'number', ...extra });

const money = (
  name: string,
  label: string,
  extra: Partial<TaskField> = {}
): TaskField => ({ name, label, type: 'money', min: 0, step: 0.01, ...extra });

const date = (
  name: string,
  label: string,
  extra: Partial<TaskField> = {}
): TaskField => ({ name, label, type: 'date', ...extra });

const check = (
  name: string,
  label: string,
  extra: Partial<TaskField> = {}
): TaskField => ({ name, label, type: 'checkbox', ...extra });

const select = (
  name: string,
  label: string,
  options: TaskOption[],
  extra: Partial<TaskField> = {}
): TaskField => ({ name, label, type: 'select', options, required: true, ...extra });

const onOff = (name: string, label: string): TaskField =>
  select(name, label, [
    { value: 'true', label: 'On' },
    { value: 'false', label: 'Off' },
  ]);

const yesNo = (name: string, label: string): TaskField =>
  select(name, label, [
    { value: 'true', label: 'Yes' },
    { value: 'false', label: 'No' },
  ]);

const asBoolean = (value: unknown) => value === true || value === 'true';

const record = (
  name: string,
  label: string,
  source: string,
  extra: Partial<TaskField> = {}
): TaskField => ({ name, label, type: 'record', source, required: true, ...extra });

const multi = (
  name: string,
  label: string,
  source: string,
  extra: Partial<TaskField> = {}
): TaskField => ({ name, label, type: 'multirecord', source, ...extra });

const newKey = (prefix: string) =>
  `${prefix}-${Date.now()}-${globalThis.crypto?.randomUUID?.() || 'operator'}`;

const today = () => new Date().toISOString().slice(0, 10);

export const TASKS: TaskDefinition[] = [
  /* ---- Orders ---------------------------------------------------------- */
  {
    id: 'order-status',
    title: 'Update an order stage',
    description: 'Move an order to paid, packed, shipped, or delivered.',
    group: 'Orders',
    system: 'orders',
    action: 'transition',
    fields: [
      record('id', 'Which order?', 'orders'),
      select('status', 'New stage', opts('paid', 'packed', 'shipped', 'delivered')),
      text('tracking', 'Tracking number', {
        help: 'Required when the new stage is shipped.',
      }),
      area('note', 'Internal note', { help: 'Optional. Stored on the order timeline.' }),
    ],
    submitLabel: 'Update order',
    success: 'Order stage updated.',
  },
  {
    id: 'order-note',
    title: 'Add a note to an order',
    description: 'Leave a packing instruction, customer request, or handover note.',
    group: 'Orders',
    system: 'orders',
    action: 'note',
    fields: [
      record('id', 'Which order?', 'orders'),
      area('note', 'Note', { required: true }),
    ],
    submitLabel: 'Save note',
    success: 'Order note saved.',
  },
  {
    id: 'order-tracking',
    title: 'Add a tracking number',
    description: 'Give an order a carrier tracking reference.',
    group: 'Orders',
    system: 'orders',
    action: 'tracking',
    fields: [
      record('id', 'Which order?', 'orders'),
      text('tracking', 'Tracking number', { required: true }),
    ],
    submitLabel: 'Save tracking',
    success: 'Tracking number saved.',
  },
  {
    id: 'order-payment',
    title: 'Record a payment',
    description: 'Record a payment received outside the checkout.',
    group: 'Orders',
    system: 'orders',
    action: 'recordPayment',
    fields: [
      record('id', 'Which order?', 'orders'),
      money('amountMinor', 'Amount received', { required: true }),
      select('method', 'How was it paid?', [
        { value: 'bank_transfer', label: 'Bank transfer' },
        { value: 'card', label: 'Card' },
        { value: 'cash', label: 'Cash' },
        { value: 'invoice', label: 'Invoice' },
        { value: 'other', label: 'Other' },
      ]),
      text('reference', 'Payment reference', { required: true }),
      date('receivedAt', 'Date received', { required: true, defaultValue: today() }),
    ],
    submitLabel: 'Record payment',
    success: 'Payment recorded.',
  },
  {
    id: 'order-cancel',
    title: 'Cancel an order',
    description: 'Cancel an order and release its reserved stock.',
    group: 'Orders',
    system: 'orders',
    action: 'cancel',
    danger: true,
    fields: [
      record('id', 'Which order?', 'orders'),
      area('note', 'Reason for cancelling', { required: true }),
    ],
    submitLabel: 'Cancel order',
    success: 'Order cancelled.',
  },
  {
    id: 'shipment-create',
    title: 'Create a shipment',
    description: 'Prepare a shipment for a paid or packed order.',
    group: 'Orders',
    system: 'orders',
    action: 'shipmentCreate',
    fields: [
      record('orderId', 'Which order?', 'orders'),
      text('carrier', 'Carrier', { required: true, placeholder: 'Posti, DHL, UPS…' }),
      text('tracking', 'Tracking number', { required: true }),
      date('estimatedDelivery', 'Expected delivery'),
    ],
    submitLabel: 'Create shipment',
    success: 'Shipment created.',
  },
  {
    id: 'shipment-dispatch',
    title: 'Mark a shipment as shipped',
    description: 'Confirm that a shipment has left the studio.',
    group: 'Orders',
    system: 'orders',
    action: 'shipmentDispatch',
    fields: [record('id', 'Which shipment?', 'shipments')],
    submitLabel: 'Mark as shipped',
    success: 'Shipment marked as shipped.',
  },
  {
    id: 'shipment-deliver',
    title: 'Mark a shipment as delivered',
    description: 'Close a shipment once the customer has received it.',
    group: 'Orders',
    system: 'orders',
    action: 'shipmentDeliver',
    fields: [record('id', 'Which shipment?', 'shipments')],
    submitLabel: 'Mark delivered',
    success: 'Shipment marked as delivered.',
  },
  {
    id: 'return-approve',
    title: 'Approve or reject a return',
    description: 'Decide whether a customer return should go ahead.',
    group: 'Orders',
    system: 'orders',
    action: 'returnApprove',
    fields: [
      record('id', 'Which return?', 'returns'),
      select('decision', 'Decision', [
        { value: 'approve', label: 'Approve the return' },
        { value: 'reject', label: 'Reject the return' },
      ]),
      area('note', 'Note', { help: 'Optional. Shown on the return record.' }),
    ],
    submitLabel: 'Save decision',
    success: 'Return decision saved.',
  },
  {
    id: 'return-refund',
    title: 'Refund a return',
    description: 'Issue the refund and restock the returned items.',
    group: 'Orders',
    system: 'orders',
    action: 'returnRefund',
    danger: true,
    fields: [record('id', 'Which return?', 'returns')],
    submitLabel: 'Refund return',
    success: 'Refund issued.',
  },

  /* ---- Stock ----------------------------------------------------------- */
  {
    id: 'stock-adjust',
    title: 'Adjust stock',
    description: 'Add stock or remove damaged units from a location.',
    group: 'Stock',
    system: 'inventory',
    action: 'adjust',
    fields: [
      record('productId', 'Which product?', 'products'),
      num('delta', 'Stock change', {
        required: true,
        help: 'Use a positive number to add, a negative number to remove.',
      }),
      text('reason', 'Reason', { required: true, placeholder: 'Delivery, damage, stock count…' }),
      record('locationId', 'Stock location', 'locations', { required: false }),
    ],
    submitLabel: 'Adjust stock',
    success: 'Stock adjusted.',
  },
  {
    id: 'stock-location',
    title: 'Add or edit a stock location',
    description: 'Create a shelf, studio, or warehouse that holds stock.',
    group: 'Stock',
    system: 'inventory',
    action: 'locationSave',
    fields: [
      text('code', 'Short code', { required: true, placeholder: 'MAIN, STUDIO, HEL' }),
      text('name', 'Location name', { required: true }),
      text('country', 'Country code', { placeholder: 'FI' }),
      check('active', 'Use this location', { defaultValue: true }),
    ],
    submitLabel: 'Save location',
    success: 'Stock location saved.',
  },
  {
    id: 'supplier-add',
    title: 'Add a supplier',
    description: 'Keep contact details and lead times for a maker or supplier.',
    group: 'Stock',
    system: 'inventory',
    action: 'supplierSave',
    fields: [
      text('name', 'Supplier name', { required: true }),
      email('email', 'Email'),
      text('phone', 'Phone'),
      text('country', 'Country code', { placeholder: 'FI' }),
      num('leadTimeDays', 'Lead time in days', { min: 0, max: 365 }),
      select('status', 'Status', opts('active', 'paused', 'archived'), { required: false }),
    ],
    submitLabel: 'Save supplier',
    success: 'Supplier saved.',
  },
  {
    id: 'stock-sync',
    title: 'Rebuild a stock figure',
    description: 'Recalculate a product’s stock from the stock movement ledger.',
    group: 'Stock',
    system: 'inventory',
    action: 'syncProjection',
    fields: [record('productId', 'Which product?', 'products')],
    submitLabel: 'Rebuild stock',
    success: 'Stock figure rebuilt.',
  },
  {
    id: 'stock-expire',
    title: 'Release expired reservations',
    description: 'Free stock held by checkouts that were never completed.',
    group: 'Stock',
    system: 'inventory',
    action: 'expireReservations',
    fields: [],
    submitLabel: 'Release stock',
    success: 'Expired reservations released.',
  },

  /* ---- Customers ------------------------------------------------------- */
  {
    id: 'customer-note',
    title: 'Add a customer note',
    description: 'Record a preference, request, or conversation in the client record.',
    group: 'Customers',
    system: 'customers',
    action: 'noteCreate',
    fields: [
      record('email', 'Which customer?', 'customers'),
      area('body', 'Note', { required: true }),
      check('pinned', 'Pin this note'),
    ],
    submitLabel: 'Save note',
    success: 'Customer note saved.',
  },
  {
    id: 'customer-tag-add',
    title: 'Tag a customer',
    description: 'Add a simple label such as VIP, wholesale, or press.',
    group: 'Customers',
    system: 'customers',
    action: 'tagAdd',
    fields: [
      record('email', 'Which customer?', 'customers'),
      text('tag', 'Tag', { required: true, placeholder: 'VIP' }),
    ],
    submitLabel: 'Add tag',
    success: 'Customer tagged.',
  },
  {
    id: 'customer-tag-remove',
    title: 'Remove a customer tag',
    description: 'Remove a label from a customer record.',
    group: 'Customers',
    system: 'customers',
    action: 'tagRemove',
    fields: [
      record('email', 'Which customer?', 'customers'),
      text('tag', 'Tag to remove', { required: true }),
    ],
    submitLabel: 'Remove tag',
    success: 'Customer tag removed.',
  },
  {
    id: 'customer-consent',
    title: 'Update marketing consent',
    description: 'Record whether a customer has agreed to marketing messages.',
    group: 'Customers',
    system: 'customers',
    action: 'consentUpdate',
    fields: [
      record('email', 'Which customer?', 'customers'),
      yesNo('marketingConsent', 'Has the customer agreed to marketing?'),
    ],
    buildInput: (input) => ({ ...input, marketingConsent: asBoolean(input.marketingConsent) }),
    submitLabel: 'Save consent',
    success: 'Marketing consent updated.',
  },
  {
    id: 'loyalty-points',
    title: 'Add or remove loyalty points',
    description: 'Adjust a customer’s points with a reason.',
    group: 'Customers',
    system: 'customers',
    action: 'loyaltyAdjust',
    fields: [
      record('email', 'Which customer?', 'customers'),
      num('points', 'Points change', {
        required: true,
        help: 'Use a positive number to add, a negative number to remove.',
      }),
      text('reason', 'Reason', { required: true }),
    ],
    buildInput: (input) => ({ ...input, idempotencyKey: newKey('loyalty') }),
    submitLabel: 'Save points',
    success: 'Loyalty points updated.',
  },
  {
    id: 'loyalty-redeem',
    title: 'Redeem loyalty points',
    description: 'Use a customer’s points against an order.',
    group: 'Customers',
    system: 'customers',
    action: 'loyaltyRedeem',
    fields: [
      record('email', 'Which customer?', 'customers'),
      record('orderId', 'Which order?', 'orders'),
      num('points', 'Points to redeem', { required: true, min: 1 }),
    ],
    submitLabel: 'Redeem points',
    success: 'Points redeemed.',
  },
  {
    id: 'ticket-create',
    title: 'Open a support ticket',
    description: 'Start a record of a customer question or problem.',
    group: 'Customers',
    system: 'customers',
    action: 'ticketCreate',
    fields: [
      record('email', 'Which customer?', 'customers'),
      text('subject', 'Subject', { required: true }),
      area('body', 'What is the problem?', { required: true }),
      select('priority', 'Priority', opts('low', 'normal', 'high', 'urgent'), {
        defaultValue: 'normal',
        required: false,
      }),
      record('orderId', 'Linked order', 'orders', { required: false }),
    ],
    submitLabel: 'Open ticket',
    success: 'Support ticket opened.',
  },
  {
    id: 'ticket-reply',
    title: 'Reply to a support ticket',
    description: 'Send a written reply and keep it on the ticket history.',
    group: 'Customers',
    system: 'customers',
    action: 'ticketReply',
    fields: [
      record('id', 'Which ticket?', 'tickets'),
      area('body', 'Reply', { required: true }),
    ],
    submitLabel: 'Send reply',
    success: 'Reply saved.',
  },
  {
    id: 'ticket-status',
    title: 'Change a ticket status',
    description: 'Move a ticket to open, pending, resolved, or closed.',
    group: 'Customers',
    system: 'customers',
    action: 'ticketStatus',
    fields: [
      record('id', 'Which ticket?', 'tickets'),
      select('status', 'New status', opts('open', 'pending', 'resolved', 'closed')),
    ],
    submitLabel: 'Update ticket',
    success: 'Ticket status updated.',
  },

  /* ---- Catalogue ------------------------------------------------------- */
  {
    id: 'product-publish',
    title: 'Publish a product',
    description: 'Make a finished product visible on the storefront.',
    group: 'Catalogue',
    system: 'catalog',
    action: 'publish',
    fields: [record('id', 'Which product?', 'products')],
    submitLabel: 'Publish product',
    success: 'Product published.',
  },
  {
    id: 'product-archive',
    title: 'Archive a product',
    description: 'Hide a product without deleting its history.',
    group: 'Catalogue',
    system: 'catalog',
    action: 'archive',
    fields: [record('id', 'Which product?', 'products')],
    submitLabel: 'Archive product',
    success: 'Product archived.',
  },
  {
    id: 'product-bulk-status',
    title: 'Change status for several products',
    description: 'Move a group of products to draft, published, or archived.',
    group: 'Catalogue',
    system: 'catalog',
    action: 'bulkStatus',
    fields: [
      multi('ids', 'Which products?', 'products', { required: true }),
      select('status', 'New status', opts('draft', 'published', 'scheduled', 'archived', 'coming_soon')),
    ],
    submitLabel: 'Update products',
    success: 'Products updated.',
  },
  {
    id: 'product-categories',
    title: 'Set a product’s categories',
    description: 'Choose every category this product belongs to.',
    group: 'Catalogue',
    system: 'catalog',
    action: 'categories',
    fields: [
      record('id', 'Which product?', 'products'),
      multi('categoryIds', 'Categories', 'categories', { required: true }),
    ],
    submitLabel: 'Save categories',
    success: 'Product categories saved.',
  },
  {
    id: 'product-collections',
    title: 'Set a product’s collections',
    description: 'Place a product in the edits or drops it belongs to.',
    group: 'Catalogue',
    system: 'catalog',
    action: 'collections',
    fields: [
      record('id', 'Which product?', 'products'),
      multi('collectionIds', 'Collections', 'collections', { required: true }),
    ],
    submitLabel: 'Save collections',
    success: 'Product collections saved.',
  },
  {
    id: 'collection-publish',
    title: 'Publish a collection',
    description: 'Make a collection visible on the storefront.',
    group: 'Catalogue',
    system: 'collections',
    action: 'publish',
    fields: [record('id', 'Which collection?', 'collections')],
    submitLabel: 'Publish collection',
    success: 'Collection published.',
  },
  {
    id: 'collection-archive',
    title: 'Archive a collection',
    description: 'Hide a collection without deleting it.',
    group: 'Catalogue',
    system: 'collections',
    action: 'archive',
    fields: [record('id', 'Which collection?', 'collections')],
    submitLabel: 'Archive collection',
    success: 'Collection archived.',
  },
  {
    id: 'collection-products',
    title: 'Choose a collection’s products',
    description: 'Set which products appear in a collection.',
    group: 'Catalogue',
    system: 'collections',
    action: 'assignProducts',
    fields: [
      record('id', 'Which collection?', 'collections'),
      multi('productIds', 'Products', 'products', { required: true }),
    ],
    submitLabel: 'Save products',
    success: 'Collection products saved.',
  },
  {
    id: 'category-visibility',
    title: 'Show or hide a category',
    description: 'Control whether a category appears in the storefront navigation.',
    group: 'Catalogue',
    system: 'categories',
    action: 'visibility',
    fields: [
      record('id', 'Which category?', 'categories'),
      onOff('visible', 'Storefront visibility'),
    ],
    buildInput: (input) => ({ ...input, visible: asBoolean(input.visible) }),
    submitLabel: 'Save visibility',
    success: 'Category visibility saved.',
  },

  /* ---- Marketing ------------------------------------------------------- */
  {
    id: 'discount-toggle',
    title: 'Turn a discount on or off',
    description: 'Activate or pause a discount code.',
    group: 'Marketing',
    system: 'pricing',
    action: 'toggle',
    fields: [record('id', 'Which discount?', 'discounts'), onOff('active', 'Discount status')],
    buildInput: (input) => ({ ...input, active: asBoolean(input.active) }),
    submitLabel: 'Save discount',
    success: 'Discount updated.',
  },
  {
    id: 'discount-remove',
    title: 'Delete a discount',
    description: 'Remove a discount code that is no longer used.',
    group: 'Marketing',
    system: 'pricing',
    action: 'remove',
    danger: true,
    fields: [record('id', 'Which discount?', 'discounts')],
    submitLabel: 'Delete discount',
    success: 'Discount deleted.',
  },
  {
    id: 'campaign-save',
    title: 'Create or update a campaign',
    description: 'Keep a marketing campaign, its budget, and its dates.',
    group: 'Marketing',
    system: 'channels',
    action: 'campaignSave',
    fields: [
      text('name', 'Campaign name', { required: true }),
      text('channel', 'Channel', { required: true, placeholder: 'Instagram, newsletter, print…' }),
      select('status', 'Status', opts('draft', 'scheduled', 'active', 'paused', 'completed', 'archived'), {
        required: false,
      }),
      money('budgetMinor', 'Budget'),
      money('spendMinor', 'Spent so far'),
      date('startsAt', 'Starts'),
      date('endsAt', 'Ends'),
      area('notes', 'Notes'),
    ],
    submitLabel: 'Save campaign',
    success: 'Campaign saved.',
  },
  {
    id: 'channel-spend',
    title: 'Record marketing spend',
    description: 'Enter what was actually spent on a channel in a month.',
    group: 'Marketing',
    system: 'channels',
    action: 'costUpsert',
    fields: [
      text('channel', 'Channel', { required: true, placeholder: 'Instagram' }),
      text('month', 'Month', { required: true, placeholder: '2026-11' }),
      money('spendMinor', 'Amount spent', { required: true }),
      text('note', 'Note'),
      num('impressions', 'Impressions'),
      num('clicks', 'Clicks'),
    ],
    submitLabel: 'Save spend',
    success: 'Marketing spend saved.',
  },
  {
    id: 'marketing-touch',
    title: 'Record a marketing touch',
    description: 'Attribute a visit, click, or purchase to a campaign.',
    group: 'Marketing',
    system: 'channels',
    action: 'recordTouch',
    fields: [
      record('campaignId', 'Which campaign?', 'campaigns'),
      text('visitorId', 'Visitor id', { required: true }),
      email('customerEmail', 'Customer email'),
      select('eventType', 'What happened?', opts('impression', 'click', 'visit', 'add_to_cart', 'purchase')),
      money('revenueMinor', 'Revenue'),
    ],
    submitLabel: 'Save touch',
    success: 'Marketing touch recorded.',
  },

  /* ---- Content --------------------------------------------------------- */
  {
    id: 'announcement',
    title: 'Update the announcement bar',
    description: 'Change the short message shown above the storefront.',
    group: 'Content',
    system: 'content',
    action: 'announcement',
    fields: [
      text('fi', 'Finnish message', { required: true }),
      text('en', 'English message', { required: true }),
      text('sv', 'Swedish message'),
    ],
    submitLabel: 'Save announcement',
    success: 'Announcement updated.',
  },
  {
    id: 'review-moderate',
    title: 'Publish or reject a review',
    description: 'Decide whether a customer review appears on the site.',
    group: 'Content',
    system: 'content',
    action: 'reviewModerate',
    fields: [
      record('id', 'Which review?', 'reviews'),
      select('decision', 'Decision', [
        { value: 'publish', label: 'Publish the review' },
        { value: 'reject', label: 'Reject the review' },
      ]),
    ],
    submitLabel: 'Save decision',
    success: 'Review decision saved.',
  },
  {
    id: 'review-respond',
    title: 'Reply to a review',
    description: 'Publish an official response to a customer review.',
    group: 'Content',
    system: 'content',
    action: 'reviewRespond',
    fields: [
      record('id', 'Which review?', 'reviews'),
      area('response', 'Response', { required: true }),
    ],
    submitLabel: 'Publish reply',
    success: 'Review reply published.',
  },

  /* ---- Team & access --------------------------------------------------- */
  {
    id: 'team-save',
    title: 'Invite or update a team member',
    description: 'Add someone to the team and choose what they can do.',
    group: 'Team & access',
    system: 'settings',
    action: 'teamSave',
    fields: [
      email('email', 'Email address', { required: true }),
      text('name', 'Full name', { required: true }),
      select('role', 'Role', opts('owner', 'admin', 'manager', 'editor', 'analyst', 'support', 'viewer')),
      text('department', 'Department'),
      money('approvalLimitMinor', 'Approval limit'),
      select('status', 'Status', opts('active', 'suspended', 'disabled'), { required: false }),
    ],
    submitLabel: 'Save team member',
    success: 'Team member saved.',
  },
  {
    id: 'team-disable',
    title: 'Disable a team member',
    description: 'Remove someone’s access without deleting their history.',
    group: 'Team & access',
    system: 'settings',
    action: 'teamDisable',
    danger: true,
    fields: [record('id', 'Which team member?', 'team')],
    submitLabel: 'Disable access',
    success: 'Team member disabled.',
  },
  {
    id: 'flag-toggle',
    title: 'Turn a feature on or off',
    description: 'Enable or disable a feature flag for the storefront or admin.',
    group: 'Team & access',
    system: 'settings',
    action: 'flagToggle',
    fields: [
      record('key', 'Which feature?', 'flags'),
      onOff('enabled', 'Feature status'),
      num('rolloutPercent', 'Rollout percentage', {
        min: 0,
        max: 100,
        help: 'Optional. 100 means everyone.',
      }),
    ],
    buildInput: (input) => ({ ...input, enabled: asBoolean(input.enabled) }),
    submitLabel: 'Save feature',
    success: 'Feature setting saved.',
  },

  /* ---- System ---------------------------------------------------------- */
  {
    id: 'alert-ack',
    title: 'Acknowledge an alert',
    description: 'Take ownership of an alert so the team knows it is being handled.',
    group: 'System',
    system: 'control',
    action: 'acknowledgeAlert',
    fields: [record('id', 'Which alert?', 'alerts')],
    submitLabel: 'Acknowledge',
    success: 'Alert acknowledged.',
  },
  {
    id: 'incident-declare',
    title: 'Declare an incident',
    description: 'Open an incident when something is affecting the store.',
    group: 'System',
    system: 'control',
    action: 'declareIncident',
    fields: [
      text('title', 'What is happening?', { required: true }),
      area('summary', 'Summary'),
      area('impact', 'Who or what is affected?'),
      select('severity', 'Severity', opts('SEV1', 'SEV2', 'SEV3', 'SEV4')),
    ],
    submitLabel: 'Declare incident',
    success: 'Incident declared.',
  },
  {
    id: 'incident-note',
    title: 'Add an incident update',
    description: 'Append an update to the incident timeline.',
    group: 'System',
    system: 'control',
    action: 'incidentNote',
    fields: [
      record('id', 'Which incident?', 'incidents'),
      area('message', 'Update', { required: true }),
    ],
    submitLabel: 'Add update',
    success: 'Incident update added.',
  },
  {
    id: 'deployment-record',
    title: 'Record a deployment',
    description: 'Log a release so later incidents can be matched to changes.',
    group: 'System',
    system: 'control',
    action: 'recordDeployment',
    fields: [
      text('version', 'Version', { required: true }),
      text('commitSha', 'Commit reference'),
      select('environment', 'Environment', opts('production', 'preview', 'development'), {
        required: false,
      }),
      select('status', 'Status', opts('started', 'succeeded', 'failed'), { required: false }),
    ],
    submitLabel: 'Record deployment',
    success: 'Deployment recorded.',
  },
  {
    id: 'automation-toggle',
    title: 'Turn an automation on or off',
    description: 'Enable or pause an automation rule.',
    group: 'System',
    system: 'governance',
    action: 'ruleToggle',
    fields: [record('id', 'Which automation?', 'rules'), onOff('active', 'Automation status')],
    buildInput: (input) => ({ ...input, active: asBoolean(input.active) }),
    submitLabel: 'Save automation',
    success: 'Automation updated.',
  },
  {
    id: 'data-quality',
    title: 'Run data quality checks',
    description: 'Check orders, stock, and records for missing or inconsistent data.',
    group: 'System',
    system: 'governance',
    action: 'dataQualityRun',
    fields: [],
    submitLabel: 'Run checks',
    success: 'Data quality checks completed.',
  },

  /* ---- Waitlist & community ------------------------------------------- */
  {
    id: 'waitlist-add',
    title: 'Add someone to the waitlist',
    description: 'Record a customer who wants access to an upcoming drop.',
    group: 'Customers',
    system: 'waitlist',
    action: 'add',
    fields: [
      email('email', 'Customer email', { required: true }),
      text('source', 'Where did they come from?', { placeholder: 'Storefront, event, email…' }),
    ],
    submitLabel: 'Add to waitlist',
    success: 'Added to the waitlist.',
  },
  {
    id: 'waitlist-invite',
    title: 'Invite people from the waitlist',
    description: 'Mark one or more waitlist entries as invited.',
    group: 'Customers',
    system: 'waitlist',
    action: 'invite',
    fields: [multi('ids', 'Who should be invited?', 'waitlist', { required: true })],
    submitLabel: 'Send invitations',
    success: 'Waitlist invitations recorded.',
  },
  {
    id: 'waitlist-remove',
    title: 'Remove a waitlist entry',
    description: 'Remove someone who no longer wants to be on the list.',
    group: 'Customers',
    system: 'waitlist',
    action: 'remove',
    danger: true,
    fields: [record('id', 'Which entry?', 'waitlist')],
    submitLabel: 'Remove entry',
    success: 'Waitlist entry removed.',
  },
  {
    id: 'suggestion-status',
    title: 'Update a community suggestion',
    description: 'Move a customer proposal through the curation process.',
    group: 'Customers',
    system: 'suggestions',
    action: 'updateStatus',
    fields: [
      record('id', 'Which suggestion?', 'suggestions'),
      select('status', 'New status', opts('under_review', 'in_sampling', 'commissioned', 'declined')),
    ],
    submitLabel: 'Update suggestion',
    success: 'Suggestion updated.',
  },

  /* ---- Money ----------------------------------------------------------- */
  {
    id: 'expense-add',
    title: 'Record an expense',
    description: 'Add a cost such as fabric, photography, or shipping supplies.',
    group: 'Money',
    system: 'analytics',
    action: 'expenseCreate',
    fields: [
      text('category', 'Category', { required: true, placeholder: 'Fabric, studio, shipping…' }),
      text('vendor', 'Paid to', { required: true }),
      text('reference', 'Receipt or invoice reference', { required: true }),
      money('amountMinor', 'Amount', { required: true }),
      date('incurredOn', 'Date', { required: true, defaultValue: today() }),
      area('note', 'Note'),
    ],
    submitLabel: 'Record expense',
    success: 'Expense recorded.',
  },
  {
    id: 'product-cost',
    title: 'Set a product cost',
    description: 'Record what a product costs you so margin can be calculated.',
    group: 'Money',
    system: 'analytics',
    action: 'productCostSet',
    fields: [
      record('productId', 'Which product?', 'products'),
      money('unitCostMinor', 'Unit cost', { required: true }),
      date('effectiveFrom', 'Effective from', { required: true, defaultValue: today() }),
    ],
    submitLabel: 'Save cost',
    success: 'Product cost saved.',
  },
  {
    id: 'insight-add',
    title: 'Record a business insight',
    description: 'Save an observation with evidence and a recommendation.',
    group: 'Money',
    system: 'advisor',
    action: 'create',
    fields: [
      text('title', 'Insight', { required: true }),
      text('category', 'Area', { required: true, placeholder: 'Sales, stock, customers…' }),
      area('evidence', 'What did you observe?', { required: true }),
      area('recommendation', 'What should we do?', { required: true }),
      text('expectedImpact', 'Expected impact'),
      text('metric', 'How will we measure it?', {
        required: true,
        placeholder: 'Repeat purchase rate, stock turn, revenue…',
      }),
      num('baseline', 'Current figure'),
      num('target', 'Target figure'),
      select('effort', 'Effort', opts('low', 'medium', 'high'), { required: false }),
      select('priority', 'Priority', opts('critical', 'high', 'medium', 'low'), { required: false }),
    ],
    buildInput: (input) => {
      const { metric, baseline, target, ...rest } = input;
      const metricImpact: Record<string, unknown> = { metric };
      if (baseline !== undefined && baseline !== '') metricImpact.baseline = baseline;
      if (target !== undefined && target !== '') metricImpact.target = target;
      return { ...rest, metricImpact };
    },
    submitLabel: 'Save insight',
    success: 'Insight saved.',
  },
];

export const TASK_GROUPS = ['Orders', 'Stock', 'Customers', 'Catalogue', 'Marketing', 'Content', 'Team & access', 'Money', 'System'];

export const TASK_COUNT = TASKS.length;
