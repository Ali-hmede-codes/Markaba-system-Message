import express, { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { checkAuth } from '../middleware/auth';

const router = express.Router();
const SETTINGS_FILE = path.join(__dirname, '../../../settings.json');

// GET settings
router.get('/', checkAuth, async (req: Request, res: Response) => {
  try {
    const data = await fs.readFile(SETTINGS_FILE, 'utf8');
    const settings = JSON.parse(data);
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error reading settings:', error);
    res.status(500).json({ success: false, message: 'Failed to read settings' });
  }
});

// POST update settings
router.post('/', checkAuth, async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    // Validate updates
    const validKeys = ['sendToTelegram', 'sendToWhatsApp', 'telegramSettings', 'batchSize'];
    for (const key in updates) {
      if (!validKeys.includes(key)) {
        return res.status(400).json({ success: false, message: `Invalid setting key: ${key}` });
      }
      if (key === 'batchSize' && typeof updates[key] !== 'number') {
        return res.status(400).json({ success: false, message: 'Batch size must be a number' });
      }
      if (key !== 'batchSize' && typeof updates[key] !== 'boolean') {
        return res.status(400).json({ success: false, message: `${key} must be a boolean` });
      }
    }

    const data = await fs.readFile(SETTINGS_FILE, 'utf8');
    const settings = JSON.parse(data);
    const updatedSettings = { ...settings, ...updates };
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(updatedSettings, null, 2));
    res.json({ success: true, settings: updatedSettings });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update settings' });
  }
});

export default router;