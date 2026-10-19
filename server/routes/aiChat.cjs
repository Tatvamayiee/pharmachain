const express = require('express');
const { z } = require('zod');
const { auth } = require('../middleware/auth.cjs');
const validate = require('../middleware/validate.cjs');
const aiChat = require('../services/aiChatService.cjs');

const router = express.Router();

const chatSchema = {
  body: z.object({
    message: z.string().trim().min(1, 'A non-empty message is required.').max(4_000),
    // Prior conversation turns (oldest first, excluding `message`). Optional;
    // the service caps and sanitizes it. Only user/assistant roles accepted.
    history: z.array(z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().max(4_000),
    })).max(24).optional(),
    // Optional page-awareness: the route the user is viewing when they ask.
    // Sanitized server-side before reaching the prompt.
    page: z.string().max(200).optional(),
  }),
};

// POST /api/ai/chat  — authenticated chat via the existing AI provider.
// Body: { message: string, history?: [{role, content}] }
// Returns: { reply: string, provider: string, model: string }
router.post('/chat', auth, validate(chatSchema), async (req, res, next) => {
  try {
    const { message, history, page } = req.body;

    if (!aiChat.isConfigured()) {
      return res.status(501).json({ error: 'AI chat is not configured on the server.' });
    }

    const reply = await aiChat.sendMessage(message.trim(), history, page);
    const meta = aiChat.resolveProvider();

    res.json({
      reply,
      provider: meta ? meta.id : 'unknown',
      model: meta ? meta.model : 'unknown',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;