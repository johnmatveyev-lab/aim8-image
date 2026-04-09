
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GeneratedImage } from '../types';

let supabase: SupabaseClient | null = null;

const SETUP_SQL = `create table projects (
  task_id text primary key,
  prompt text,
  status text,
  url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  metadata jsonb
);`;

export const initSupabase = (url: string, key: string): SupabaseClient | null => {
  if (!url || !key || url.includes('YOUR_SUPABASE')) {
    console.warn("Supabase not configured properly in config.ts");
    return null;
  }
  try {
    supabase = createClient(url, key);
    return supabase;
  } catch (error) {
    console.error("Failed to initialize Supabase client:", error);
    return null;
  }
};

export const getSupabase = (): SupabaseClient | null => {
  return supabase;
};

// Database Operations

/**
 * Saves a generated video project to the database
 */
export const saveProject = async (video: GeneratedImage) => {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('projects')
      .upsert({
        task_id: video.id,
        prompt: video.prompt,
        status: video.status,
        url: video.url,
        created_at: new Date(video.timestamp).toISOString(),
        // metadata: {} // Optional JSONB field if you have extra data
      }, { onConflict: 'task_id' })
      .select();

    if (error) throw error;
    return data;
  } catch (error: any) {
    // Check for missing table error (Code 42P01 or specific message)
    const msg = error?.message || '';
    if (error?.code === '42P01' || msg.includes('Could not find the table')) {
      console.warn("Supabase: Table 'projects' missing. Skipping save. Check console for setup SQL.");
      return null;
    }
    console.error("Error saving project to Supabase:", msg);
    return null;
  }
};

/**
 * Fetches all projects for the user
 */
export const getProjects = async (): Promise<GeneratedImage[]> => {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((item: any) => ({
      id: item.task_id,
      prompt: item.prompt,
      status: item.status as 'generating' | 'completed' | 'failed',
      url: item.url,
      timestamp: new Date(item.created_at).getTime()
    }));
  } catch (error: any) {
    // Specific handling for "relation does not exist" (missing table)
    const msg = error?.message || '';
    
    if (error?.code === '42P01' || msg.includes('Could not find the table')) {
        console.group("⚠️ Supabase Setup Required");
        console.warn("The 'projects' table was not found in your Supabase database.");
        console.info("Please run the following SQL in your Supabase SQL Editor to enable history:");
        console.log(SETUP_SQL);
        console.groupEnd();
        return [];
    }
    
    console.error("Error fetching projects from Supabase:", msg);
    return [];
  }
};