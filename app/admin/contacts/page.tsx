'use client';

import { useCallback, useEffect, useState } from 'react';
import ContactsView, { type ContactDraft, type TripOption } from '@/components/admin/ContactsView';
import type { AdminContact } from '@/lib/admin-contacts';

export default function AdminContactsPage() {
  const [contacts, setContacts] = useState<AdminContact[]>([]);
  const [trips, setTrips] = useState<TripOption[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchContacts = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/contacts', { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to fetch contacts');
      const data = await response.json();
      setContacts(data.contacts || []);
      setTrips(data.trips || []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Favourites first, then A–Z (same order as the API)
  const sortContacts = (list: AdminContact[]) =>
    [...list].sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite) || a.name.localeCompare(b.name));

  /** Returns an error message, or null on success. */
  const saveContact = async (draft: ContactDraft, id?: string): Promise<string | null> => {
    const response = await fetch(id ? `/api/admin/contacts/${id}` : '/api/admin/contacts', {
      method: id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return data.error || 'Could not save the contact. Try again.';
    setContacts((prev) => sortContacts(id ? prev.map((c) => (c.id === id ? data.contact : c)) : [...prev, data.contact]));
    return null;
  };

  const deleteContact = async (id: string): Promise<string | null> => {
    const response = await fetch(`/api/admin/contacts/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return data.error || 'Could not delete the contact. Try again.';
    }
    setContacts((prev) => prev.filter((c) => c.id !== id));
    return null;
  };

  const toggleFavorite = async (contact: AdminContact) => {
    const is_favorite = !contact.is_favorite;
    setContacts((prev) => sortContacts(prev.map((c) => (c.id === contact.id ? { ...c, is_favorite } : c))));
    const response = await fetch(`/api/admin/contacts/${contact.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_favorite }),
    });
    if (!response.ok) fetchContacts();
  };

  return (
    <ContactsView
      contacts={contacts}
      trips={trips}
      loading={loading}
      onSave={saveContact}
      onDelete={deleteContact}
      onToggleFavorite={toggleFavorite}
    />
  );
}
