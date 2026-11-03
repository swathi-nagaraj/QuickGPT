import axios from "axios"
import Chat from "../models/Chat.js"
import User from "../models/user.js"
import imagekit from "../configs/imageKit.js"
import openai from '../configs/openai.js'

const MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Fast fallback: oru model fail aana udane next model
async function chatWithFallback(prompt) {
  for (const model of MODELS) {
    try {
      return await openai.chat.completions.create(
        { model, messages: [{ role: "user", content: prompt }] },
        { timeout: 25000, maxRetries: 0 }
      );
    } catch (err) {
      console.error(`Model ${model} failed:`, err.status, err.message);
    }
  }
  throw new Error("AI is busy right now. Please try again in a moment.");
}

// Image ready aagura varaikum retry pannum
async function fetchGeneratedImage(url) {
  for (let attempt = 1; attempt <= 8; attempt++) {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 30000,
      validateStatus: () => true,
    });

    const buf = Buffer.from(response.data || []);
    const isPng = buf.slice(0, 4).toString("hex") === "89504e47";
    const isJpeg = buf.slice(0, 2).toString("hex") === "ffd8";

    if (response.status === 200 && (isPng || isJpeg)) {
      return { buf, contentType: response.headers["content-type"] || "image/png" };
    }

    console.log(`Attempt ${attempt}: not ready ->`, buf.toString("utf8").slice(0, 80));
    await sleep(4000);
  }
  throw new Error("Image generation timed out. Please try again.");
}

// Text-based AI Chat Message Controller
export const textMessageController = async (req, res) => {
  try {
    const userId = req.user._id;

    if (req.user.credits < 1) {
      return res.json({ success: false, message: "You don't have enough credits to use this feature" });
    }

    const { chatId, prompt } = req.body;
    if (!prompt || !prompt.trim()) {
      return res.json({ success: false, message: "Prompt is required" });
    }

    const chat = await Chat.findOne({ userId, _id: chatId });
    if (!chat) return res.json({ success: false, message: "Chat not found" });

    chat.messages.push({ role: "user", content: prompt, timestamp: Date.now(), isImage: false });

    const { choices } = await chatWithFallback(prompt);

    const reply = {
      role: "assistant",
      content: choices[0].message.content,
      timestamp: Date.now(),
      isImage: false,
    };

    chat.messages.push(reply);

    await Promise.all([
      chat.save(),
      User.updateOne({ _id: userId }, { $inc: { credits: -1 } }),
    ]);

    res.json({ success: true, reply });
  } catch (error) {
    console.error("Text error:", error.message);
    res.json({ success: false, message: error.message });
  }
};

// Image Generation Message Controller
export const imageMessageController = async (req, res) => {
  try {
    const userId = req.user._id;

    if (req.user.credits < 2) {
      return res.json({ success: false, message: "You don't have enough credits to use this feature" });
    }

    const { prompt, chatId, isPublished } = req.body;
    if (!prompt || !prompt.trim()) {
      return res.json({ success: false, message: "Prompt is required" });
    }

    const chat = await Chat.findOne({ userId, _id: chatId });
    if (!chat) return res.json({ success: false, message: "Chat not found" });

    chat.messages.push({ role: "user", content: prompt, timestamp: Date.now(), isImage: false });

    const encodedPrompt = encodeURIComponent(prompt);
    const generatedImageUrl = `${process.env.IMAGEKIT_URL_ENDPOINT}/ik-genimg-prompt-${encodedPrompt}/quickgpt/${Date.now()}.png?tr=w-800,h-800`;

    // ready aagura varaikum wait pannum
    const { buf, contentType } = await fetchGeneratedImage(generatedImageUrl);
    const base64Image = `data:${contentType};base64,${buf.toString("base64")}`;

    const uploadResponse = await imagekit.upload({
      file: base64Image,
      fileName: `${Date.now()}.png`,
      folder: "quickgpt",
    });

    const reply = {
      role: "assistant",
      content: uploadResponse.url,
      timestamp: Date.now(),
      isImage: true,
      isPublished: !!isPublished,
    };

    chat.messages.push(reply);

    // SAVE FIRST, respond LAST
    await Promise.all([
      chat.save(),
      User.updateOne({ _id: userId }, { $inc: { credits: -2 } }),
    ]);

    res.json({ success: true, reply });
  } catch (error) {
    console.error("Image error:", error.response?.status, error.message);
    res.json({ success: false, message: error.message });
  }
};