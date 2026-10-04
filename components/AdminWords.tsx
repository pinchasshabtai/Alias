'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { LoadingState } from '@/components/LoadingState';
import { useToast } from '@/components/Toast';
import { createClient } from '@/lib/supabase/client';
import { toHebrewError } from '@/lib/errors';
import { wordSchema } from '@/lib/schemas';
import { DIFFICULTY_LABELS, type Category, type Word } from '@/lib/types';

export function AdminWords() {
  const supabase = createClient();
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [words, setWords] = useState<Word[] | null>(null);
  const [filterCat, setFilterCat] = useState(0);
  const [search, setSearch] = useState('');
  const [newWord, setNewWord] = useState('');
  const [newCat, setNewCat] = useState(0);
  const [newDiff, setNewDiff] = useState(1);
  const [catName, setCatName] = useState('');
  const [catEmoji, setCatEmoji] = useState('🎯');
  const [editing, setEditing] = useState<Word | null>(null);

  const loadCategories = useCallback(async () => {
    const { data } = await supabase.from('categories').select('*').order('id');
    const list = (data ?? []) as Category[];
    setCategories(list);
    setNewCat((c) => c || list[0]?.id || 0);
  }, [supabase]);

  const loadWords = useCallback(async () => {
    let q = supabase.from('words').select('*').order('id', { ascending: false }).limit(200);
    if (filterCat) q = q.eq('category_id', filterCat);
    const s = search.trim().replace(/[%_,]/g, '');
    if (s) q = q.ilike('word', `%${s}%`);
    const { data, error } = await q;
    if (error) toast(toHebrewError(error), 'error');
    setWords((data ?? []) as Word[]);
  }, [supabase, filterCat, search, toast]);

  useEffect(() => { void loadCategories(); }, [loadCategories]);
  useEffect(() => { const t = setTimeout(() => void loadWords(), 250); return () => clearTimeout(t); }, [loadWords]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = wordSchema.safeParse({ word: newWord, categoryId: newCat, difficulty: newDiff });
    if (!parsed.success) return toast(parsed.error.issues[0].message, 'error');
    const { error } = await supabase.from('words').insert({ word: parsed.data.word, category_id: parsed.data.categoryId, difficulty: parsed.data.difficulty });
    if (error) return toast(toHebrewError(error), 'error');
    setNewWord('');
    toast('המילה נוספה', 'success');
    void loadWords();
  };

  const saveEdit = async () => {
    if (!editing) return;
    const parsed = wordSchema.safeParse({ word: editing.word, categoryId: editing.category_id, difficulty: editing.difficulty });
    if (!parsed.success) return toast(parsed.error.issues[0].message, 'error');
    const { error } = await supabase.from('words').update({ word: parsed.data.word, category_id: parsed.data.categoryId, difficulty: parsed.data.difficulty }).eq('id', editing.id);
    if (error) return toast(toHebrewError(error), 'error');
    setEditing(null);
    void loadWords();
  };

  const del = async (w: Word) => {
    if (!window.confirm(`למחוק את "${w.word}"?`)) return;
    const { error } = await supabase.from('words').delete().eq('id', w.id);
    if (error) return toast(toHebrewError(error), 'error');
    void loadWords();
  };

  const addCategory = async (e: FormEvent) => {
    e.preventDefault();
    const name = catName.trim();
    if (!name) return toast('נא להזין שם קטגוריה', 'error');
    const slug = `c-${Date.now().toString(36)}`;
    const { error } = await supabase.from('categories').insert({ slug, name, emoji: catEmoji || '🎯' });
    if (error) return toast(toHebrewError(error), 'error');
    setCatName('');
    toast('הקטגוריה נוצרה', 'success');
    void loadCategories();
  };

  const catName_ = (id: number) => categories.find((c) => c.id === id);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">ניהול מילים</h1>

      <form onSubmit={add} className="card grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
        <input className="input" placeholder="מילה חדשה" value={newWord} onChange={(e) => setNewWord(e.target.value)} aria-label="מילה חדשה" />
        <select className="input" value={newCat} onChange={(e) => setNewCat(Number(e.target.value))} aria-label="קטגוריה">
          {categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
        </select>
        <select className="input" value={newDiff} onChange={(e) => setNewDiff(Number(e.target.value))} aria-label="קושי">
          {[1, 2, 3].map((d) => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
        </select>
        <button type="submit" className="btn-mint">הוספה</button>
      </form>

      <form onSubmit={addCategory} className="card flex flex-wrap gap-3">
        <input className="input !w-20 text-center" value={catEmoji} maxLength={4} onChange={(e) => setCatEmoji(e.target.value)} aria-label="אימוג'י" />
        <input className="input flex-1" placeholder="שם קטגוריה חדשה" value={catName} onChange={(e) => setCatName(e.target.value)} aria-label="שם קטגוריה" />
        <button type="submit" className="btn-sky">יצירת קטגוריה</button>
      </form>

      <div className="flex flex-wrap gap-3">
        <input className="input flex-1" placeholder="חיפוש מילה" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="חיפוש" />
        <select className="input !w-auto" value={filterCat} onChange={(e) => setFilterCat(Number(e.target.value))} aria-label="סינון לפי קטגוריה">
          <option value={0}>כל הקטגוריות</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
        </select>
      </div>

      {!words ? <LoadingState /> : (
        <ul className="card divide-y divide-ink/5 !p-0">
          {words.length === 0 && <li className="p-4 text-center text-ink/60">לא נמצאו מילים.</li>}
          {words.map((w) => (
            <li key={w.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
              {editing?.id === w.id ? (
                <>
                  <input className="input !w-40 !py-1.5" value={editing.word} onChange={(e) => setEditing({ ...editing, word: e.target.value })} aria-label="עריכת מילה" />
                  <select className="input !w-auto !py-1.5" value={editing.category_id} onChange={(e) => setEditing({ ...editing, category_id: Number(e.target.value) })} aria-label="קטגוריה">
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <select className="input !w-auto !py-1.5" value={editing.difficulty} onChange={(e) => setEditing({ ...editing, difficulty: Number(e.target.value) })} aria-label="קושי">
                    {[1, 2, 3].map((d) => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
                  </select>
                  <button type="button" className="btn-mint !px-3 !py-1.5 text-sm" onClick={saveEdit}>שמירה</button>
                  <button type="button" className="btn-ghost !px-3 !py-1.5 text-sm" onClick={() => setEditing(null)}>ביטול</button>
                </>
              ) : (
                <>
                  <span className="flex-1 font-bold">{w.word}</span>
                  <span className="text-sm text-ink/60">{catName_(w.category_id)?.emoji} {catName_(w.category_id)?.name} · {DIFFICULTY_LABELS[w.difficulty]}</span>
                  <button type="button" className="btn-ghost !px-3 !py-1.5 text-sm" onClick={() => setEditing(w)}>עריכה</button>
                  <button type="button" className="btn-ghost !px-3 !py-1.5 text-sm !text-tomato" onClick={() => del(w)}>מחיקה</button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
