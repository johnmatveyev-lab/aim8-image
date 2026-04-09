
// Application Configuration
// Keys have been integrated as requested.

export const CONFIG = {
  // Gemini API Key
  // We prioritize the environment variable, but fall back to the provided key for immediate functionality.
  GEMINI_API_KEY: process.env.API_KEY || 'AIzaSyADiK_OoTjUH29UAYL8ZthfDnJnKKydPW0',
  
  // [REQUIRED] Your Kie.ai (Sora 2) API Key
  KIE_API_KEY: '9af32d4aef4b2ffa74432dcbc252fe0b', 
  
  // [OPTIONAL] Your Supabase Configuration for saving project history
  SUPABASE_URL: 'https://rhktayzykdkzdqtbnhsa.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoa3RheXp5a2RremRxdGJuaHNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1MTMzMjgsImV4cCI6MjA3OTA4OTMyOH0.vYfwEAW8dTMCRAKh612Ave55dB6BOzfNYulzBGL5C74'
};