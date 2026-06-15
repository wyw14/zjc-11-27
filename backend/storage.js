import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'data', 'stories.json');
const SENSITIVE_FILE = path.join(__dirname, 'data', 'sensitive-words.json');

const MAX_PARTICIPANTS = 10;
const MAX_CHARS_PER_STORY = 5000;

function ensureDataDir() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readData() {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) {
    const initial = { stories: {} };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    return { stories: {} };
  }
}

function writeData(data) {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function calcStoryTotalChars(entries) {
  return entries.reduce((sum, e) => sum + (e.content?.length || 0), 0);
}

function updateStoryStatus(story) {
  const totalChars = calcStoryTotalChars(story.entries);
  const participants = new Set(story.entries.map(e => e.author)).size;
  story.totalChars = totalChars;
  story.participantCount = participants;
  story.locked = totalChars >= MAX_CHARS_PER_STORY || participants >= MAX_PARTICIPANTS;
  story.lockedReason = totalChars >= MAX_CHARS_PER_STORY
    ? `已达到字数上限（${totalChars}/${MAX_CHARS_PER_STORY}字）`
    : participants >= MAX_PARTICIPANTS
      ? `已达到接龙人数上限（${participants}/${MAX_PARTICIPANTS}人）`
      : null;
}

function formatStoryDetail(story) {
  return {
    id: story.id,
    title: story.title,
    createdAt: story.createdAt,
    updatedAt: story.updatedAt,
    entryCount: story.entries.length,
    participantCount: story.participantCount,
    totalChars: story.totalChars,
    maxChars: MAX_CHARS_PER_STORY,
    maxParticipants: MAX_PARTICIPANTS,
    locked: story.locked,
    lockedReason: story.lockedReason,
    entries: story.entries
  };
}

export function createStory({ title, content, author }) {
  const data = readData();
  const id = generateId();
  const now = Date.now();
  const story = {
    id,
    title,
    createdAt: now,
    updatedAt: now,
    entries: [{
      id: generateId(),
      author,
      content,
      order: 1,
      createdAt: now
    }]
  };
  updateStoryStatus(story);
  data.stories[id] = story;
  writeData(data);
  return formatStoryDetail(story);
}

export function getAllStories() {
  const data = readData();
  return Object.values(data.stories)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(s => ({
      id: s.id,
      title: s.title,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      entryCount: s.entries.length,
      participantCount: s.participantCount,
      totalChars: s.totalChars,
      locked: s.locked,
      lockedReason: s.lockedReason
    }));
}

export function getStoryById(id) {
  const data = readData();
  const story = data.stories[id];
  if (!story) return null;
  updateStoryStatus(story);
  data.stories[id] = story;
  writeData(data);
  return formatStoryDetail(story);
}

export function addEntry(storyId, { content, author }) {
  const data = readData();
  const story = data.stories[storyId];
  if (!story) {
    return { success: false, error: '故事不存在', code: 404 };
  }
  updateStoryStatus(story);
  if (story.locked) {
    return { success: false, error: story.lockedReason || '故事已锁定', code: 409 };
  }
  const contentLen = content?.length || 0;
  if (contentLen === 0) {
    return { success: false, error: '续写内容不能为空', code: 400 };
  }
  if (calcStoryTotalChars(story.entries) + contentLen > MAX_CHARS_PER_STORY) {
    return {
      success: false,
      error: `内容过长，当前剩余可容纳 ${MAX_CHARS_PER_STORY - calcStoryTotalChars(story.entries)} 字`,
      code: 413
    };
  }
  const now = Date.now();
  story.entries.push({
    id: generateId(),
    author,
    content,
    order: story.entries.length + 1,
    createdAt: now
  });
  story.updatedAt = now;
  updateStoryStatus(story);
  writeData(data);
  return { success: true, story: formatStoryDetail(story) };
}

export function resetStory(storyId) {
  const data = readData();
  const story = data.stories[storyId];
  if (!story) {
    return { success: false, error: '故事不存在', code: 404 };
  }
  const firstEntry = story.entries[0];
  const now = Date.now();
  story.entries = firstEntry ? [{
    id: generateId(),
    author: firstEntry.author,
    content: firstEntry.content,
    order: 1,
    createdAt: now
  }] : [];
  story.createdAt = now;
  story.updatedAt = now;
  updateStoryStatus(story);
  writeData(data);
  return { success: true, story: formatStoryDetail(story) };
}

function ensureSensitiveFile() {
  ensureDataDir();
  if (!fs.existsSync(SENSITIVE_FILE)) {
    const initial = { words: [] };
    fs.writeFileSync(SENSITIVE_FILE, JSON.stringify(initial, null, 2), 'utf-8');
  }
}

function readSensitiveData() {
  ensureSensitiveFile();
  try {
    const raw = fs.readFileSync(SENSITIVE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return { words: [] };
  }
}

function writeSensitiveData(data) {
  ensureSensitiveFile();
  fs.writeFileSync(SENSITIVE_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export function getAllSensitiveWords() {
  const data = readSensitiveData();
  return data.words.slice().sort((a, b) => b.createdAt - a.createdAt);
}

export function addSensitiveWord(word) {
  const trimmed = (word || '').trim();
  if (!trimmed) {
    return { success: false, error: '敏感词不能为空', code: 400 };
  }
  const data = readSensitiveData();
  const exists = data.words.find(w => w.word === trimmed);
  if (exists) {
    return { success: false, error: '该敏感词已存在', code: 409 };
  }
  const item = {
    id: generateId(),
    word: trimmed,
    createdAt: Date.now()
  };
  data.words.push(item);
  writeSensitiveData(data);
  return { success: true, word: item };
}

export function deleteSensitiveWord(id) {
  const data = readSensitiveData();
  const idx = data.words.findIndex(w => w.id === id);
  if (idx === -1) {
    return { success: false, error: '敏感词不存在', code: 404 };
  }
  data.words.splice(idx, 1);
  writeSensitiveData(data);
  return { success: true };
}

export function checkSensitiveWords(text) {
  if (!text) {
    return { hit: false, matched: [] };
  }
  const data = readSensitiveData();
  const matched = [];
  const lowerText = text.toLowerCase();
  for (const item of data.words) {
    if (lowerText.includes(item.word.toLowerCase())) {
      matched.push(item.word);
    }
  }
  return {
    hit: matched.length > 0,
    matched: Array.from(new Set(matched))
  };
}

export { MAX_PARTICIPANTS, MAX_CHARS_PER_STORY };
