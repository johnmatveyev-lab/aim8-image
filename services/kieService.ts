
import { CreateVideoParams, CreateVideoResponse, VideoStatusResponse } from '../types';

const BASE_URL = "https://api.kie.ai/api/v1/jobs";

/**
 * Creates a video generation task via Kie.ai
 */
export const createVideoTask = async (params: CreateVideoParams): Promise<CreateVideoResponse> => {
  // Map simplified model names to API specific slugs if necessary
  // Assuming Kie.ai accepts these directly or they map to the sora endpoint with a model param
  // For now we pass the model string directly or default to sora-2
  let modelSlug = "sora-2-text-to-video"; // Default
  
  if (params.model) {
    switch(params.model.toLowerCase()) {
      case 'veo-3.1': modelSlug = 'veo-3.1'; break; // Example slug
      case 'kling': modelSlug = 'kling-video'; break; // Example slug
      case 'imagine': modelSlug = 'imagine-video'; break; // Example slug
      case 'sora-2': 
      default: 
        modelSlug = 'sora-2-text-to-video';
    }
  }

  try {
    const response = await fetch(`${BASE_URL}/createTask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${params.apiKey}`
      },
      body: JSON.stringify({
        model: modelSlug,
        input: {
          prompt: params.prompt,
          aspect_ratio: params.aspect_ratio || "landscape",
          n_frames: params.n_frames || "10",
          remove_watermark: params.remove_watermark ?? true
        }
      })
    });

    const data = await response.json();

    if (data.code === 200) {
      return {
        success: true,
        taskId: data.data.taskId,
        message: `Video generation started with ${modelSlug}`
      };
    } else {
      return {
        success: false,
        error: data.msg || "Failed to create video task"
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error occurred"
    };
  }
};

/**
 * Checks the status of a running video task
 */
export const checkVideoStatus = async (apiKey: string, taskId: string): Promise<VideoStatusResponse> => {
  try {
    const response = await fetch(`${BASE_URL}/recordInfo?taskId=${taskId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`
      }
    });

    const data = await response.json();

    if (data.code === 200) {
      const taskData = data.data;

      // Parse progress if available (e.g., "50%")
      let progress = 0;
      if (taskData.progress) {
        if (typeof taskData.progress === 'number') {
          progress = taskData.progress;
        } else if (typeof taskData.progress === 'string') {
          progress = parseInt(taskData.progress.replace('%', ''), 10);
        }
      }

      // Determine Detailed Status
      let detailedStatus = "Processing";
      const rawState = (taskData.state || "").toLowerCase();

      if (taskData.state === "success") {
        detailedStatus = "Completed";
      } else if (taskData.state === "fail") {
        detailedStatus = "Failed";
      } else if (rawState === 'queued' || rawState === 'pending' || rawState === 'waiting') {
        detailedStatus = "Queued";
      } else if (rawState === 'running' || rawState === 'generating') {
        detailedStatus = "Rendering";
      } else if (rawState === 'processing' || rawState === 'analyzing') {
        detailedStatus = "Processing";
      } else if (rawState) {
        // Fallback to capitalizing the raw state
        detailedStatus = rawState.charAt(0).toUpperCase() + rawState.slice(1);
      }

      if (taskData.state === "success") {
        let resultJson;
        try {
            resultJson = typeof taskData.resultJson === 'string' ? JSON.parse(taskData.resultJson) : taskData.resultJson;
        } catch (e) {
            console.error("Failed to parse resultJson", e);
        }
        
        return {
          status: "success",
          videoUrl: resultJson?.resultUrls?.[0] || "",
          costTime: taskData.costTime,
          message: "Video generation complete!",
          progress: 100,
          detailedStatus: "Completed"
        };
      } else if (taskData.state === "fail") {
        return {
          status: "failed",
          error: taskData.failMsg || "Video generation failed",
          failCode: taskData.failCode,
          detailedStatus: "Failed"
        };
      } else {
        return {
          status: "waiting",
          message: "Video is still being generated...",
          progress: progress,
          detailedStatus: detailedStatus
        };
      }
    } else {
      return {
        status: "error",
        error: data.msg || "Failed to check video status"
      };
    }
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error.message : "Network error checking status"
    };
  }
};
