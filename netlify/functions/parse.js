// Serverová funkce: stáhne náhled z odkazu a (u jídla) převede popisek na strukturovaný recept přes Claude API.
const MODEL = process.env.MODEL || 'claude-haiku-5-5';
const H = { 'content-type': 'application/json' };
const out = (s, b) => ({ statusCode: s, headers: H, body: JSON.stringify(b) });

const dec = s => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d));

async function meta(url) {
  const res = { title: '', desc: '', image: '' };
  try {
    const r = await fetch(url, {
      headers: { 'user-agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', 'accept-language': 'cs,en;q=0.8' },
      redirect: 'follow', signal: AbortSignal.timeout(6000)
    });
    const h = await r.text();
    const g = p => {
      const m = h.match(new RegExp('<meta[^>]+(?:property|name)=["\']' + p + '["\'][^>]+content=["\']([^"\']*)["\']', 'i'))
        || h.match(new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]+(?:property|name)=["\']' + p + '["\']', 'i'));
      return m ? dec(m[1]) : '';
    };
    res.title = g('og:title'); res.desc = g('og:description') || g('description');
    const img = g('og:image');
    if (img) {
      const ir = await fetch(img, { signal: AbortSignal.timeout(6000) });
      const buf = Buffer.from(await ir.arrayBuffer());
      if (ir.ok && buf.length < 1500000) res.image = `data:${ir.headers.get('content-type') || 'image/jpeg'};base64,${buf.toString('base64')}`;
    }
  } catch (e) { /* best effort */ }
  return res;
}

const SYS = `Extract a cooking recipe from the text (usually an Instagram caption). Write all values in Czech.
Return ONLY one JSON object, no markdown:
{"is_recipe":true|false,"title":"short name","servings":int,"time":total minutes (int, estimate if missing),
"meal":"snídaně"|"oběd"|"večeře"|"svačina"|"dezert","taste":"sladké"|"slané",
"diet":[subset of "vegetariánské","veganské","bez lepku" - only if clearly true],
"difficulty":"lehké"|"střední"|"náročné",
"ingredients":[{"name":"base form: singular nominative, lowercase, no quantity, e.g. 'vejce', 'kuřecí prsa', 'cibule'","amount":number|null,"unit":"g"|"ml"|"ks"|"lžíce"|"lžička"|"hrnek"|"stroužek"|"špetka"|null}],
"steps":["short step", ...]}
Unify synonyms (vajíčka -> vejce). Convert fractions to decimals. If the text is not a recipe or has no ingredients, return {"is_recipe":false}.`;

exports.handler = async event => {
  if (event.httpMethod !== 'POST') return out(405, { error: 'POST only' });
  if (process.env.APP_PASSWORD && event.headers['x-pass'] !== process.env.APP_PASSWORD) return out(401, { error: 'Špatné heslo (nastavení ⚙️)' });
  let b; try { b = JSON.parse(event.body || '{}'); } catch { return out(400, { error: 'Špatný požadavek' }); }
  const result = {};
  let caption = (b.caption || '').trim();
  if (b.url && (!caption || !b.image)) {
    const m = await meta(b.url);
    if (m.image) result.image = m.image;
    if (b.type === 'wood') result.title = m.title.slice(0, 80);
    if (!caption) caption = m.desc;
  }
  if (b.type === 'wood') return out(200, result);
  if (!caption || caption.length < 30) return out(422, { error: 'Nepodařilo se získat popisek. Vlož ho ručně.', ...result });
  let t = '';
  try {
    if (process.env.GEMINI_API_KEY) {
      // Zkouší modely postupně: když je jeden přetížený nebo nedostupný, přejde na další.
      const models = [process.env.GEMINI_MODEL, 'gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']
        .filter((m, i, a) => m && a.indexOf(m) === i);
      let lastErr = '';
      for (const model of models) {
        for (let attempt = 0; attempt < 2 && !t; attempt++) {
          const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: SYS }] },
              contents: [{ role: 'user', parts: [{ text: caption.slice(0, 6000) }] }],
              generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
            })
          });
          const j = await r.json().catch(() => ({}));
          if (r.ok) { t = (j.candidates?.[0]?.content?.parts || []).map(c => c.text || '').join(''); break; }
          lastErr = `${model}: ${j.error?.message || r.status}`;
          if (r.status === 503 || r.status === 429) await new Promise(res => setTimeout(res, 1500)); // krátká pauza a znovu
          else break; // jiná chyba (např. model neexistuje) -> rovnou další model
        }
        if (t) break;
      }
      if (!t) return out(502, { error: 'AI (Gemini) je teď nedostupná, zkus to za chvíli. ' + lastErr, ...result });
    } else {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: MODEL, max_tokens: 2500, system: SYS, messages: [{ role: 'user', content: caption.slice(0, 6000) }] })
      });
      const j = await r.json();
      if (!r.ok) return out(502, { error: 'AI: ' + (j.error?.message || r.status), ...result });
      t = (j.content || []).map(c => c.text || '').join('');
    }
  } catch (e) { return out(502, { error: 'AI nedostupná: ' + e.message, ...result }); }
  try {
    const rec = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
    if (!rec.is_recipe || !rec.ingredients?.length) return out(422, { error: 'V textu jsem nenašel recept. Vlož celý popisek.', ...result });
    result.recipe = rec;
    return out(200, result);
  } catch { return out(502, { error: 'AI vrátila nečitelnou odpověď, zkus znovu.', ...result }); }
};
