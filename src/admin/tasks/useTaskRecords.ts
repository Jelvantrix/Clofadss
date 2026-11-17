import { useEffect, useMemo, useState } from 'react';
import { bosFetch } from '../../bos/client';
import type { RecordOptions, TaskData, TaskOption } from './types';

interface RemoteSource {
  system: string;
  action: string;
  listKey: string;
  value: (row: Record<string, unknown>) => string;
  label: (row: Record<string, unknown>) => string;
}

const str = (value: unknown, fallback = '') =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;

const nestedName = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return str(record.en || record.fi || record.sv || record.name);
  }
  return '';
};

const customerName = (row: Record<string, unknown>) => {
  const customer = (row.customer || {}) as Record<string, unknown>;
  return str(customer.name || customer.email);
};

const REMOTE_SOURCES: Record<string, RemoteSource> = {
  shipments: {
    system: 'orders',
    action: 'shipments',
    listKey: 'shipments',
    value: (row) => str(row.id),
    label: (row) =>
      [str(row.carrier, 'Shipment'), str(row.tracking), str(row.status)].filter(Boolean).join(' · ') ||
      str(row.id),
  },
  returns: {
    system: 'orders',
    action: 'returns',
    listKey: 'returns',
    value: (row) => str(row.id),
    label: (row) => `Return ${str(row.id)} · ${str(row.status, 'requested')}`,
  },
  tickets: {
    system: 'customers',
    action: 'tickets',
    listKey: 'tickets',
    value: (row) => str(row.id),
    label: (row) =>
      [str(row.subject, 'Ticket'), str(row.customer_email), str(row.status)].filter(Boolean).join(' · '),
  },
  alerts: {
    system: 'control',
    action: 'alerts',
    listKey: 'alerts',
    value: (row) => str(row.id),
    label: (row) =>
      [str(row.title || row.name || row.id, 'Alert'), str(row.status)].filter(Boolean).join(' · '),
  },
  incidents: {
    system: 'control',
    action: 'incidents',
    listKey: 'incidents',
    value: (row) => str(row.id),
    label: (row) =>
      [str(row.title, 'Incident'), str(row.severity), str(row.status)].filter(Boolean).join(' · '),
  },
  locations: {
    system: 'inventory',
    action: 'locations',
    listKey: 'locations',
    value: (row) => str(row.id),
    label: (row) => `${str(row.name || row.code || row.id)}${row.code ? ` (${str(row.code)})` : ''}`,
  },
  suppliers: {
    system: 'inventory',
    action: 'suppliers',
    listKey: 'suppliers',
    value: (row) => str(row.id),
    label: (row) => str(row.name || row.email || row.id),
  },
  purchaseOrders: {
    system: 'inventory',
    action: 'purchaseOrders',
    listKey: 'purchaseOrders',
    value: (row) => str(row.id),
    label: (row) => [str(row.number, 'Purchase order'), str(row.status)].filter(Boolean).join(' · '),
  },
  reviews: {
    system: 'content',
    action: 'reviews',
    listKey: 'reviews',
    value: (row) => str(row.id),
    label: (row) =>
      [
        str(row.title || row.body || row.id, 'Review'),
        row.rating ? `${str(row.rating)}★` : '',
        str(row.status),
      ]
        .filter(Boolean)
        .join(' · '),
  },
  campaigns: {
    system: 'channels',
    action: 'campaigns',
    listKey: 'campaigns',
    value: (row) => str(row.id),
    label: (row) => [str(row.name, 'Campaign'), str(row.channel)].filter(Boolean).join(' · '),
  },
  rules: {
    system: 'governance',
    action: 'rules',
    listKey: 'rules',
    value: (row) => str(row.id),
    label: (row) =>
      [str(row.name, 'Automation'), str(row.trigger_event || row.triggerEvent)].filter(Boolean).join(' · '),
  },
  flags: {
    system: 'settings',
    action: 'flags',
    listKey: 'flags',
    value: (row) => str(row.flag_key || row.key),
    label: (row) =>
      `${str(row.flag_key || row.key, 'Feature')}${row.enabled ? ' · on' : ' · off'}`,
  },
  team: {
    system: 'settings',
    action: 'team',
    listKey: 'team',
    value: (row) => str(row.id),
    label: (row) =>
      [str(row.name || row.email, 'Team member'), str(row.role)].filter(Boolean).join(' · '),
  },
  suggestions: {
    system: 'suggestions',
    action: 'list',
    listKey: 'suggestions',
    value: (row) => str(row.id),
    label: (row) => [str(row.title, 'Suggestion'), str(row.status)].filter(Boolean).join(' · '),
  },
  media: {
    system: 'media',
    action: 'list',
    listKey: 'media',
    value: (row) => str(row.id),
    label: (row) => str(row.path || row.url || row.id),
  },
  journal: {
    system: 'content',
    action: 'journal',
    listKey: 'posts',
    value: (row) => str(row.id),
    label: (row) => nestedName(row.title) || str(row.slug || row.id),
  },
};

