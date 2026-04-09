
import { FunctionDeclaration, Type } from "@google/genai";

export const createVideoTaskTool: FunctionDeclaration = {
  name: "create_video_task",
  description: "Creates a video generation task using various AI models. Authentication is handled by the system.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      prompt: {
        type: Type.STRING,
        description: "Text description of the desired video (max 10,000 characters)"
      },
      model: {
        type: Type.STRING,
        enum: ["sora-2", "veo-3.1", "kling", "imagine"],
        description: "The video model to use. Default is sora-2. Options: sora-2, veo-3.1, kling, imagine."
      },
      aspect_ratio: {
        type: Type.STRING,
        enum: ["portrait", "landscape"],
        description: "Video aspect ratio - portrait or landscape (default: landscape)"
      },
      n_frames: {
        type: Type.STRING,
        enum: ["10", "15"],
        description: "Video duration - 10 seconds or 15 seconds (default: 10)"
      },
      remove_watermark: {
        type: Type.BOOLEAN,
        description: "Whether to remove watermarks from generated video (default: true)"
      }
    },
    required: ["prompt"]
  }
};

export const checkVideoStatusTool: FunctionDeclaration = {
  name: "check_video_status",
  description: "Checks the status of a video generation task. Use this if the user asks for an update on a specific task.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      task_id: {
        type: Type.STRING,
        description: "The task ID returned from create_video_task"
      }
    },
    required: ["task_id"]
  }
};

export const tools = [{ functionDeclarations: [createVideoTaskTool, checkVideoStatusTool] }];
