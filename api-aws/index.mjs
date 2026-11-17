// KPIダッシュボード API（AWS Lambda / Node.js 20）
// 構成：Lambda（関数URL）＋ S3（保存先）
//
// 環境変数：
//   BUCKET       … データを保存するS3バケット名
//   READ_TOKEN   … 読み取り用の合言葉（Claude・Notion・同僚に渡す）
//   WRITE_TOKEN  … 書き込み用の合言葉（ダッシュボードにだけ入れる）
//
// 書き込み：POST {URL}  本文 {"token":WRITE_TOKEN,"data":{...}}  ← ダッシュボードが自動で送る
// 読み取り：GET  {URL}?token=READ_TOKEN&type=summary|cohort|students|coaching|program|monthly|all[&ym=2026/10][&date=2026-10-16]

import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

const s3 = new S3Client({});
const B = process.env.BUCKET;
const LATEST = 'latest.json';
const HIST = 'history/';

const res = (code, obj) => ({
  statusCode: code,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(obj)
});

async function getJson(key) {
  try {
    const r = await s3.send(new GetObjectCommand({ Bucket: B, Key: key }));
    return JSON.parse(await r.Body.transformToString());
  } catch (e) { return null; }
}
async function putJson(key, obj) {
  await s3.send(new PutObjectCommand({ Bucket: B, Key: key, Body: JSON.stringify(obj), ContentType: 'application/json' }));
}
async function history() {
  const r = await s3.send(new ListObjectsV2Command({ Bucket: B, Prefix: HIST }));
  return (r.Contents || []).map(o => o.Key.replace(HIST, '').replace('.json', '')).sort().reverse().slice(0, 30);
}

export const handler = async (event) => {
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';

  if (method === 'POST') {
    let body;
    try {
      const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
      body = JSON.parse(raw);
    } catch (e) { return res(400, { error: 'JSONが読めません' }); }
    if (!body || body.token !== process.env.WRITE_TOKEN) return res(403, { error: '書き込みの合言葉が違います' });
    const data = body.data || {};
    data.updatedAt = new Date().toISOString();
    const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); // 日本時間の日付
    await putJson(LATEST, data);
    await putJson(HIST + day + '.json', data);
    return res(200, { ok: true, updatedAt: data.updatedAt });
  }

  const q = event.queryStringParameters || {};
  if (q.token !== process.env.READ_TOKEN) return res(403, { error: '読み取りの合言葉が違います' });
  const D = await getJson(q.date ? HIST + q.date + '.json' : LATEST);
  if (!D) return res(404, { error: 'まだデータがありません。ダッシュボードを一度開いてください。' });
  const pick = () => (D.cohorts || []).find(c => c.ym === q.ym);

  // 営業時の商談分析（Levela 営業分析APIを中継。キーはこのLambdaだけが持つ）
  if (q.type === 'sales') {
    if (!process.env.SALES_API_KEY) return res(503, { error: 'SALES_API_KEY が未設定です' });
    const name = String(q.name || '').replace(/[\s　]/g, '');
    if (!name) return res(400, { error: 'name=生徒名 を指定してください' });
    const sql = "WITH latest AS (SELECT DISTINCT ON (recording_id) recording_id, summary, issues_heard, proposal, hearing_details, root_cause, closing_result FROM analysis_results ORDER BY recording_id, created_at DESC NULLS LAST, id DESC) " +
      "SELECT r.customer_name, r.start_time, r.assignee, r.result_status, r.cancel_status, a.summary, a.issues_heard, a.proposal, a.hearing_details, a.root_cause, a.closing_result " +
      "FROM recordings_cache r LEFT JOIN latest a ON a.recording_id = r.id " +
      "WHERE replace(replace(coalesce(r.customer_name,''),' ',''),'　','') LIKE %s ORDER BY r.start_time DESC LIMIT 5";
    try {
      const up = await fetch('https://app.levela.co.jp/api-dashboard/gw/sales/api/data/query', {
        method: 'POST',
        headers: { 'X-API-Key': process.env.SALES_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql, params: ['%' + name + '%'], limit: 5 })
      });
      const j = await up.json();
      if (!up.ok) return res(up.status, { error: '営業分析APIのエラー', detail: j.error || j.detail || null });
      return res(200, { name, recordings: j.rows || [] });
    } catch (e) { return res(502, { error: '営業分析APIに接続できません' }); }
  }

  switch (q.type || 'index') {
    case 'index':
      return res(200, { updatedAt: D.updatedAt, cohorts: (D.cohorts || []).map(c => c.ym), types: ['summary', 'cohort', 'students', 'coaching', 'program', 'programs', 'monthly', 'all'], history: await history() });
    case 'summary': return res(200, { updatedAt: D.updatedAt, quarter: D.quarter, cohorts: D.summary || [] });
    case 'cohort': { const c = pick(); return c ? res(200, c) : res(404, { error: 'ym=2026/10 のように卒業月を指定してください' }); }
    case 'students': { const c = pick(); return c ? res(200, { ym: c.ym, updatedAt: D.updatedAt, students: c.allStudents || c.students || [] }) : res(404, { error: 'ym を指定してください' }); }
    case 'programs': return res(200, { updatedAt: D.updatedAt, rows: D.programRows || [] });
    case 'coaching': return res(200, { updatedAt: D.updatedAt, months: D.coaching || [] });
    case 'program': return res(200, { updatedAt: D.updatedAt, program: D.program || null });
    case 'monthly': return res(200, { updatedAt: D.updatedAt, monthly: D.monthly || null });
    case 'all': return res(200, D);
    default: return res(400, { error: 'type が不明です' });
  }
};
