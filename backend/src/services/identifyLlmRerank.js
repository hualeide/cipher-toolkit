/**
 * 识别候选 LLM 重排序 — 可选，需 OPENAI_API_KEY
 */
import crypto from 'crypto';
import { compareIdentifyHits } from './identifyScore.js';

const cache = new Map();
const ENABLED = process.env.IDENTIFY_LLM_RERANK === '1';
const API_KEY = process.env.OPENAI_API_KEY || '';
const BASE_URL = (process.env.IDENTIFY_LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
const MODEL = process.env.IDENTIFY_LLM_MODEL || 'gpt-4o-mini';

function cacheKey(ciphertext, candidates) {
  const payload = candidates.map((c) => `${c.id}:${c.result}:${c.score}`).join('|');
  return crypto.createHash('sha256').update(`${ciphertext}::${payload}`).digest('hex');
}

function pickRerankPool(candidates, max = 5) {
  const pool = [];
  const seen = new Set();
  for (const c of candidates) {
    if (!c.verified || !c.result || seen.has(c.result)) continue;
    seen.add(c.result);
    pool.push(c);
    if (pool.length >= max) break;
  }
  return pool;
}

function buildPrompt(ciphertext, pool) {
  const lines = pool.map((c, i) => (
    `${i + 1}. id=${c.id} result=${JSON.stringify(c.result)} params=${JSON.stringify(c.params || {})}`
  ));
  return `你是密码学解密评估助手。给定密文与若干候选解密结果，评估每个结果作为正确解密的自然度与可能性。

密文：${JSON.stringify(ciphertext)}

候选：
${lines.join('\n')}

请仅返回 JSON 对象，键为候选序号（字符串 "1","2",…），值为 0 到 1 的小数（自然可读且像正确解密的概率）。示例：{"1":0.92,"2":0.15}`;
}

function parseRatings(raw, pool) {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
  const out = new Map();
  pool.forEach((c, i) => {
    const v = parsed[String(i + 1)] ?? parsed[i + 1];
    if (typeof v === 'number' && Number.isFinite(v)) {
      out.set(c, Math.max(0, Math.min(1, v)));
    }
  });
  return out.size ? out : null;
}

async function callLlm(ciphertext, pool) {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Respond with JSON only.' },
        { role: 'user', content: buildPrompt(ciphertext, pool) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('empty LLM response');
  const ratings = parseRatings(content, pool);
  if (!ratings) throw new Error('invalid LLM JSON');
  return ratings;
}

function mergeRatings(candidates, pool, ratings) {
  const llmByResult = new Map();
  for (const c of pool) {
    const llmScore = ratings.get(c);
    if (llmScore == null) continue;
    llmByResult.set(c.result, llmScore);
  }
  if (!llmByResult.size) return candidates;

  const merged = candidates.map((c) => {
    const llmScore = llmByResult.get(c.result);
    if (llmScore == null) return c;
    const base = c.score ?? 0;
    const score = Math.round(base * 0.6 + llmScore * 100 * 0.4);
    return {
      ...c,
      llmScore,
      score,
      rawScore: c.rawScore ?? base,
    };
  });
  return [...merged].sort(compareIdentifyHits);
}

/** 对 top verified 候选做 LLM 重排；失败或无 key 时原样返回 */
export async function rerankIdentifyCandidates(ciphertext, candidates) {
  if (!ENABLED || !API_KEY || !candidates?.length) return candidates;

  const pool = pickRerankPool(candidates, 5);
  if (pool.length < 2) return candidates;

  const key = cacheKey(ciphertext, pool);
  let ratings = cache.get(key);
  if (!ratings) {
    try {
      ratings = await callLlm(ciphertext, pool);
      cache.set(key, ratings);
    } catch {
      return candidates;
    }
  }
  return mergeRatings(candidates, pool, ratings);
}

export function isLlmRerankEnabled() {
  return ENABLED && Boolean(API_KEY);
}