const CACHE = new Map<string, TaskOption[]>();

function localOptions(data: TaskData): Record<string, TaskOption[]> {
  return {
    orders: data.orders.map((order) => ({
      value: order.id,
      label: `#${order.number || order.id} · ${customerName(order as unknown as Record<string, unknown>)} · ${order.status}`,
    })),
    products: data.products.map((product) => ({
      value: product.id,
      label: `${product.name?.en || product.name?.fi || product.nr || product.id}`,
    })),
    customers: data.customers
      .filter((customer) => customer.email)
      .map((customer) => ({
        value: customer.email,
        label: `${customer.name || 'Customer'} · ${customer.email}`,
      })),
    collections: data.collections.map((collection) => ({
      value: collection.id,
      label: nestedName(collection.name) || collection.slug || collection.id,
    })),
    categories: data.categories.map((category) => ({
      value: category.id,
      label: nestedName(category.name) || category.slug || category.id,
    })),
    discounts: data.discounts.map((discount) => ({
      value: discount.id,
      label: `${discount.code}${discount.value ? ` · ${discount.value}` : ''}`,
    })),
    waitlist: data.waitlist.map((entry) => ({
      value: entry.id,
      label: entry.email || entry.id,
    })),
  };
}

export function useTaskRecords(sources: string[], data: TaskData): RecordOptions {
  const local = useMemo(() => localOptions(data), [data]);
  const [remote, setRemote] = useState<Record<string, TaskOption[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const key = useMemo(() => [...new Set(sources)].sort().join('|'), [sources]);

  useEffect(() => {
    let cancelled = false;
    const needed = key ? key.split('|') : [];
    for (const source of needed) {
      if (local[source] || !REMOTE_SOURCES[source] || CACHE.has(source)) continue;
      const config = REMOTE_SOURCES[source];
      setLoading((prev) => ({ ...prev, [source]: true }));
      setErrors((prev) => {
        if (!prev[source]) return prev;
        const next = { ...prev };
        delete next[source];
        return next;
      });
      bosFetch<Record<string, unknown>>(config.system, config.action, { limit: 100 })
        .then((response) => {
          if (cancelled) return;
          const list = response?.[config.listKey];
          const rows = Array.isArray(list) ? (list as Record<string, unknown>[]) : [];
          const options = rows
            .map((row) => ({ value: config.value(row), label: config.label(row) }))
            .filter((option) => option.value);
          CACHE.set(source, options);
          setRemote((prev) => ({ ...prev, [source]: options }));
        })
        .catch(() => {
          if (cancelled) return;
          setErrors((prev) => ({
            ...prev,
            [source]: 'We could not load this list. Type the reference instead.',
          }));
        })
        .finally(() => {
          if (cancelled) return;
          setLoading((prev) => ({ ...prev, [source]: false }));
        });
    }
    return () => {
      cancelled = true;
    };
  }, [key, local]);

  const bySource = useMemo<Record<string, TaskOption[]>>(() => {
    const merged: Record<string, TaskOption[]> = { ...local, ...remote };
    for (const [source, options] of CACHE.entries()) {
      if (!merged[source]) merged[source] = options;
    }
    return merged;
  }, [local, remote]);

  return { bySource, loading, errors };
}
