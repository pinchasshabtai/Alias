'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Category } from '@/lib/types';

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    createClient()
      .from('categories')
      .select('*')
      .order('id')
      .then(({ data }) => {
        if (!cancelled) {
          setCategories((data ?? []) as Category[]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { categories, loading };
}
