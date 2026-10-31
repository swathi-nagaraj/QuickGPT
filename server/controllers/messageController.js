import axios from "axios"
import Chat from "../models/Chat.js"
import User from "../models/user.js"
import imagekit from "../configs/imageKit.js"
import openai from '../configs/openai.js'

const MODELS = ["gemini-3.8-flash", "gemini-2.5-flash", "gemini-2.5-flash-lite"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function chatWithRetry(prompt) {
  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        return await openai.chat.completions.create({
          model,
          messages: [{ role: "user", content: prompt }],
        });
      } catch (err) {
        const msg = String(err.message);
        const retryable = err.status === 503 || err.status === 429 || msg.includes("503") || msg.includes("429");
        if (!retryable) throw err;          // vera error-na udane stop
        await sleep(attempt * 1500);        // 1.5s, 3s wait
      }
    }
  }
  throw new Error("AI is busy right now. Please try again in a moment.");
}

// Text-based AI Chat Message Controller
export const textMessageController = async (req, res) => {
    try {
        const userId = req.user._id

        //Check credits
        if(req.user.credits < 1){
            return res.json({success: false, message: "You don't have enough credits to use this feature"})
        }

        const {chatId, prompt} = req.body

        const chat = await Chat.findOne({userId, _id: chatId})

        if (!chat) return res.json({ success: false, message: "Chat not found" });

        
        chat.messages.push({role: "user", content: prompt, timestamp: Date.now(), isImage: false})

        const {choices} = await chatWithRetry(prompt);
        
    const reply = {
        role : "assistant",
        content: choices[0].message.content,
        timestamp: Date.now(), 
        isImage: false
    }


    chat.messages.push(reply)
    await chat.save()
    await User.updateOne({_id: userId}, {$inc: {credits: -1}})

    res.json({success: true, reply})
    

    } catch (error) {
        res.json({success: false, message: error.message})
    }
}

// Image Generation Message Controller
export const imageMessageController = async (req, res) => {
    try {
        const userId = req.user._id;
        //Check credits
        if(req.user.credits < 2){
            return res.json({success: false, message: "You don't have enough credits to use this feature"})
        }
        const {prompt, chatId, isPublished} = req.body
        //Find chat
        const chat = await Chat.findOne({userId, _id: chatId})

        //Push user message
        chat.messages.push({
            role: "user", 
            content: prompt,
            timestamp: Date.now(),
            isImage: false })
        
        // Encode the prompt
        const encodedPrompt = encodeURIComponent(prompt)
        
        // Construct ImageKit AI generation URL
        const generatedImageUrl = `${process.env.IMAGEKIT_URL_ENDPOINT}/ik-genimg-prompt-${encodedPrompt}/quickgpt/${Date.now()}.png?tr=w-800,h-800`;
        
        // Trigger generation by fetching from ImageKit
        const aiImageResponse = await axios.get(generatedImageUrl, {responseType: "arraybuffer"})

        // Convert to Base64
        const base64Image = `data:image/png;base64,${Buffer.from(aiImageResponse.data,"binary").toString('base64')}`;

        //Upload to ImageKit Media Library
        const uploadResponse = await imagekit.upload({
            file: base64Image,
            fileName: `${Date.now()}.png`,
            folder: "quickgpt"
        })

        const reply = {
            role: 'assistant',
            content : uploadResponse.url,
            timestamp: Date.now(),
            isImage: true,
            isPublished
        }

        res.json({success: true, reply})

        chat.messages.push(reply)
        await chat.save()

        await User.updateOne({_id: userId}, {$inc: {credits: -2}})


    } catch (error){
        
        res.json({success: false, message: error.message })
    }
}