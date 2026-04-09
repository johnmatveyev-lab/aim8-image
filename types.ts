
// Kie.ai API Types
export interface CreateVideoParams {
    apiKey: string;
    prompt: string;
    model?: string;
    aspect_ratio?: 'portrait' | 'landscape';
    n_frames?: '10' | '15';
    remove_watermark?: boolean;
  }
  
  export interface CreateVideoResponse {
    success: boolean;
    taskId?: string;
    error?: string;
    message?: string;
  }
  
  export interface VideoStatusResponse {
    status: 'success' | 'failed' | 'waiting' | 'error';
    videoUrl?: string;
    costTime?: string;
    error?: string;
    failCode?: string;
    message?: string;
    progress?: number;
    detailedStatus?: string;
  }
  
  export interface GeneratedImage {
    id: string;
    prompt: string;
    model?: string;
    status: 'generating' | 'completed' | 'failed';
    url?: string;
    timestamp: number;
    progress?: number;
    detailedStatus?: string;
  }
  
  export interface LogMessage {
    id: string;
    source: 'user' | 'aim8' | 'system';
    text: string;
    timestamp: number;
  }
  
  // Helper type for tools
  export type ToolName = 'create_video_task' | 'check_video_status';