/**
 * Lesezugriffe auf `posts` – den Kurs-Spike aus dem Supabase-Tutorial (E36, V9).
 *
 * Wie `catalog.service.ts`: Jeder Fehler der Abfrage wird geworfen, die View entscheidet,
 * was angezeigt wird.
 */

import { supabase } from './supabase';
import type { Tables } from '../types/database.types';

export type Post = Pick<Tables<'posts'>, 'id' | 'title' | 'description'>;

/** Alle Beiträge, die neuesten zuerst. */
export async function fetchPosts(): Promise<Post[]> {
    const { data, error } = await supabase.from('posts').select('id, title, description').order('created_at', { ascending: false });
    if (error) throw new Error(`posts konnte nicht geladen werden: ${error.message}`);
    return data;
}

/** Ein Beitrag – `null`, wenn es ihn nicht gibt. */
export async function fetchPost(id: string): Promise<Post | null> {
    const { data, error } = await supabase.from('posts').select('id, title, description').eq('id', id).maybeSingle();
    if (error) throw new Error(`Beitrag ${id} konnte nicht geladen werden: ${error.message}`);
    return data;
}
